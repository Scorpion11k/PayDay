import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import customersService from '../services/customers.service';
import flowExecutorService from '../services/flow-executor.service';
import flowRuntimeService from '../services/flow-runtime.service';
import homeBrainService from '../services/home-brain/home-brain.service';
import { recommendChannelByAge } from '../services/preference.service';
import prisma from '../config/database';
import { ValidationError, CustomerStatus } from '../types';

// Validation schemas
const productSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
});

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
  products: z.array(productSchema).optional(),
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
  products: z.array(productSchema).optional(),
});

const bulkUpdateChannelSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(500),
  preferredChannel: z.enum(['email', 'sms', 'whatsapp', 'call_task', 'auto']),
});

const startCollectionFlowSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(500).optional(),
  selectAll: z.boolean().optional(),
  excludedCustomerIds: z.array(z.string().uuid()).optional(),
  filters: z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
  }).optional(),
}).refine((data) => data.selectAll || (data.customerIds && data.customerIds.length > 0), {
  message: 'Select all or provide at least one customer',
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['active', 'do_not_contact', 'blocked']).optional(),
  search: z.string().optional(),
  customerIds: z.string().optional(),
  sortBy: z.enum(['fullName', 'email', 'status', 'createdAt', 'totalDebtAmount', 'isOverdue', 'payments']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

type StartCollectionFlowInput = z.infer<typeof startCollectionFlowSchema>;

class CustomersController {
  private buildCustomerSelectionWhere(selection: StartCollectionFlowInput): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {};

    if (selection.selectAll) {
      if (selection.filters?.status) {
        where.status = selection.filters.status;
      }

      if (selection.filters?.search) {
        where.OR = [
          { fullName: { contains: selection.filters.search, mode: 'insensitive' } },
          { email: { contains: selection.filters.search, mode: 'insensitive' } },
          { phone: { contains: selection.filters.search } },
          { externalRef: { contains: selection.filters.search } },
        ];
      }

      if (selection.excludedCustomerIds && selection.excludedCustomerIds.length > 0) {
        where.NOT = { id: { in: selection.excludedCustomerIds } };
      }

      return where;
    }

    return {
      id: {
        in: selection.customerIds || [],
      },
    };
  }

  private async executeCollectionFlowStart(selection: StartCollectionFlowInput) {
    const where = this.buildCustomerSelectionWhere(selection);
    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        fullName: true,
      },
    });

    const details: Array<{
      customerId: string;
      customerName: string | null;
      outcome: 'triggered' | 'failed' | 'skipped';
      lifecycle: 'started' | 'already_running' | null;
      instanceId: string | null;
      status: 'running' | 'completed_paid' | 'completed_end' | 'failed' | null;
      currentStateName: string | null;
      error: string | null;
    }> = [];

    const results = {
      triggered: 0,
      started: 0,
      alreadyRunning: 0,
      completed: 0,
      running: 0,
      failed: 0,
      skipped: 0,
      executor: {
        scanned: 0,
        claimed: 0,
        completedPaid: 0,
        completedEnd: 0,
        advanced: 0,
        failed: 0,
        retried: 0,
        skipped: 0,
      },
      details,
    };

    if (!selection.selectAll && selection.customerIds) {
      const foundIds = new Set(customers.map((customer) => customer.id));
      for (const customerId of selection.customerIds) {
        if (!foundIds.has(customerId)) {
          results.failed++;
          details.push({
            customerId,
            customerName: null,
            outcome: 'failed',
            lifecycle: null,
            instanceId: null,
            status: null,
            currentStateName: null,
            error: 'Customer not found',
          });
        }
      }
    }

    flowExecutorService.startPoller();

    for (const customer of customers) {
      const startResult = await flowRuntimeService.startCollectionFlowForCustomer(customer.id);

      if (startResult.reason === 'no_open_debt') {
        results.skipped++;
        details.push({
          customerId: customer.id,
          customerName: customer.fullName,
          outcome: 'skipped',
          lifecycle: null,
          instanceId: null,
          status: null,
          currentStateName: null,
          error: 'Customer has no open debt to collect',
        });
        continue;
      }

      if (!startResult.instance) {
        results.failed++;
        details.push({
          customerId: customer.id,
          customerName: customer.fullName,
          outcome: 'failed',
          lifecycle: null,
          instanceId: null,
          status: null,
          currentStateName: null,
          error: 'No published collection flow is assigned or available',
        });
        continue;
      }

      const executorResult = await flowExecutorService.runInstanceUntilIdle(startResult.instance.id);
      results.executor.scanned += executorResult.scanned;
      results.executor.claimed += executorResult.claimed;
      results.executor.completedPaid += executorResult.completedPaid;
      results.executor.completedEnd += executorResult.completedEnd;
      results.executor.advanced += executorResult.advanced;
      results.executor.failed += executorResult.failed;
      results.executor.retried += executorResult.retried;
      results.executor.skipped += executorResult.skipped;

      const runtime = await prisma.collectionFlowInstance.findUnique({
        where: { id: startResult.instance.id },
        select: {
          id: true,
          status: true,
          lastError: true,
          currentState: {
            select: {
              stateName: true,
            },
          },
        },
      });

      results.triggered++;
      if (startResult.reason === 'started') {
        results.started++;
      } else {
        results.alreadyRunning++;
      }

      if (runtime?.status === 'completed_end' || runtime?.status === 'completed_paid') {
        results.completed++;
      } else if (runtime?.status === 'failed') {
        results.failed++;
      } else {
        results.running++;
      }

      details.push({
        customerId: customer.id,
        customerName: customer.fullName,
        outcome: runtime?.status === 'failed' ? 'failed' : 'triggered',
        lifecycle: startResult.reason === 'started' ? 'started' : 'already_running',
        instanceId: startResult.instance.id,
        status: runtime?.status || null,
        currentStateName: runtime?.currentState?.stateName || null,
        error: runtime?.lastError || null,
      });
    }

    return results;
  }

  async getAll(req: Request, res: Response) {
    const query = querySchema.parse(req.query);
    
    const result = await customersService.findAll(
      {
        status: query.status as CustomerStatus,
        search: query.search,
        customerIds: query.customerIds
          ? query.customerIds.split(',').map((id) => id.trim()).filter(Boolean)
          : undefined,
      },
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
    await homeBrainService.invalidateCache();

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
    await homeBrainService.invalidateCache();

    res.json({
      success: true,
      data: customer,
      message: 'Customer updated successfully',
    });
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    await customersService.delete(id);
    await homeBrainService.invalidateCache();

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  }

  async deleteAll(req: Request, res: Response) {
    const result = await customersService.deleteAll();
    await homeBrainService.invalidateCache();

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

  async startCollectionFlow(req: Request, res: Response) {
    const validation = startCollectionFlowSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const results = await this.executeCollectionFlowStart(validation.data);

    res.json({
      success: true,
      data: results,
      message: `Collection flow triggered for ${results.triggered} customers`,
    });
  }

  async startCollectionFlowForCustomer(req: Request, res: Response) {
    await customersService.findById(req.params.id);

    const results = await this.executeCollectionFlowStart({
      customerIds: [req.params.id],
    });

    res.json({
      success: true,
      data: results,
      message: 'Collection flow triggered for customer',
    });
  }
}

export default new CustomersController();
