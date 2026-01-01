import { Router } from 'express';
import aiController from '../controllers/ai.controller';

const router = Router();

/**
 * @route   POST /api/ai/query
 * @desc    Process a natural language query about the data using AI
 * @access  Public
 * @body    { query: string }
 * @example { "query": "Show all customers overdue by 30 days" }
 */
router.post('/query', (req, res, next) => {
  aiController.query(req, res).catch(next);
});

/**
 * @route   GET /api/ai/suggestions
 * @desc    Get suggested queries for the user
 * @access  Public
 */
router.get('/suggestions', (req, res, next) => {
  aiController.getSuggestions(req, res).catch(next);
});

export default router;

