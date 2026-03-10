import { Router } from 'express';
import homeBrainController from '../controllers/home-brain.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/plan', asyncHandler(homeBrainController.generatePlan.bind(homeBrainController)));
router.get('/plans/:id', asyncHandler(homeBrainController.getPlan.bind(homeBrainController)));
router.post('/cards/:cardId/approve', asyncHandler(homeBrainController.approveCard.bind(homeBrainController)));
router.post('/cards/:cardId/modify', asyncHandler(homeBrainController.modifyCard.bind(homeBrainController)));
router.post('/cards/:cardId/skip', asyncHandler(homeBrainController.skipCard.bind(homeBrainController)));
router.post('/cards/:cardId/resolve', asyncHandler(homeBrainController.resolveCard.bind(homeBrainController)));

export default router;
