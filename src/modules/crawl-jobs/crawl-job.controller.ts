import { Request, Response, NextFunction } from 'express';
import { CrawlJobService } from './crawl-job.service';
import { CrawlPageService } from '../crawl-pages/crawl-page.service';
import { CrawlExportService } from '../crawl-exports/crawl-export.service';
import { CreateCrawlJobDto, CrawlJobQueryDto } from './crawl-job.dto';
import { CrawlPageQueryDto } from '../crawl-pages/crawl-page.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AUDIT_ACTIONS } from '../../common/constants/audit-action.constant';
import { CrawlAssetService } from '../crawl-assets/crawl-asset.service';
import { AssetType } from '@prisma/client';
import { streamStorageDownload } from '../../common/storage/storage-download.helper';
export class CrawlJobController {
  private readonly service = new CrawlJobService();
  private readonly pageService = new CrawlPageService();
  private readonly exportService = new CrawlExportService();
  private readonly assetService = new CrawlAssetService();
  private readonly auditLogService = new AuditLogService();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const createCrawlJobDto: CreateCrawlJobDto = req.body;
      const result = await this.service.create(userId, createCrawlJobDto);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.CREATE_JOB,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: {
          jobId: result.id,
          startUrl: result.startUrl,
          mode: result.mode,
        },
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const query: CrawlJobQueryDto = req.query;
      const result = await this.service.findAllByUser(userId, role, query);

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
      const userId = req.user.id;
      const role = req.user.role;
      const result = await this.service.findById(userId, role, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const result = await this.service.cancel(userId, role, req.params.id);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.CANCEL_JOB,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: { jobId: req.params.id },
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(req.user.id, req.user.role, req.params.id);
      const query: CrawlPageQueryDto = req.query;
      const result = await this.pageService.findByJobId(req.params.id, query);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPagesPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(req.user.id, req.user.role, req.params.id);
      const query: CrawlPageQueryDto = req.query;
      const result = await this.pageService.findByJobId(req.params.id, {
        ...query,
        preview: true,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  getAssets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(req.user.id, req.user.role, req.params.id);

      const VALID_ASSET_TYPES: string[] = [
        'IMAGE',
        'LINK',
        'PDF',
        'FILE',
        'VIDEO',
        'OTHER',
      ];
      const rawType = req.query.assetType as string | undefined;
      if (rawType && !VALID_ASSET_TYPES.includes(rawType)) {
        res
          .status(400)
          .json({ success: false, message: `Invalid assetType: ${rawType}` });
        return;
      }
      const assetType = rawType as AssetType | undefined;
      const result = await this.assetService.findByJobId(
        req.params.id,
        assetType,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
  getExports = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(req.user.id, req.user.role, req.params.id);
      const result = await this.exportService.findByJobId(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createExport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.exportService.createExport(
        req.user.id,
        req.user.role,
        req.params.id,
        req.body.exportType,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  download = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const exportRecord = await this.service.getDownloadFile(
        userId,
        req.user.role,
        req.params.id,
      );

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.DOWNLOAD_EXPORT,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        details: {
          jobId: req.params.id,
          exportId: exportRecord.id,
          fileName: exportRecord.fileName,
        },
      });

      await streamStorageDownload(exportRecord, res);
    } catch (error) {
      next(error);
    }
  };

  getDiff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(req.user.id, req.user.role, req.params.id);
      const { ChangeDetectionService } = await import('../change-detection/change-detection.service');
      const changeDetectionService = new ChangeDetectionService();
      const compareWithJobId = req.query.compareWithJobId as string | undefined;
      const diffReport = await changeDetectionService.getDiffReport(req.params.id, compareWithJobId);
      res.json(diffReport);
    } catch (error) {
      next(error);
    }
  };

  downloadDiff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(req.user.id, req.user.role, req.params.id);
      const { ChangeDetectionService } = await import('../change-detection/change-detection.service');
      const changeDetectionService = new ChangeDetectionService();
      const compareWithJobId = req.query.compareWithJobId as string | undefined;
      const diffReport = await changeDetectionService.getDiffReport(req.params.id, compareWithJobId);

      const jsonStr = JSON.stringify(diffReport, null, 2);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="diff_report_${req.params.id}.json"`);
      res.send(jsonStr);
    } catch (error) {
      next(error);
    }
  };
}
