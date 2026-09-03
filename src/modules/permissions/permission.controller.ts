import { Request, Response, NextFunction } from "express";
import { PermissionService } from "./permission.service";
import { PermissionQueryDto } from "./permission.dto";

export class PermissionController {
  private readonly service = new PermissionService();

  findAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query: PermissionQueryDto = {
        resource: req.query.resource as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await this.service.findAll(query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.findById(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
