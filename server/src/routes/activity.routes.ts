import { Router } from 'express';
import activityController from '../controllers/activity.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(activityController.list.bind(activityController)));

export default router;
