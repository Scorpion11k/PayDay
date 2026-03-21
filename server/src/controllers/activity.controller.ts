import { Request, Response } from 'express';
import { ActivityType, ActivityStatus } from '@prisma/client';
import activityService from '../services/activity.service';

class ActivityController {
  async list(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as ActivityType | undefined;
    const status = req.query.status as ActivityStatus | undefined;

    const result = await activityService.list({ page, limit, type, status });

    res.json({
      success: true,
      ...result,
    });
  }

  async deleteAll(_req: Request, res: Response) {
    const result = await activityService.deleteAll();

    res.json({
      success: true,
      data: result,
      message: `Successfully deleted ${result.deletedCount} activities`,
    });
  }
}

export default new ActivityController();
