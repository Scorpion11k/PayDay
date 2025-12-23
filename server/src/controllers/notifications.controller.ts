import { Request, Response } from 'express';
import { z } from 'zod';
import notificationsService from '../services/notifications.service';
import { ValidationError, NotificationChannel, DeliveryStatus } from '../types';

// Validation schemas
const createNotificationSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  debtId: z.string().uuid('Invalid debt ID').optional(),
  installmentId: z.string().uuid('Invalid installment ID').optional(),
  channel: z.enum(['sms', 'email', 'whatsapp', 'call_task']),
  templateKey: z.string().min(1, 'Template key is required'),
  payloadSnapshot: z.record(z.string(), z.unknown()),
  createdBy: z.string().min(1, 'Created by is required'),
});

const createDeliverySchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  providerMessageId: z.string().optional(),
  status: z.enum(['queued', 'sent', 'delivered', 'failed']).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  sentAt: z.coerce.date().optional(),
});

const updateDeliveryStatusSchema = z.object({
  status: z.enum(['queued', 'sent', 'delivered', 'failed']),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customerId: z.string().uuid().optional(),
  debtId: z.string().uuid().optional(),
  channel: z.enum(['sms', 'email', 'whatsapp', 'call_task']).optional(),
});

class NotificationsController {
  async getAll(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    
    const result = await notificationsService.findAll(
      {
        customerId: query.customerId,
        debtId: query.debtId,
        channel: query.channel as NotificationChannel,
      },
      query.page,
      query.limit
    );

    res.json({
      success: true,
      ...result,
    });
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const notification = await notificationsService.findById(id);

    res.json({
      success: true,
      data: notification,
    });
  }

  async create(req: Request, res: Response) {
    const validation = createNotificationSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const notification = await notificationsService.create(validation.data);

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification created successfully',
    });
  }

  async createDeliveryAttempt(req: Request, res: Response) {
    const { id } = req.params;
    const validation = createDeliverySchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const delivery = await notificationsService.createDeliveryAttempt(id, validation.data);

    res.status(201).json({
      success: true,
      data: delivery,
      message: 'Delivery attempt recorded',
    });
  }

  async updateDeliveryStatus(req: Request, res: Response) {
    const { deliveryId } = req.params;
    const validation = updateDeliveryStatusSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const delivery = await notificationsService.updateDeliveryStatus(
      deliveryId,
      validation.data.status as DeliveryStatus,
      validation.data.errorCode,
      validation.data.errorMessage
    );

    res.json({
      success: true,
      data: delivery,
      message: 'Delivery status updated',
    });
  }

  async getDeliveryHistory(req: Request, res: Response) {
    const { id } = req.params;
    const deliveries = await notificationsService.getDeliveryHistory(id);

    res.json({
      success: true,
      data: deliveries,
    });
  }

  async getPendingDeliveries(req: Request, res: Response) {
    const deliveries = await notificationsService.getPendingDeliveries();

    res.json({
      success: true,
      data: deliveries,
    });
  }

  async getCustomerStats(req: Request, res: Response) {
    const { customerId } = req.params;
    const stats = await notificationsService.getCustomerStats(customerId);

    res.json({
      success: true,
      data: stats,
    });
  }
}

export default new NotificationsController();

