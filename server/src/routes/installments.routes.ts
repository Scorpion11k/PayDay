import { Router } from 'express';
import installmentsController from '../controllers/installments.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/installments - List all installments
router.get('/', asyncHandler(installmentsController.getAll.bind(installmentsController)));

// GET /api/installments/:id - Get installment by ID
router.get('/:id', asyncHandler(installmentsController.getById.bind(installmentsController)));

// POST /api/installments - Create new installment
router.post('/', asyncHandler(installmentsController.create.bind(installmentsController)));

// PUT /api/installments/:id - Update installment
router.put('/:id', asyncHandler(installmentsController.update.bind(installmentsController)));

// DELETE /api/installments/:id - Delete installment
router.delete('/:id', asyncHandler(installmentsController.delete.bind(installmentsController)));

export default router;

