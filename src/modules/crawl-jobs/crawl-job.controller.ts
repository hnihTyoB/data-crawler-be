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
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const limit = Math.min(Math.max(1, parseInt(req.query.limit as string || '50', 10)), 500);

      const items = await this.assetService.findByJobId(
        req.params.id,
        assetType,
        page,
        limit,
      );

      res.json({
        success: true,
        data: {
          items,
          meta: { page, limit },
        },
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
      res.json({
        success: true,
        data: diffReport,
      });
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

  streamEvents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = req.params.id;
      const initialJob = await this.service.findById(req.user.id, req.user.role, jobId);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (res.flushHeaders) {
        res.flushHeaders();
      }

      res.write(`event: initial\ndata: ${JSON.stringify(initialJob)}\n\n`);

      const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELED'];
      if (TERMINAL_STATUSES.includes(initialJob.status)) {
        res.write(`event: done\ndata: ${JSON.stringify({ status: initialJob.status })}\n\n`);
        res.end();
        return;
      }

      let isClosed = false;
      let interval: NodeJS.Timeout | null = null;
      let maxDurationTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        if (maxDurationTimeout) {
          clearTimeout(maxDurationTimeout);
          maxDurationTimeout = null;
        }
      };

      req.on('close', () => {
        isClosed = true;
        cleanup();
      });

      // Max stream duration guard (30 minutes)
      const MAX_STREAM_DURATION_MS = 30 * 60 * 1000;
      maxDurationTimeout = setTimeout(() => {
        if (!isClosed) {
          isClosed = true;
          cleanup();
          res.write(`event: done\ndata: ${JSON.stringify({ status: 'TIMEOUT', message: 'Stream reached max duration' })}\n\n`);
          res.end();
        }
      }, MAX_STREAM_DURATION_MS);

      interval = setInterval(async () => {
        if (isClosed) return;
        try {
          const currentJob = await this.service.findById(req.user.id, req.user.role, jobId);
          res.write(`event: progress\ndata: ${JSON.stringify(currentJob)}\n\n`);

          if (TERMINAL_STATUSES.includes(currentJob.status)) {
            res.write(`event: done\ndata: ${JSON.stringify({ status: currentJob.status })}\n\n`);
            cleanup();
            if (!isClosed) {
              isClosed = true;
              res.end();
            }
          }
        } catch {
          cleanup();
          if (!isClosed) {
            isClosed = true;
            res.end();
          }
        }
      }, 3000);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.delete(
        req.user.id,
        req.user.role,
        req.params.id,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  rerun = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.rerun(
        req.user.id,
        req.user.role,
        req.params.id,
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const result = await this.service.getLogs(
        req.user.id,
        req.user.role,
        req.params.id,
        page,
        limit,
      );
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
}
