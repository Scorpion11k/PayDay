import { Request, Response } from 'express';
import { z } from 'zod';
import installmentsService from '../services/installments.service';
import { ValidationError, InstallmentStatus } from '../types';

// Validation schemas
const createInstallmentSchema = z.object({
  debtId: z.string().uuid('Invalid debt ID'),
  sequenceNo: z.number().int().positive('Sequence number must be positive'),
  dueDate: z.coerce.date(),
  amountDue: z.number().positive('Amount must be positive'),
});

const updateInstallmentSchema = z.object({
  dueDate: z.coerce.date().optional(),
  amountDue: z.number().positive('Amount must be positive').optional(),
  status: z.enum(['due', 'overdue', 'partially_paid', 'paid', 'canceled']).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  debtId: z.string().uuid().optional(),
  status: z.enum(['due', 'overdue', 'partially_paid', 'paid', 'canceled']).optional(),
  overdue: z.coerce.boolean().optional(),
});

class InstallmentsController {
  async getAll(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    
    const result = await installmentsService.findAll(
      { 
        debtId: query.debtId, 
        status: query.status as InstallmentStatus,
        overdue: query.overdue,
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
    const installment = await installmentsService.findById(id);

    res.json({
      success: true,
      data: installment,
    });
  }

  async create(req: Request, res: Response) {
    const validation = createInstallmentSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const installment = await installmentsService.create(validation.data);

    res.status(201).json({
      success: true,
      data: installment,
      message: 'Installment created successfully',
    });
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const validation = updateInstallmentSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const installment = await installmentsService.update(id, validation.data);

    res.json({
      success: true,
      data: installment,
      message: 'Installment updated successfully',
    });
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await installmentsService.delete(id);

    res.json({
      success: true,
      message: 'Installment deleted successfully',
    });
  }
}

export default new InstallmentsController();

