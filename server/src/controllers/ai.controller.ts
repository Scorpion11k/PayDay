import { Request, Response } from 'express';
import { z } from 'zod';
import aiService from '../services/ai.service';
import { ValidationError } from '../types';

// Validation schemas
const querySchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters').max(500, 'Query must be at most 500 characters'),
  language: z.enum(['en', 'he']).optional(),
});

const detectMappingSchema = z.object({
  headers: z.array(z.string()).min(1, 'At least one header is required'),
});

class AIController {
  /**
   * Process a natural language query about the data
   * POST /api/ai/query
   */
  async query(req: Request, res: Response) {
    const validation = querySchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const result = await aiService.query(validation.data.query, validation.data.language);

    res.json({
      success: true,
      data: result,
    });
  }

  /**
   * Get suggested queries for the user
   * GET /api/ai/suggestions
   */
  async getSuggestions(req: Request, res: Response) {
    const language = (req.query.language as string | undefined) || undefined;
    const suggestions = aiService.getSuggestedQueries(language);

    res.json({
      success: true,
      data: suggestions,
    });
  }

  /**
   * Detect column mapping from Excel headers using AI
   * POST /api/ai/detect-mapping
   */
  async detectMapping(req: Request, res: Response) {
    const validation = detectMappingSchema.safeParse(req.body);
    
    if (!validation.success) {
      throw new ValidationError(validation.error.issues[0].message);
    }

    const result = await aiService.detectColumnMapping(validation.data.headers);

    res.json({
      success: true,
      data: result,
    });
  }
}

export default new AIController();

