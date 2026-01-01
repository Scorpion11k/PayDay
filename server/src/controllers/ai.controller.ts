import { Request, Response } from 'express';
import { z } from 'zod';
import aiService from '../services/ai.service';
import { ValidationError } from '../types';

// Validation schemas
const querySchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters').max(500, 'Query must be at most 500 characters'),
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

    const result = await aiService.query(validation.data.query);

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
    const suggestions = aiService.getSuggestedQueries();

    res.json({
      success: true,
      data: suggestions,
    });
  }
}

export default new AIController();

