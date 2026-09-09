import { Request, Response, NextFunction } from "express";
import { RoleService } from "./role.service";
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleQueryDto,
  AssignRolePermissionsDto,
} from "./role.dto";

export class RoleController {
  private readonly service = new RoleService();

  findAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query: RoleQueryDto = req.query;
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

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto: CreateRoleDto = req.body;
      const result = await this.service.create(dto, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto: UpdateRoleDto = req.body;
      const result = await this.service.update(req.params.id, dto, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.service.delete(req.params.id, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });

      res.json({
        success: true,
        message: "Role deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  resetRoleQuota = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const syncLimits = !!req.body?.syncLimits;
      const result = await this.service.resetRoleQuota(
        req.params.id,
        syncLimits,
        {
          actorId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] as string,
        },
      );

      res.json({
        success: true,
        message: "Role quota reset successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.getRolePermissions(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  setRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto: AssignRolePermissionsDto = req.body;
      const result = await this.service.setRolePermissions(
        req.params.id,
        dto.permissionIds,
        req.user.roles || [],
        {
          actorId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"] as string,
        },
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getRoleUsers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.getRoleUsers(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
