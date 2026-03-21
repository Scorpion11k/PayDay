import { Router } from 'express';
import activityController from '../controllers/activity.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.delete('/all', asyncHandler(activityController.deleteAll.bind(activityController)));
router.get('/', asyncHandler(activityController.list.bind(activityController)));

export default router;
