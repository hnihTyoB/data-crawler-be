import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from './api-key.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AUDIT_ACTIONS } from '../../common/constants/audit-action.constant';

export class ApiKeyController {
  private readonly service = new ApiKeyService();
  private readonly auditLogService = new AuditLogService();

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const { name, expiresAt } = req.body;

      const result = await this.service.create(userId, name, expiresAt);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.CREATE_API_KEY,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { apiKeyId: result.id, name: result.name, keyPrefix: result.keyPrefix },
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const result = await this.service.list(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  setActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const keyId = req.params.id;
      const { isActive } = req.body;

      const result = await this.service.setActive(userId, keyId, isActive);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.UPDATE_API_KEY_STATUS,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: {
          apiKeyId: keyId,
          name: result.name,
          keyPrefix: result.keyPrefix,
          isActive,
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.id;
      const keyId = req.params.id;

      const result = await this.service.revoke(userId, keyId);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.REVOKE_API_KEY,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: {
          apiKeyId: keyId,
          name: result.name,
          keyPrefix: result.keyPrefix,
        },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
