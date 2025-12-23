import { Router } from 'express';
import messagingController from '../controllers/messaging.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// GET /api/messaging/status - Get messaging services status
router.get('/status', asyncHandler(messagingController.getStatus.bind(messagingController)));

// POST /api/messaging/send-reminder - Send payment reminder to customer
router.post('/send-reminder', asyncHandler(messagingController.sendReminder.bind(messagingController)));

// POST /api/messaging/test-email - Test email configuration
router.post('/test-email', asyncHandler(messagingController.testEmail.bind(messagingController)));

// POST /api/messaging/test-whatsapp - Test WhatsApp configuration
router.post('/test-whatsapp', asyncHandler(messagingController.testWhatsApp.bind(messagingController)));

export default router;

