import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './audit-log.dto';

export class AuditLogController {
  private readonly service = new AuditLogService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query: AuditLogQueryDto = req.query;
      const result = await this.service.findAll(query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
