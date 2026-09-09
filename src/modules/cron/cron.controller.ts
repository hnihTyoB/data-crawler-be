import { Request, Response, NextFunction } from "express";
import { CronService, cronService } from "./cron.service";
import { CronJobName } from "../../common/constants/cron.constant";

export class CronController {
  constructor(private readonly service: CronService = cronService) {}

  /**
   * GET /api/v1/cron/jobs - Lấy danh sách toàn bộ tác vụ định kỳ
   */
  listJobs = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { search } = req.query as { search?: string };
      const data = await this.service.listJobs(search);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/cron/jobs/:jobName/trigger - Kích hoạt chạy ngay một tác vụ
   */
  triggerJob = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { jobName } = req.params as { jobName: CronJobName };
      const { params } = req.body as { params?: Record<string, unknown> };

      const actorContext = {
        actorId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get("user-agent"),
      };

      const data = await this.service.triggerJob(jobName, params, actorContext);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /api/v1/cron/jobs/:jobName/toggle - Bật hoặc tắt lịch chạy tự động của tác vụ
   */
  toggleJob = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { jobName } = req.params as { jobName: CronJobName };
      const { enabled } = req.body as { enabled: boolean };

      const actorContext = {
        actorId: req.user?.id,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get("user-agent"),
      };

      const data = await this.service.toggleJob(jobName, enabled, actorContext);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const cronController = new CronController();
