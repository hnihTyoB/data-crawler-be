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

      if (req.query.page || req.query.limit) {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.max(1, Number(req.query.limit) || 20);
        const total = result.length;
        const totalPages = Math.ceil(total / limit);
        const paginatedItems = result.slice((page - 1) * limit, page * limit);
        res.json({
          success: true,
          data: {
            items: paginatedItems,
            meta: {
              total,
              page,
              limit,
              totalPages,
            },
          },
        });
        return;
      }

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
