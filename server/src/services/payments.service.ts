import prisma from '../config/database';
import { PaymentStatus, PaymentMethod, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../types';
import debtsService from './debts.service';
import installmentsService from './installments.service';

export interface CreatePaymentDto {
  customerId: string;
  debtId?: string;
  receivedAt: Date;
  amount: number;
  currency: string;
  method: PaymentMethod;
  providerTxnId?: string;
  rawProviderPayload?: Record<string, unknown>;
}

export interface AllocatePaymentDto {
  allocations: {
    installmentId: string;
    amount: number;
  }[];
}

export interface PaymentFilters {
  customerId?: string;
  debtId?: string;
  status?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
}

class PaymentsService {
  async findAll(filters: PaymentFilters = {}, page = 1, limit = 20) {
    const where: Prisma.PaymentWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.debtId) {
      where.debtId = filters.debtId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.receivedAt = {};
      if (filters.startDate) {
        where.receivedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.receivedAt.lte = filters.endDate;
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { receivedAt: 'desc' },
        include: {
          customer: {
            select: { id: true, fullName: true },
          },
          debt: {
            select: { id: true, originalAmount: true, currency: true },
          },
          allocations: {
            include: {
              installment: {
                select: { id: true, sequenceNo: true, amountDue: true },
              },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        debt: true,
        allocations: {
          include: {
            installment: {
              select: { id: true, sequenceNo: true, dueDate: true, amountDue: true, amountPaid: true },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    return payment;
  }

  /**
   * Create a payment record
   * Uses idempotency key (providerTxnId) to prevent duplicate payments
   */
  async create(data: CreatePaymentDto) {
    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Validate debt exists if provided
    if (data.debtId) {
      const debt = await prisma.debt.findUnique({
        where: { id: data.debtId },
      });

      if (!debt) {
        throw new NotFoundError('Debt');
      }

      // Verify debt belongs to customer
      if (debt.customerId !== data.customerId) {
        throw new ValidationError('Debt does not belong to this customer');
      }
    }

    // Validate currency code (ISO 4217)
    if (!/^[A-Z]{3}$/.test(data.currency)) {
      throw new ValidationError('Currency must be a valid 3-letter ISO code');
    }

    // Check for duplicate transaction (idempotency)
    if (data.providerTxnId) {
      const existing = await prisma.payment.findUnique({
        where: { providerTxnId: data.providerTxnId },
      });

      if (existing) {
        throw new ConflictError('Payment with this transaction ID already exists');
      }
    }

    return prisma.payment.create({
      data: {
        customerId: data.customerId,
        debtId: data.debtId,
        receivedAt: data.receivedAt,
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        providerTxnId: data.providerTxnId,
        rawProviderPayload: data.rawProviderPayload as Prisma.InputJsonValue,
        status: 'received',
      },
      include: {
        customer: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  /**
   * Allocate payment to installments
   * ACID transaction: atomically updates payment allocations, installments, and debt balance
   */
  async allocate(paymentId: string, data: AllocatePaymentDto) {
    const payment = await this.findById(paymentId);

    if (payment.status !== 'received') {
      throw new ValidationError('Can only allocate received payments');
    }

    // Calculate total allocation amount
    const totalAllocation = data.allocations.reduce(
      (sum, a) => sum + a.amount,
      0
    );

    // Get existing allocations
    const existingAllocations = await prisma.paymentAllocation.aggregate({
      where: { paymentId },
      _sum: { amountApplied: true },
    });

    const alreadyAllocated = existingAllocations._sum.amountApplied?.toNumber() || 0;
    const availableToAllocate = payment.amount.toNumber() - alreadyAllocated;

    if (totalAllocation > availableToAllocate) {
      throw new ValidationError(
        `Allocation amount (${totalAllocation}) exceeds available payment amount (${availableToAllocate})`
      );
    }

    // Validate all installments exist and belong to correct debt
    const installmentIds = data.allocations.map((a) => a.installmentId);
    const installments = await prisma.installment.findMany({
      where: { id: { in: installmentIds } },
      include: { debt: true },
    });

    if (installments.length !== installmentIds.length) {
      throw new NotFoundError('One or more installments');
    }

    // If payment has a debt, verify all installments belong to that debt
    if (payment.debtId) {
      const invalidInstallments = installments.filter(
        (i) => i.debtId !== payment.debtId
      );
      if (invalidInstallments.length > 0) {
        throw new ValidationError(
          'All installments must belong to the payment debt'
        );
      }
    }

    // Execute allocation in a transaction (ACID)
    return prisma.$transaction(async (tx) => {
      const createdAllocations = [];

      for (const allocation of data.allocations) {
        const installment = installments.find(
          (i) => i.id === allocation.installmentId
        )!;

        // Check if allocation already exists
        const existingAllocation = await tx.paymentAllocation.findUnique({
          where: {
            paymentId_installmentId: {
              paymentId,
              installmentId: allocation.installmentId,
            },
          },
        });

        if (existingAllocation) {
          throw new ConflictError(
            `Allocation to installment ${installment.sequenceNo} already exists`
          );
        }

        // Create allocation record
        const newAllocation = await tx.paymentAllocation.create({
          data: {
            paymentId,
            installmentId: allocation.installmentId,
            amountApplied: allocation.amount,
          },
        });

        createdAllocations.push(newAllocation);

        // Update installment amount paid and status
        await installmentsService.applyPayment(
          allocation.installmentId,
          allocation.amount,
          tx
        );

        // Update debt balance
        await debtsService.updateBalance(
          installment.debtId,
          allocation.amount,
          tx
        );
      }

      // Return updated payment with allocations
      return tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          customer: {
            select: { id: true, fullName: true },
          },
          debt: true,
          allocations: {
            include: {
              installment: {
                select: { id: true, sequenceNo: true, amountDue: true, amountPaid: true, status: true },
              },
            },
          },
        },
      });
    });
  }

  /**
   * Reverse a payment (e.g., chargeback)
   * ACID transaction: reverses allocations and updates balances
   */
  async reverse(paymentId: string) {
    const payment = await this.findById(paymentId);

    if (payment.status === 'reversed') {
      throw new ValidationError('Payment is already reversed');
    }

    return prisma.$transaction(async (tx) => {
      // Get all allocations for this payment
      const allocations = await tx.paymentAllocation.findMany({
        where: { paymentId },
        include: { installment: true },
      });

      // Reverse each allocation
      for (const allocation of allocations) {
        // Decrease installment amount paid
        await tx.installment.update({
          where: { id: allocation.installmentId },
          data: {
            amountPaid: {
              decrement: allocation.amountApplied,
            },
            status: 'due', // Reset status (simplified, could be smarter)
          },
        });

        // Increase debt balance
        await tx.debt.update({
          where: { id: allocation.installment.debtId },
          data: {
            currentBalance: {
              increment: allocation.amountApplied,
            },
            status: 'in_collection', // Reopen debt
            closedAt: null,
          },
        });
      }

      // Delete allocations
      await tx.paymentAllocation.deleteMany({
        where: { paymentId },
      });

      // Update payment status
      return tx.payment.update({
        where: { id: paymentId },
        data: { status: 'reversed' },
        include: {
          customer: {
            select: { id: true, fullName: true },
          },
        },
      });
    });
  }
}

export default new PaymentsService();

