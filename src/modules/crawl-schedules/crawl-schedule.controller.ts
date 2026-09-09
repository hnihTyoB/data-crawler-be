import { Request, Response, NextFunction } from "express";
import { CrawlScheduleService } from "./crawl-schedule.service";
import { CrawlScheduleQueryDto } from "./crawl-schedule.dto";

export class CrawlScheduleController {
  private readonly service = new CrawlScheduleService();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schedule = await this.service.create(
        req.user!.id,
        req.user!.role,
        req.body,
        req.user?.roles,
      );
      res.status(201).json({
        success: true,
        message: "Crawl schedule created successfully",
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findAllByUser(
        req.user!.id,
        req.user!.role,
        req.query as unknown as CrawlScheduleQueryDto,
        req.user?.roles,
      );
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schedule = await this.service.findById(
        req.user!.id,
        req.user!.role,
        req.params.id,
        req.user?.roles,
      );
      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await this.service.update(
        req.user!.id,
        req.user!.role,
        req.params.id,
        req.body,
        req.user?.roles,
      );
      res.json({
        success: true,
        message: "Crawl schedule updated successfully",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(
        req.user!.id,
        req.user!.role,
        req.params.id,
        req.user?.roles,
      );
      res.json({
        success: true,
        message: "Crawl schedule deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  triggerRun = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await this.service.triggerRun(
        req.user!.id,
        req.user!.role,
        req.params.id,
        req.user?.roles,
      );
      res.status(201).json({
        success: true,
        message: "Scheduled crawl triggered successfully",
        data: job,
      });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const history = await this.service.getScheduleHistory(
        req.user!.id,
        req.user!.role,
        req.params.id,
        page,
        limit,
        req.user?.roles,
      );
      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };
}
