import { Router } from 'express';
import templatesController from '../controllers/templates.controller';

const router = Router();

// GET /api/templates - List all templates with filtering
router.get('/', (req, res, next) => {
  templatesController.list(req, res).catch(next);
});

// GET /api/templates/keys - Get distinct template keys
router.get('/keys', (req, res, next) => {
  templatesController.getKeys(req, res).catch(next);
});

// GET /api/templates/:id - Get single template by ID
router.get('/:id', (req, res, next) => {
  templatesController.getById(req, res).catch(next);
});

// POST /api/templates - Create new template
router.post('/', (req, res, next) => {
  templatesController.create(req, res).catch(next);
});

// PUT /api/templates/:id - Update existing template
router.put('/:id', (req, res, next) => {
  templatesController.update(req, res).catch(next);
});

// DELETE /api/templates/:id - Archive template (soft delete)
router.delete('/:id', (req, res, next) => {
  templatesController.archive(req, res).catch(next);
});

// POST /api/templates/:id/preview - Preview template with sample data
router.post('/:id/preview', (req, res, next) => {
  templatesController.preview(req, res).catch(next);
});

export default router;
