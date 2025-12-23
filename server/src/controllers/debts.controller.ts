import { Request, Response } from 'express';
import { z } from 'zod';
import debtsService from '../services/debts.service';
import { ValidationError, DebtStatus } from '../types';

// Validation schemas
const createDebtSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  originalAmount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3, 'Currency must be 3 characters').toUpperCase(),
  status: z.enum(['open', 'in_collection', 'settled', 'written_off', 'disputed']).optional(),
});

const updateDebtSchema = z.object({
  status: z.enum(['open', 'in_collection', 'settled', 'written_off', 'disputed']).optional(),
  closedAt: z.coerce.date().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  customerId: z.string().uuid().optional(),
  status: z.enum(['open', 'in_collection', 'settled', 'written_off', 'disputed']).optional(),
});

class DebtsController {
  async getAll(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    
    const result = await debtsService.findAll(
      { customerId: query.customerId, status: query.status as DebtStatus },
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
    const debt = await debtsService.findById(id);

    res.json({
      success: true,
      data: debt,
    });
  }

  async create(req: Request, res: Response) {
    const validation = createDebtSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const debt = await debtsService.create(validation.data);

    res.status(201).json({
      success: true,
      data: debt,
      message: 'Debt created successfully',
    });
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const validation = updateDebtSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const debt = await debtsService.update(id, validation.data);

    res.json({
      success: true,
      data: debt,
      message: 'Debt updated successfully',
    });
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await debtsService.delete(id);

    res.json({
      success: true,
      message: 'Debt deleted successfully',
    });
  }
}

export default new DebtsController();

