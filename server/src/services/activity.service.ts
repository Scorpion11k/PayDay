import prisma from '../config/database';
import { ActivityType, ActivityStatus, Prisma } from '@prisma/client';

export interface CreateActivityInput {
  type: ActivityType;
  activityName: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  status: ActivityStatus;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

class ActivityService {
  async create(input: CreateActivityInput) {
    return prisma.activityLog.create({
      data: {
        type: input.type,
        activityName: input.activityName,
        description: input.description,
        customerId: input.customerId,
        customerName: input.customerName,
        status: input.status,
        metadata: input.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
        createdBy: input.createdBy,
      },
    });
  }

  async list(params: {
    page?: number;
    limit?: number;
    type?: ActivityType;
    status?: ActivityStatus;
  } = {}) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {};
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: {
            select: { id: true, fullName: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async logNotification(params: {
    channel: string;
    customerId: string;
    customerName: string;
    status: ActivityStatus;
    notificationId?: string;
    error?: string;
    createdBy: string;
  }) {
    const channelLabels: Record<string, string> = {
      sms: 'SMS Sent',
      email: 'Email Sent',
      whatsapp: 'WhatsApp Sent',
      call_task: 'Voice Call Made',
    };

    const activityName = channelLabels[params.channel] || `${params.channel} Sent`;
    const description = params.status === 'success'
      ? `${activityName} to ${params.customerName}`
      : `${activityName} to ${params.customerName} failed`;

    return this.create({
      type: 'notification_sent',
      activityName,
      description,
      customerId: params.customerId,
      customerName: params.customerName,
      status: params.status,
      metadata: {
        channel: params.channel,
        notificationId: params.notificationId,
        error: params.error,
      },
      createdBy: params.createdBy,
    });
  }

  async logChatPrompt(params: {
    query: string;
    status: ActivityStatus;
    resultCount?: number;
    error?: string;
    createdBy: string;
  }) {
    const truncatedQuery = params.query.length > 100
      ? params.query.substring(0, 100) + '...'
      : params.query;

    return this.create({
      type: 'chat_prompt',
      activityName: 'Chat Prompt',
      description: truncatedQuery,
      status: params.status,
      metadata: {
        query: params.query,
        resultCount: params.resultCount,
        error: params.error,
      },
      createdBy: params.createdBy,
    });
  }

  async logCollectionFlowCreated(params: {
    flowId: string;
    flowName: string;
    status: ActivityStatus;
    error?: string;
    createdBy: string;
  }) {
    return this.create({
      type: 'collection_flow_created',
      activityName: 'Collection Flow Created',
      description: `Flow "${params.flowName}" created`,
      status: params.status,
      metadata: {
        flowId: params.flowId,
        flowName: params.flowName,
        error: params.error,
      },
      createdBy: params.createdBy,
    });
  }
}

export default new ActivityService();
