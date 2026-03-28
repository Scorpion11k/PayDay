import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { dashboardsService } from '../services/dashboards.service';
import { ValidationError } from '../types';

const createDashboardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  chartType: z.string().min(1),
  chartConfig: z.record(z.unknown()),
  filters: z.record(z.unknown()).optional(),
  isPublished: z.boolean().optional(),
});

const generateDashboardSchema = z.object({
  prompt: z.string().min(3).max(500),
});

class DashboardsController {
  async getStats(_req: Request, res: Response) {
    const stats = await dashboardsService.getStats();
    res.json({ success: true, data: stats });
  }

  async list(_req: Request, res: Response) {
    const dashboards = await dashboardsService.listCustomDashboards();
    res.json({ success: true, data: dashboards });
  }

  async create(req: Request, res: Response) {
    const validation = createDashboardSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }
    const dashboard = await dashboardsService.createCustomDashboard({
      ...validation.data,
      chartConfig: validation.data.chartConfig as Prisma.InputJsonValue,
      filters: validation.data.filters as Prisma.InputJsonValue | undefined,
    });
    res.status(201).json({ success: true, data: dashboard });
  }

  async remove(req: Request, res: Response) {
    const { id } = req.params;
    await dashboardsService.deleteCustomDashboard(id);
    res.json({ success: true, data: { id } });
  }

  async generate(req: Request, res: Response) {
    const validation = generateDashboardSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }
    const dashboard = await dashboardsService.generateDashboard(validation.data.prompt);
    res.json({ success: true, data: { dashboard } });
  }
}

export const dashboardsController = new DashboardsController();
