import prisma from '../config/database';
import { DebtStatus, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../types';

// Use Prisma.Decimal for type, create with string/number
type Decimal = Prisma.Decimal;

export interface CreateDebtDto {
  customerId: string;
  originalAmount: number;
  currency: string;
  status?: DebtStatus;
}

export interface UpdateDebtDto {
  status?: DebtStatus;
  closedAt?: Date;
}

export interface DebtFilters {
  customerId?: string;
  status?: DebtStatus;
}

class DebtsService {
  async findAll(filters: DebtFilters = {}, page = 1, limit = 20) {
    const where: Prisma.DebtWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const [debts, total] = await Promise.all([
      prisma.debt.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          _count: {
            select: { installments: true, payments: true },
          },
        },
      }),
      prisma.debt.count({ where }),
    ]);

    return {
      data: debts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const debt = await prisma.debt.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        installments: {
          orderBy: { sequenceNo: 'asc' },
        },
        payments: {
          orderBy: { receivedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!debt) {
      throw new NotFoundError('Debt');
    }

    return debt;
  }

  async create(data: CreateDebtDto) {
    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Validate currency code (ISO 4217)
    if (!/^[A-Z]{3}$/.test(data.currency)) {
      throw new ValidationError('Currency must be a valid 3-letter ISO code');
    }

    return prisma.debt.create({
      data: {
        customerId: data.customerId,
        originalAmount: data.originalAmount,
        currentBalance: data.originalAmount,
        currency: data.currency,
        status: data.status || 'open',
      },
      include: {
        customer: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async update(id: string, data: UpdateDebtDto) {
    await this.findById(id);

    const updateData: Prisma.DebtUpdateInput = {};

    if (data.status) {
      updateData.status = data.status;
      
      // Auto-set closedAt when settling or writing off
      if (['settled', 'written_off'].includes(data.status)) {
        updateData.closedAt = new Date();
      }
    }

    if (data.closedAt) {
      updateData.closedAt = data.closedAt;
    }

    return prisma.debt.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return prisma.debt.delete({
      where: { id },
    });
  }

  // Update balance after payment allocation (called within transaction)
  async updateBalance(id: string, amountPaid: number, tx: Prisma.TransactionClient) {
    const debt = await tx.debt.findUnique({ where: { id } });
    
    if (!debt) {
      throw new NotFoundError('Debt');
    }

    const currentBalance = Number(debt.currentBalance);
    const newBalance = currentBalance - amountPaid;
    
    if (newBalance < 0) {
      throw new ValidationError('Payment exceeds outstanding balance');
    }

    const updateData: Prisma.DebtUpdateInput = {
      currentBalance: newBalance,
    };

    // Auto-settle if balance reaches zero
    if (newBalance === 0) {
      updateData.status = 'settled';
      updateData.closedAt = new Date();
    }

    return tx.debt.update({
      where: { id },
      data: updateData,
    });
  }
}

export default new DebtsService();

