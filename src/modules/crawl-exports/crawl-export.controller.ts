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
}
