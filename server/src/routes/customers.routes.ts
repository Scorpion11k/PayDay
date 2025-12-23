import { Router } from 'express';
import customersController from '../controllers/customers.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/customers - List all customers
router.get('/', asyncHandler(customersController.getAll.bind(customersController)));

// GET /api/customers/:id - Get customer by ID
router.get('/:id', asyncHandler(customersController.getById.bind(customersController)));

// GET /api/customers/:id/stats - Get customer statistics
router.get('/:id/stats', asyncHandler(customersController.getStats.bind(customersController)));

// POST /api/customers - Create new customer
router.post('/', asyncHandler(customersController.create.bind(customersController)));

// PUT /api/customers/:id - Update customer
router.put('/:id', asyncHandler(customersController.update.bind(customersController)));

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', asyncHandler(customersController.delete.bind(customersController)));

export default router;

