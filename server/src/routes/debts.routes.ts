import { Router } from 'express';
import debtsController from '../controllers/debts.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/debts - List all debts
router.get('/', asyncHandler(debtsController.getAll.bind(debtsController)));

// GET /api/debts/:id - Get debt by ID
router.get('/:id', asyncHandler(debtsController.getById.bind(debtsController)));

// POST /api/debts - Create new debt
router.post('/', asyncHandler(debtsController.create.bind(debtsController)));

// PUT /api/debts/:id - Update debt
router.put('/:id', asyncHandler(debtsController.update.bind(debtsController)));

// DELETE /api/debts/:id - Delete debt
router.delete('/:id', asyncHandler(debtsController.delete.bind(debtsController)));

export default router;

