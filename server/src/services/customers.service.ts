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

export type SortField = 'fullName' | 'email' | 'status' | 'createdAt' | 'totalDebtAmount' | 'isOverdue' | 'payments';
export type SortOrder = 'asc' | 'desc';

class CustomersService {
  async findAll(
    filters: CustomerFilters = {},
    page = 1,
    limit = 20,
    sortBy?: SortField,
    sortOrder: SortOrder = 'desc'
  ) {
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

    // Determine if we can sort at database level or need to sort after fetching
    const computedFields = ['totalDebtAmount', 'isOverdue', 'payments'];
    const isComputedSort = sortBy && computedFields.includes(sortBy);

    // Build orderBy for database-level sorting
    let orderBy: Prisma.CustomerOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy && !isComputedSort) {
      orderBy = { [sortBy]: sortOrder };
    }

    // For computed fields, we need to fetch all matching records first, then sort and paginate
    const skipPagination = isComputedSort;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: skipPagination ? 0 : (page - 1) * limit,
        take: skipPagination ? undefined : limit,
        orderBy,
        include: {
          _count: {
            select: { debts: true, payments: true },
          },
          debts: {
            select: {
              currentBalance: true,
              installments: {
                where: {
                  status: 'overdue',
                },
                select: {
                  id: true,
                  dueDate: true,
                },
              },
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Calculate total debt amount, overdue status, and max overdue days for each customer
    const now = new Date();
    let customersWithStats = customers.map((customer) => {
      const totalDebtAmount = customer.debts.reduce(
        (sum, debt) => sum + Number(debt.currentBalance),
        0
      );
      
      // Find the oldest overdue installment to calculate max overdue days
      let maxOverdueDays = 0;
      for (const debt of customer.debts) {
        for (const installment of debt.installments) {
          const dueDate = new Date(installment.dueDate);
          const diffTime = now.getTime() - dueDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > maxOverdueDays) {
            maxOverdueDays = diffDays;
          }
        }
      }
      
      const hasOverdueInstallments = customer.debts.some(
        (debt) => debt.installments.length > 0
      );

      // Remove the full debts array from response, keep only stats
      const { debts, ...customerWithoutDebts } = customer;

      return {
        ...customerWithoutDebts,
        totalDebtAmount,
        isOverdue: hasOverdueInstallments,
        overdueDays: maxOverdueDays,
      };
    });

    // Sort by computed fields if needed
    if (isComputedSort && sortBy) {
      customersWithStats.sort((a, b) => {
        let aVal: number | boolean;
        let bVal: number | boolean;

        if (sortBy === 'totalDebtAmount') {
          aVal = a.totalDebtAmount;
          bVal = b.totalDebtAmount;
        } else if (sortBy === 'isOverdue') {
          aVal = a.isOverdue ? 1 : 0;
          bVal = b.isOverdue ? 1 : 0;
        } else if (sortBy === 'payments') {
          aVal = a._count.payments;
          bVal = b._count.payments;
        } else {
          return 0;
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });

      // Apply pagination after sorting
      customersWithStats = customersWithStats.slice((page - 1) * limit, page * limit);
    }

    return {
      data: customersWithStats,
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

  async deleteAll() {
    // Delete all customers and return the count
    const result = await prisma.customer.deleteMany({});
    return { deletedCount: result.count };
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

