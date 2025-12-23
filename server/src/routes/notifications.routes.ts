import { Router } from 'express';
import notificationsController from '../controllers/notifications.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/notifications - List all notifications
router.get('/', asyncHandler(notificationsController.getAll.bind(notificationsController)));

// GET /api/notifications/pending - Get pending deliveries
router.get('/pending', asyncHandler(notificationsController.getPendingDeliveries.bind(notificationsController)));

// GET /api/notifications/customer/:customerId/stats - Get customer notification stats
router.get('/customer/:customerId/stats', asyncHandler(notificationsController.getCustomerStats.bind(notificationsController)));

// GET /api/notifications/:id - Get notification by ID
router.get('/:id', asyncHandler(notificationsController.getById.bind(notificationsController)));

// GET /api/notifications/:id/deliveries - Get delivery history
router.get('/:id/deliveries', asyncHandler(notificationsController.getDeliveryHistory.bind(notificationsController)));

// POST /api/notifications - Create new notification
router.post('/', asyncHandler(notificationsController.create.bind(notificationsController)));

// POST /api/notifications/:id/deliver - Create delivery attempt
router.post('/:id/deliver', asyncHandler(notificationsController.createDeliveryAttempt.bind(notificationsController)));

// PUT /api/notifications/deliveries/:deliveryId/status - Update delivery status
router.put('/deliveries/:deliveryId/status', asyncHandler(notificationsController.updateDeliveryStatus.bind(notificationsController)));

export default router;

