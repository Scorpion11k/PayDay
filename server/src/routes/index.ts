import { Router } from 'express';
import customersRoutes from './customers.routes';
import debtsRoutes from './debts.routes';
import installmentsRoutes from './installments.routes';
import paymentsRoutes from './payments.routes';
import notificationsRoutes from './notifications.routes';

const router = Router();

// Mount routes
router.use('/customers', customersRoutes);
router.use('/debts', debtsRoutes);
router.use('/installments', installmentsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/notifications', notificationsRoutes);

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
    },
  });
});

export default router;

