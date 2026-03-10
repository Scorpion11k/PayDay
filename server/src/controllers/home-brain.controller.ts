import { Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../types';
import homeBrainService from '../services/home-brain/home-brain.service';

const generatePlanRequestSchema = z.object({
  locale: z.enum(['en', 'he']),
  filters: z
    .object({
      segment: z.enum(['all', 'high_risk', 'overdue', 'no_response']).optional(),
      language: z.enum(['en', 'he', 'ar']).optional(),
      minOverdueDays: z.number().int().min(0).max(365).optional(),
    })
    .optional(),
  forceRefresh: z.boolean().optional(),
  maxCards: z.number().int().min(1).max(12).optional(),
});

const cardMutationSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  performedBy: z.string().optional(),
  modifications: z.record(z.unknown()).optional(),
  reason: z.string().max(500).optional(),
});

class HomeBrainController {
  async generatePlan(req: Request, res: Response) {
    const parsed = generatePlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(`Invalid request: ${parsed.error.issues[0]?.message || 'bad payload'}`);
    }

    const result = await homeBrainService.generatePlan(parsed.data);
    res.json({
      success: true,
      data: result,
    });
  }

  async getPlan(req: Request, res: Response) {
    const result = await homeBrainService.getPlan(req.params.id);
    res.json({
      success: true,
      data: result,
    });
  }

  async approveCard(req: Request, res: Response) {
    const parsed = cardMutationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid approve payload');
    }
    const result = await homeBrainService.approveCard(req.params.cardId, parsed.data);
    res.json({
      success: true,
      data: result,
    });
  }

  async modifyCard(req: Request, res: Response) {
    const parsed = cardMutationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid modify payload');
    }
    const result = await homeBrainService.modifyCard(req.params.cardId, parsed.data);
    res.json({
      success: true,
      data: result,
    });
  }

  async skipCard(req: Request, res: Response) {
    const parsed = cardMutationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid skip payload');
    }
    const result = await homeBrainService.skipCard(req.params.cardId, parsed.data);
    res.json({
      success: true,
      data: result,
    });
  }

  async resolveCard(req: Request, res: Response) {
    const parsed = cardMutationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || 'Invalid resolve payload');
    }
    const result = await homeBrainService.resolveCard(req.params.cardId, parsed.data);
    res.json({
      success: true,
      data: result,
    });
  }
}

export default new HomeBrainController();
