import { Router } from 'express';
import multer from 'multer';
import importController from '../controllers/import.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// Configure multer for memory storage (files stored in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files only
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'));
    }
  },
});

// POST /api/import/parse - Parse file and return headers + preview
router.post(
  '/parse',
  upload.single('file'),
  asyncHandler(importController.parseFile.bind(importController))
);

// POST /api/import/preview - Preview import results
router.post(
  '/preview',
  upload.single('file'),
  asyncHandler(importController.previewImport.bind(importController))
);

// POST /api/import/execute - Execute import
router.post(
  '/execute',
  upload.single('file'),
  asyncHandler(importController.executeImport.bind(importController))
);

export default router;

