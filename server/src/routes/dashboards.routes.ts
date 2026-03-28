import { Router } from 'express';
import { dashboardsController } from '../controllers/dashboards.controller';

const router = Router();

router.get('/stats', (req, res, next) => {
  dashboardsController.getStats(req, res).catch(next);
});

router.get('/', (req, res, next) => {
  dashboardsController.list(req, res).catch(next);
});

router.post('/', (req, res, next) => {
  dashboardsController.create(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  dashboardsController.remove(req, res).catch(next);
});

router.post('/generate', (req, res, next) => {
  dashboardsController.generate(req, res).catch(next);
});

export default router;
