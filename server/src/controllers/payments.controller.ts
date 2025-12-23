import { Request, Response } from 'express';
import { z } from 'zod';
import paymentsService from '../services/payments.service';
import { ValidationError, PaymentStatus } from '../types';

// Validation schemas
const createPaymentSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  debtId: z.string().uuid('Invalid debt ID').optional(),
  receivedAt: z.coerce.date(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').toUpperCase(),
  method: z.enum(['bank_transfer', 'card', 'cash', 'check', 'other']),
  providerTxnId: z.string().optional(),
  rawProviderPayload: z.record(z.string(), z.unknown()).optional(),
});

const allocatePaymentSchema = z.object({
  allocations: z.array(
    z.object({
      installmentId: z.string().uuid('Invalid installment ID'),
      amount: z.number().positive('Amount must be positive'),
    })
  ).min(1, 'At least one allocation required'),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customerId: z.string().uuid().optional(),
  debtId: z.string().uuid().optional(),
  status: z.enum(['received', 'reversed', 'failed']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

class PaymentsController {
  async getAll(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    
    const result = await paymentsService.findAll(
      {
        customerId: query.customerId,
        debtId: query.debtId,
        status: query.status as PaymentStatus,
        startDate: query.startDate,
        endDate: query.endDate,
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
    const payment = await paymentsService.findById(id);

    res.json({
      success: true,
      data: payment,
    });
  }

  async create(req: Request, res: Response) {
    const validation = createPaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const payment = await paymentsService.create(validation.data);

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment recorded successfully',
    });
  }

  async allocate(req: Request, res: Response) {
    const { id } = req.params;
    const validation = allocatePaymentSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const payment = await paymentsService.allocate(id, validation.data);

    res.json({
      success: true,
      data: payment,
      message: 'Payment allocated successfully',
    });
  }

  async reverse(req: Request, res: Response) {
    const { id } = req.params;
    const payment = await paymentsService.reverse(id);

    res.json({
      success: true,
      data: payment,
      message: 'Payment reversed successfully',
    });
  }
}

export default new PaymentsController();

