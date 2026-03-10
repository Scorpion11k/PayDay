import { Router } from 'express';
import flowsController from '../controllers/flows.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(flowsController.list.bind(flowsController)));
router.post('/', asyncHandler(flowsController.create.bind(flowsController)));
router.post('/generate-from-prompt', asyncHandler(flowsController.generateFromPrompt.bind(flowsController)));
router.post('/executor/run-once', asyncHandler(flowsController.runExecutorOnce.bind(flowsController)));
router.get('/:id', asyncHandler(flowsController.getById.bind(flowsController)));
router.put('/:id', asyncHandler(flowsController.update.bind(flowsController)));
router.post('/:id/publish', asyncHandler(flowsController.publish.bind(flowsController)));
router.post('/:id/set-default', asyncHandler(flowsController.setDefault.bind(flowsController)));
router.post('/:id/new-version', asyncHandler(flowsController.createNewVersion.bind(flowsController)));

export default router;
