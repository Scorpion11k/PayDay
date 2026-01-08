import { Request, Response } from 'express';
import { z } from 'zod';
import customersService from '../services/customers.service';
import { ValidationError, CustomerStatus } from '../types';

// Validation schemas
const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  externalRef: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email format').optional(),
  status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
});

const updateCustomerSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  externalRef: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email('Invalid email format').nullable().optional(),
  status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['fullName', 'email', 'status', 'createdAt', 'totalDebtAmount', 'isOverdue', 'payments']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

class CustomersController {
  async getAll(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    
    const result = await customersService.findAll(
      { status: query.status as CustomerStatus, search: query.search },
      query.page,
      query.limit,
      query.sortBy,
      query.sortOrder
    );

    res.json({
      success: true,
      ...result,
    });
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const customer = await customersService.findById(id);

    res.json({
      success: true,
      data: customer,
    });
  }

  async create(req: Request, res: Response) {
    const validation = createCustomerSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const customer = await customersService.create(validation.data);

    res.status(201).json({
      success: true,
      data: customer,
      message: 'Customer created successfully',
    });
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const validation = updateCustomerSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    // Transform null values to undefined for the service
    const data = {
      ...validation.data,
      externalRef: validation.data.externalRef ?? undefined,
      phone: validation.data.phone ?? undefined,
      email: validation.data.email ?? undefined,
    };

    const customer = await customersService.update(id, data);

    res.json({
      success: true,
      data: customer,
      message: 'Customer updated successfully',
    });
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await customersService.delete(id);

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  }

  async getStats(req: Request, res: Response) {
    const { id } = req.params;
    const stats = await customersService.getStats(id);

    res.json({
      success: true,
      data: stats,
    });
  }
}

export default new CustomersController();

