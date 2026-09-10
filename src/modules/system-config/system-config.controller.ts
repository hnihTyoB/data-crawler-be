import { Request, Response, NextFunction } from "express";
import { systemConfigService } from "./system-config.service";
import {
  CreateSystemConfigDto,
  UpdateSystemConfigDto,
  SystemConfigQueryDto,
} from "./system-config.dto";

export class SystemConfigController {
  private readonly service = systemConfigService;

  getPublic = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.getPublicConfigs();
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = req.query as SystemConfigQueryDto;
      const result = await this.service.findAll(query);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findByKey = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { key } = req.params;
      const result = await this.service.findByKey(key);
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
      const dto: CreateSystemConfigDto = req.body;
      const result = await this.service.create(dto, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });
      res.status(201).json({
        success: true,
        data: result,
        message: "Tạo cấu hình mới thành công",
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
      const { key } = req.params;
      const dto: UpdateSystemConfigDto = req.body;
      const result = await this.service.update(key, dto, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });
      res.json({
        success: true,
        data: result,
        message: "Cập nhật cấu hình thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  toggleFeature = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { key } = req.params;
      const result = await this.service.toggleFeature(key, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });
      res.json({
        success: true,
        data: result,
        message: `Đã ${result.value ? "bật" : "tắt"} tính năng thành công`,
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
      const { key } = req.params;
      await this.service.delete(key, {
        actorId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });
      res.json({
        success: true,
        message: "Xóa cấu hình thành công",
      });
    } catch (error) {
      next(error);
    }
  };

  syncFromEnv = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.syncFromEnv();
      res.json({
        success: true,
        data: result,
        message: "Đã đồng bộ toàn bộ giá trị cấu hình từ .env thành công",
      });
    } catch (error) {
      next(error);
    }
  };
}
