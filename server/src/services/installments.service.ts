import prisma from '../config/database';
import { InstallmentStatus, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../types';

export interface CreateInstallmentDto {
  debtId: string;
  sequenceNo: number;
  dueDate: Date;
  amountDue: number;
}

export interface UpdateInstallmentDto {
  dueDate?: Date;
  amountDue?: number;
  status?: InstallmentStatus;
}

export interface InstallmentFilters {
  debtId?: string;
  status?: InstallmentStatus;
  overdue?: boolean;
}

class InstallmentsService {
  async findAll(filters: InstallmentFilters = {}, page = 1, limit = 20) {
    const where: Prisma.InstallmentWhereInput = {};

    if (filters.debtId) {
      where.debtId = filters.debtId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { in: ['due', 'partially_paid'] };
    }

    const [installments, total] = await Promise.all([
      prisma.installment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ dueDate: 'asc' }, { sequenceNo: 'asc' }],
        include: {
          debt: {
            select: {
              id: true,
              currency: true,
              customer: {
                select: { id: true, fullName: true },
              },
            },
          },
        },
      }),
      prisma.installment.count({ where }),
    ]);

    return {
      data: installments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const installment = await prisma.installment.findUnique({
      where: { id },
      include: {
        debt: {
          include: {
            customer: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        },
        paymentAllocations: {
          include: {
            payment: {
              select: { id: true, amount: true, receivedAt: true, method: true },
            },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundError('Installment');
    }

    return installment;
  }

  async create(data: CreateInstallmentDto) {
    // Validate debt exists
    const debt = await prisma.debt.findUnique({
      where: { id: data.debtId },
    });

    if (!debt) {
      throw new NotFoundError('Debt');
    }

    // Check for duplicate sequence number
    const existing = await prisma.installment.findUnique({
      where: {
        debtId_sequenceNo: {
          debtId: data.debtId,
          sequenceNo: data.sequenceNo,
        },
      },
    });

    if (existing) {
      throw new ValidationError(`Installment with sequence ${data.sequenceNo} already exists for this debt`);
    }

    return prisma.installment.create({
      data: {
        debtId: data.debtId,
        sequenceNo: data.sequenceNo,
        dueDate: data.dueDate,
        amountDue: data.amountDue,
        status: new Date(data.dueDate) < new Date() ? 'overdue' : 'due',
      },
      include: {
        debt: {
          select: { id: true, currency: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateInstallmentDto) {
    await this.findById(id);

    const updateData: Prisma.InstallmentUpdateInput = {};

    if (data.dueDate) {
      updateData.dueDate = data.dueDate;
    }

    if (data.amountDue !== undefined) {
      updateData.amountDue = data.amountDue;
    }

    if (data.status) {
      updateData.status = data.status;
    }

    return prisma.installment.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return prisma.installment.delete({
      where: { id },
    });
  }

  // Apply payment to installment (called within transaction)
  async applyPayment(
    id: string,
    amount: number,
    tx: Prisma.TransactionClient
  ) {
    const installment = await tx.installment.findUnique({ where: { id } });

    if (!installment) {
      throw new NotFoundError('Installment');
    }

    const currentPaid = Number(installment.amountPaid);
    const amountDue = Number(installment.amountDue);
    const newAmountPaid = currentPaid + amount;
    const remaining = amountDue - newAmountPaid;

    if (remaining < 0) {
      throw new ValidationError('Payment exceeds installment amount due');
    }

    let newStatus: InstallmentStatus;
    if (remaining === 0) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = installment.status;
    }

    return tx.installment.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
      },
    });
  }

  // Get overdue installments for a customer
  async getOverdueByCustomer(customerId: string) {
    return prisma.installment.findMany({
      where: {
        debt: { customerId },
        dueDate: { lt: new Date() },
        status: { in: ['due', 'partially_paid', 'overdue'] },
      },
      include: {
        debt: {
          select: { id: true, currency: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
}

export default new InstallmentsService();

