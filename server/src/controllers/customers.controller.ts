import { Request, Response } from 'express';
import { z } from 'zod';
import customersService from '../services/customers.service';
import { recommendChannelByAge } from '../services/preference.service';
import prisma from '../config/database';
import { ValidationError, CustomerStatus } from '../types';

// Validation schemas
const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  externalRef: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email format').optional(),
  status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  dateOfBirth: z.string().optional(),
  region: z.string().max(255).optional(),
  religion: z.string().max(100).optional(),
  preferredChannel: z.enum(['email', 'sms', 'whatsapp', 'call_task']).optional(),
  preferredLanguage: z.enum(['en', 'he', 'ar']).optional(),
  preferredTone: z.enum(['calm', 'medium', 'heavy']).optional(),
});

const updateCustomerSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  externalRef: z.string().max(255).nullish(),
  phone: z.string().max(50).nullish(),
  email: z.union([z.string().email('Invalid email format'), z.literal(''), z.null()]).optional(),
  status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullish(),
  dateOfBirth: z.string().nullish(),
  region: z.string().max(255).nullish(),
  religion: z.string().max(100).nullish(),
  preferredChannel: z.enum(['email', 'sms', 'whatsapp', 'call_task']).nullish(),
  preferredLanguage: z.enum(['en', 'he', 'ar']).nullish(),
  preferredTone: z.enum(['calm', 'medium', 'heavy']).nullish(),
});

const bulkUpdateChannelSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(500),
  preferredChannel: z.enum(['email', 'sms', 'whatsapp', 'call_task', 'auto']),
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

    // Pass through all validated data including null values
    // The service will handle null vs undefined appropriately
    const customer = await customersService.update(id, validation.data);

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

  async deleteAll(req: Request, res: Response) {
    const result = await customersService.deleteAll();

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} customers`,
      data: result,
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

  async bulkUpdateChannel(req: Request, res: Response) {
    const validation = bulkUpdateChannelSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const { customerIds, preferredChannel } = validation.data;

    if (preferredChannel !== 'auto') {
      const result = await prisma.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { preferredChannel },
      });

      const failed = customerIds.length - result.count;
      res.json({
        success: true,
        data: { updated: result.count, failed: failed < 0 ? 0 : failed },
        message: 'Bulk channel update completed',
      });
      return;
    }

    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, dateOfBirth: true },
    });

    let updated = 0;
    let failed = 0;

    for (const customer of customers) {
      const recommended = recommendChannelByAge(customer.dateOfBirth);
      try {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { preferredChannel: recommended },
        });
        updated++;
      } catch {
        failed++;
      }
    }

    const missing = customerIds.length - customers.length;
    failed += missing > 0 ? missing : 0;

    res.json({
      success: true,
      data: { updated, failed },
      message: 'Bulk channel update completed',
    });
  }
}

export default new CustomersController();
