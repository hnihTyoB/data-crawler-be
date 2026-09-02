import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './user.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AUDIT_ACTIONS } from '../../common/constants/audit-action.constant';

export class UserController {
  private readonly service = new UserService();
  private readonly auditLogService = new AuditLogService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: UserQueryDto = req.query;
      const result = await this.service.findAll(query);

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
      const result = await this.service.findById(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createUserDto: CreateUserDto = req.body;
      const result = await this.service.create(createUserDto);

      await this.auditLogService.log({
        userId: req.user.id,
        action: AUDIT_ACTIONS.ADMIN_CREATE_USER,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { targetUserId: result.id, targetUserEmail: result.email, role: result.role },
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updateUserDto: UpdateUserDto = req.body;
      const result = await this.service.update(req.params.id, updateUserDto);

      await this.auditLogService.log({
        userId: req.user.id,
        action: AUDIT_ACTIONS.ADMIN_UPDATE_USER,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { targetUserId: result.id, updatedFields: Object.keys(updateUserDto) },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.delete(req.params.id, req.user.id);

      await this.auditLogService.log({
        userId: req.user.id,
        action: AUDIT_ACTIONS.ADMIN_DELETE_USER,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { targetUserId: req.params.id },
      });

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };
}

