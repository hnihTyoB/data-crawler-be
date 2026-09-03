import { Request, Response, NextFunction } from "express";
import { HealthService } from "./health.service";

export class HealthController {
  private readonly service = new HealthService();

  getLiveness = (req: Request, res: Response): void => {
    const result = this.service.getLiveness();
    res.json(result);
  };

  getReadiness = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.getReadiness();
      const statusCode = result.status === "ready" ? 200 : 503;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  };

  getMetrics = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.getMetrics();
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
