import prisma from '../config/database';
import { NotificationChannel, DeliveryStatus, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../types';

export interface CreateNotificationDto {
  customerId: string;
  debtId?: string;
  installmentId?: string;
  channel: NotificationChannel;
  templateKey: string;
  payloadSnapshot: Record<string, unknown>;
  createdBy: string;
}

export interface CreateDeliveryAttemptDto {
  provider: string;
  providerMessageId?: string;
  status?: DeliveryStatus;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: Date;
}

export interface NotificationFilters {
  customerId?: string;
  debtId?: string;
  channel?: NotificationChannel;
}

class NotificationsService {
  async findAll(filters: NotificationFilters = {}, page = 1, limit = 20) {
    const where: Prisma.NotificationWhereInput = {};

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.debtId) {
      where.debtId = filters.debtId;
    }

    if (filters.channel) {
      where.channel = filters.channel;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          debt: {
            select: { id: true, originalAmount: true, currency: true },
          },
          installment: {
            select: { id: true, sequenceNo: true, dueDate: true, amountDue: true },
          },
          deliveries: {
            orderBy: { attemptNo: 'desc' },
            take: 1,
          },
          _count: {
            select: { deliveries: true },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        debt: true,
        installment: true,
        deliveries: {
          orderBy: { attemptNo: 'asc' },
        },
      },
    });

    if (!notification) {
      throw new NotFoundError('Notification');
    }

    return notification;
  }

  async create(data: CreateNotificationDto) {
    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Check customer contact status
    if (customer.status === 'do_not_contact') {
      throw new ValidationError('Customer has opted out of contact');
    }

    if (customer.status === 'blocked') {
      throw new ValidationError('Customer is blocked');
    }

    // Validate debt if provided
    if (data.debtId) {
      const debt = await prisma.debt.findUnique({
        where: { id: data.debtId },
      });

      if (!debt) {
        throw new NotFoundError('Debt');
      }

      if (debt.customerId !== data.customerId) {
        throw new ValidationError('Debt does not belong to this customer');
      }
    }

    // Validate installment if provided
    if (data.installmentId) {
      const installment = await prisma.installment.findUnique({
        where: { id: data.installmentId },
        include: { debt: true },
      });

      if (!installment) {
        throw new NotFoundError('Installment');
      }

      if (data.debtId && installment.debtId !== data.debtId) {
        throw new ValidationError('Installment does not belong to the specified debt');
      }
    }

    return prisma.notification.create({
      data: {
        customerId: data.customerId,
        debtId: data.debtId,
        installmentId: data.installmentId,
        channel: data.channel,
        templateKey: data.templateKey,
        payloadSnapshot: data.payloadSnapshot as Prisma.InputJsonValue,
        createdBy: data.createdBy,
      },
      include: {
        customer: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async createDeliveryAttempt(notificationId: string, data: CreateDeliveryAttemptDto) {
    const notification = await this.findById(notificationId);

    // Get the next attempt number
    const lastAttempt = await prisma.notificationDelivery.findFirst({
      where: { notificationId },
      orderBy: { attemptNo: 'desc' },
    });

    const attemptNo = (lastAttempt?.attemptNo || 0) + 1;

    return prisma.notificationDelivery.create({
      data: {
        notificationId,
        attemptNo,
        provider: data.provider,
        providerMessageId: data.providerMessageId,
        status: data.status || 'queued',
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        sentAt: data.sentAt,
      },
      include: {
        notification: {
          select: { id: true, channel: true, templateKey: true },
        },
      },
    });
  }

  async updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    errorCode?: string,
    errorMessage?: string
  ) {
    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new NotFoundError('Notification delivery');
    }

    return prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        errorCode,
        errorMessage,
        sentAt: status === 'sent' || status === 'delivered' ? new Date() : undefined,
      },
    });
  }

  async getDeliveryHistory(notificationId: string) {
    await this.findById(notificationId);

    return prisma.notificationDelivery.findMany({
      where: { notificationId },
      orderBy: { attemptNo: 'asc' },
    });
  }

  // Get notifications pending delivery
  async getPendingDeliveries() {
    return prisma.notificationDelivery.findMany({
      where: {
        status: 'queued',
      },
      include: {
        notification: {
          include: {
            customer: {
              select: { id: true, fullName: true, email: true, phone: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Get notification statistics for a customer
  async getCustomerStats(customerId: string) {
    const [total, byChannel, byStatus] = await Promise.all([
      prisma.notification.count({ where: { customerId } }),
      prisma.notification.groupBy({
        by: ['channel'],
        where: { customerId },
        _count: true,
      }),
      prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: {
          notification: { customerId },
        },
        _count: true,
      }),
    ]);

    return {
      total,
      byChannel: byChannel.reduce((acc, item) => {
        acc[item.channel] = item._count;
        return acc;
      }, {} as Record<string, number>),
      deliveryStats: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export default new NotificationsService();

