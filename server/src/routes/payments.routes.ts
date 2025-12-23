import { Router } from 'express';
import paymentsController from '../controllers/payments.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/payments - List all payments
router.get('/', asyncHandler(paymentsController.getAll.bind(paymentsController)));

// GET /api/payments/:id - Get payment by ID
router.get('/:id', asyncHandler(paymentsController.getById.bind(paymentsController)));

// POST /api/payments - Record new payment
router.post('/', asyncHandler(paymentsController.create.bind(paymentsController)));

// POST /api/payments/:id/allocate - Allocate payment to installments (ACID transaction)
router.post('/:id/allocate', asyncHandler(paymentsController.allocate.bind(paymentsController)));

// POST /api/payments/:id/reverse - Reverse a payment (ACID transaction)
router.post('/:id/reverse', asyncHandler(paymentsController.reverse.bind(paymentsController)));

export default router;

