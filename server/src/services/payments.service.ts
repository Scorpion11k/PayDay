import prisma from '../config/database';
import { PaymentStatus, PaymentMethod, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../types';
import debtsService from './debts.service';
import installmentsService from './installments.service';
import paymentLinkService from './payment-link.service';
import flowRuntimeService from './flow-runtime.service';

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

export interface PaymentLinkPreviewDto {
  token: string;
  status: 'ready' | 'already_paid';
  customer: {
    id: string;
    fullName: string;
  };
  debt: {
    id: string;
    invoiceNumber: string;
    status: string;
  };
  amount: number;
  currency: string;
  existingPayment: {
    id: string;
    amount: number;
    currency: string;
    receivedAt: Date;
  } | null;
}

export interface PaymentLinkCompletionDto {
  status: 'paid' | 'already_paid';
  customer: {
    id: string;
    fullName: string;
  };
  debt: {
    id: string;
    invoiceNumber: string;
    status: string;
    amountPaid: number;
    remainingBalance: number;
    currency: string;
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    method: PaymentMethod;
    receivedAt: Date;
  } | null;
}

type DbClient = Prisma.TransactionClient | typeof prisma;

interface PaymentLinkContext {
  token: string;
  providerTxnId: string;
  notificationId?: string;
  customer: {
    id: string;
    fullName: string;
  };
  debt: {
    id: string;
    customerId: string;
    currentBalance: Prisma.Decimal;
    currency: string;
    status: string;
    installments: Array<{
      id: string;
      dueDate: Date;
      sequenceNo: number;
      amountDue: Prisma.Decimal;
      amountPaid: Prisma.Decimal;
      status: string;
    }>;
  };
  existingPayment: {
    id: string;
    amount: Prisma.Decimal;
    currency: string;
    receivedAt: Date;
    method: PaymentMethod;
  } | null;
}

class PaymentsService {
  private formatInvoiceNumber(debtId: string) {
    return debtId.slice(0, 8).toUpperCase();
  }

  private mapLinkPreview(context: PaymentLinkContext): PaymentLinkPreviewDto {
    const amount = Number(context.debt.currentBalance);

    return {
      token: context.token,
      status: amount <= 0 || ['settled', 'written_off'].includes(context.debt.status)
        ? 'already_paid'
        : 'ready',
      customer: context.customer,
      debt: {
        id: context.debt.id,
        invoiceNumber: this.formatInvoiceNumber(context.debt.id),
        status: context.debt.status,
      },
      amount,
      currency: context.debt.currency,
      existingPayment: context.existingPayment
        ? {
            id: context.existingPayment.id,
            amount: Number(context.existingPayment.amount),
            currency: context.existingPayment.currency,
            receivedAt: context.existingPayment.receivedAt,
          }
        : null,
    };
  }

  private mapLinkCompletion(
    context: Pick<PaymentLinkContext, 'customer' | 'debt'>,
    payment: {
      id: string;
      amount: Prisma.Decimal;
      currency: string;
      method: PaymentMethod;
      receivedAt: Date;
    } | null,
    status: 'paid' | 'already_paid',
    amountPaid: number,
    remainingBalance: number
  ): PaymentLinkCompletionDto {
    return {
      status,
      customer: context.customer,
      debt: {
        id: context.debt.id,
        invoiceNumber: this.formatInvoiceNumber(context.debt.id),
        status: remainingBalance === 0 ? 'settled' : context.debt.status,
        amountPaid,
        remainingBalance,
        currency: context.debt.currency,
      },
      payment: payment
        ? {
            id: payment.id,
            amount: Number(payment.amount),
            currency: payment.currency,
            method: payment.method,
            receivedAt: payment.receivedAt,
          }
        : null,
    };
  }

  private async resolvePaymentLink(token: string, db: DbClient = prisma): Promise<PaymentLinkContext> {
    const payload = paymentLinkService.parseToken(token);
    const providerTxnId = paymentLinkService.buildProviderTxnId(token, payload.notificationId);

    const customer = await db.customer.findUnique({
      where: { id: payload.customerId },
      select: {
        id: true,
        fullName: true,
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    const debt = payload.debtId
      ? await db.debt.findUnique({
          where: { id: payload.debtId },
          include: {
            installments: {
              orderBy: [{ dueDate: 'asc' }, { sequenceNo: 'asc' }],
            },
          },
        })
      : await db.debt.findFirst({
          where: {
            customerId: payload.customerId,
            status: { in: ['open', 'in_collection', 'settled'] },
          },
          include: {
            installments: {
              orderBy: [{ dueDate: 'asc' }, { sequenceNo: 'asc' }],
            },
          },
          orderBy: [{ updatedAt: 'desc' }],
        });

    if (!debt) {
      throw new NotFoundError('Debt');
    }

    if (debt.customerId !== customer.id) {
      throw new ValidationError('Payment link does not match the requested debt');
    }

    const existingPayment = await db.payment.findUnique({
      where: { providerTxnId },
      select: {
        id: true,
        amount: true,
        currency: true,
        receivedAt: true,
        method: true,
      },
    });

    return {
      token,
      providerTxnId,
      notificationId: payload.notificationId,
      customer,
      debt: {
        id: debt.id,
        customerId: debt.customerId,
        currentBalance: debt.currentBalance,
        currency: debt.currency,
        status: debt.status,
        installments: debt.installments.map((installment) => ({
          id: installment.id,
          dueDate: installment.dueDate,
          sequenceNo: installment.sequenceNo,
          amountDue: installment.amountDue,
          amountPaid: installment.amountPaid,
          status: installment.status,
        })),
      },
      existingPayment,
    };
  }

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

  async getPaymentLinkPreview(token: string) {
    const context = await this.resolvePaymentLink(token);
    return this.mapLinkPreview(context);
  }

  async completeFromLink(token: string) {
    const existingContext = await this.resolvePaymentLink(token);
    const existingBalance = Number(existingContext.debt.currentBalance);

    if (existingContext.existingPayment) {
      await flowRuntimeService.completeRunningIfPaid(existingContext.customer.id);
      return this.mapLinkCompletion(
        existingContext,
        existingContext.existingPayment,
        'already_paid',
        Number(existingContext.existingPayment.amount),
        Math.max(0, existingBalance - Number(existingContext.existingPayment.amount))
      );
    }

    if (existingBalance <= 0 || ['settled', 'written_off'].includes(existingContext.debt.status)) {
      await flowRuntimeService.completeRunningIfPaid(existingContext.customer.id);
      return this.mapLinkCompletion(existingContext, null, 'already_paid', 0, 0);
    }

    try {
      return await prisma.$transaction(async (tx) => {
        const context = await this.resolvePaymentLink(token, tx);
        const amountToPay = Number(context.debt.currentBalance);

        if (context.existingPayment) {
          return this.mapLinkCompletion(
            context,
            context.existingPayment,
            'already_paid',
            Number(context.existingPayment.amount),
            Math.max(0, amountToPay - Number(context.existingPayment.amount))
          );
        }

        if (amountToPay <= 0 || ['settled', 'written_off'].includes(context.debt.status)) {
          await flowRuntimeService.completeRunningIfPaid(context.customer.id, tx);
          return this.mapLinkCompletion(context, null, 'already_paid', 0, 0);
        }

        const payment = await tx.payment.create({
          data: {
            customerId: context.customer.id,
            debtId: context.debt.id,
            receivedAt: new Date(),
            amount: amountToPay,
            currency: context.debt.currency,
            method: 'card',
            providerTxnId: context.providerTxnId,
            rawProviderPayload: {
              source: 'payment_link',
              notificationId: context.notificationId || null,
            },
            status: 'received',
          },
          select: {
            id: true,
            amount: true,
            currency: true,
            method: true,
            receivedAt: true,
          },
        });

        let remainingAmount = amountToPay;
        const outstandingInstallments = context.debt.installments.filter((installment) => {
          const outstanding = Number(installment.amountDue) - Number(installment.amountPaid);
          return outstanding > 0 && ['due', 'overdue', 'partially_paid'].includes(installment.status);
        });

        for (const installment of outstandingInstallments) {
          if (remainingAmount <= 0) {
            break;
          }

          const outstanding = Number(installment.amountDue) - Number(installment.amountPaid);
          const amountApplied = Math.min(remainingAmount, outstanding);

          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              installmentId: installment.id,
              amountApplied,
            },
          });

          await installmentsService.applyPayment(installment.id, amountApplied, tx);
          await debtsService.updateBalance(context.debt.id, amountApplied, tx);

          remainingAmount -= amountApplied;
        }

        if (remainingAmount > 0) {
          await debtsService.updateBalance(context.debt.id, remainingAmount, tx);
        }

        await flowRuntimeService.completeRunningIfPaid(context.customer.id, tx);

        const updatedDebt = await tx.debt.findUniqueOrThrow({
          where: { id: context.debt.id },
          select: {
            id: true,
            status: true,
            currentBalance: true,
            currency: true,
          },
        });

        return this.mapLinkCompletion(
          {
            ...context,
            debt: {
              ...context.debt,
              status: updatedDebt.status,
              currentBalance: updatedDebt.currentBalance,
              currency: updatedDebt.currency,
            },
          },
          payment,
          'paid',
          amountToPay,
          Number(updatedDebt.currentBalance)
        );
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const retryContext = await this.resolvePaymentLink(token);
        await flowRuntimeService.completeRunningIfPaid(retryContext.customer.id);
        return this.mapLinkCompletion(
          retryContext,
          retryContext.existingPayment,
          'already_paid',
          retryContext.existingPayment ? Number(retryContext.existingPayment.amount) : 0,
          Number(retryContext.debt.currentBalance)
        );
      }

      throw error;
    }
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

