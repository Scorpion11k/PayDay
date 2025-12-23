import prisma from '../config/database';
import { CustomerStatus, Prisma } from '@prisma/client';
import { NotFoundError } from '../types';

export interface CreateCustomerDto {
  fullName: string;
  externalRef?: string;
  phone?: string;
  email?: string;
  status?: CustomerStatus;
}

export interface UpdateCustomerDto {
  fullName?: string;
  externalRef?: string;
  phone?: string;
  email?: string;
  status?: CustomerStatus;
}

export interface CustomerFilters {
  status?: CustomerStatus;
  search?: string;
}

class CustomersService {
  async findAll(filters: CustomerFilters = {}, page = 1, limit = 20) {
    const where: Prisma.CustomerWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { externalRef: { contains: filters.search } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { debts: true, payments: true },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        debts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        payments: {
          orderBy: { receivedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { debts: true, payments: true, notifications: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    return customer;
  }

  async create(data: CreateCustomerDto) {
    return prisma.customer.create({
      data: {
        fullName: data.fullName,
        externalRef: data.externalRef,
        phone: data.phone,
        email: data.email,
        status: data.status || 'active',
      },
    });
  }

  async update(id: string, data: UpdateCustomerDto) {
    // Check if customer exists
    await this.findById(id);

    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Check if customer exists
    await this.findById(id);

    return prisma.customer.delete({
      where: { id },
    });
  }

  async getStats(id: string) {
    const customer = await this.findById(id);

    const [debtsStats, paymentsStats] = await Promise.all([
      prisma.debt.aggregate({
        where: { customerId: id },
        _sum: { originalAmount: true, currentBalance: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { customerId: id, status: 'received' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      customer,
      stats: {
        totalDebts: debtsStats._count,
        totalOriginalAmount: debtsStats._sum.originalAmount || 0,
        totalOutstandingBalance: debtsStats._sum.currentBalance || 0,
        totalPayments: paymentsStats._count,
        totalPaid: paymentsStats._sum.amount || 0,
      },
    };
  }
}

export default new CustomersService();

