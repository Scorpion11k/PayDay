import { Router } from 'express';
import customersRoutes from './customers.routes';
import debtsRoutes from './debts.routes';
import installmentsRoutes from './installments.routes';
import paymentsRoutes from './payments.routes';
import notificationsRoutes from './notifications.routes';
import importRoutes from './import.routes';
import messagingRoutes from './messaging.routes';
import aiRoutes from './ai.routes';

const router = Router();

// Mount routes
router.use('/customers', customersRoutes);
router.use('/debts', debtsRoutes);
router.use('/installments', installmentsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/import', importRoutes);
router.use('/messaging', messagingRoutes);
router.use('/ai', aiRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'PayDay API',
    version: '1.0.0',
    endpoints: {
      customers: '/api/customers',
      debts: '/api/debts',
      installments: '/api/installments',
      payments: '/api/payments',
      notifications: '/api/notifications',
      import: '/api/import',
      messaging: '/api/messaging',
      ai: '/api/ai',
    },
  });
});

export default router;

