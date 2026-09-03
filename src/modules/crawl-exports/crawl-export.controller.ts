import { Request, Response, NextFunction } from 'express';
import { CrawlExportService } from './crawl-export.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AUDIT_ACTIONS } from '../../common/constants/audit-action.constant';
import { streamStorageDownload } from '../../common/storage/storage-download.helper';

export class CrawlExportController {
  private readonly service = new CrawlExportService();
  private readonly auditLogService = new AuditLogService();

  download = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exportRecord = await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.exportId,
      );

      await this.auditLogService.log({
        userId: req.user.id,
        action: AUDIT_ACTIONS.DOWNLOAD_EXPORT,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: {
          jobId: exportRecord.jobId,
          exportId: exportRecord.id,
          fileName: exportRecord.fileName,
        },
      });

      await streamStorageDownload(exportRecord, res);
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await this.service.findAllByUser(req.user.id, page, limit);
      res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.delete(
        req.user.id,
        req.user.role,
        req.params.exportId,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
