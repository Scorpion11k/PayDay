import { Router, Request, Response } from 'express';
import { z } from 'zod';
import systemSettingsService from '../services/system-settings.service';

const router = Router();

const updateModeSchema = z.object({
  mode: z.enum(['demo', 'development', 'production']),
});

router.get('/', async (_req: Request, res: Response) => {
  const settings = await systemSettingsService.getSettings();
  res.json({ success: true, data: settings });
});

router.put('/mode', async (req: Request, res: Response) => {
  const validation = updateModeSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({
      success: false,
      error: validation.error.issues[0].message,
    });
    return;
  }

  const mode = await systemSettingsService.setMode(validation.data.mode);
  res.json({ success: true, data: { mode } });
});

export default router;
