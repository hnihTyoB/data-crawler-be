import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  private readonly service = new DashboardService();

  getStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getStats(req.user.id, req.user.role);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
