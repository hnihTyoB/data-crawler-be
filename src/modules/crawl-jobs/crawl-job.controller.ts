import { Request, Response, NextFunction } from "express";
import { CrawlJobService, crawlJobService } from "./crawl-job.service";
import { CrawlPageService } from "../crawl-pages/crawl-page.service";
import { CrawlExportService } from "../crawl-exports/crawl-export.service";
import { CreateCrawlJobDto, CrawlJobQueryDto } from "./crawl-job.dto";
import { CrawlPageQueryDto } from "../crawl-pages/crawl-page.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { AUDIT_ACTIONS } from "../../common/constants/audit-action.constant";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { CrawlAssetService } from "../crawl-assets/crawl-asset.service";
import { AssetType } from "../../common/constants/asset-type.constant";
import { streamStorageDownload } from "../../common/storage/storage-download.helper";
export class CrawlJobController {
  public static readonly MAX_CONCURRENT_STREAMS_PER_USER = 5;
  public static readonly activeUserStreams = new Map<string, number>();

  public static decrementActiveStream(userId: string): void {
    const current = CrawlJobController.activeUserStreams.get(userId) ?? 0;
    if (current <= 1) {
      CrawlJobController.activeUserStreams.delete(userId);
    } else {
      CrawlJobController.activeUserStreams.set(userId, current - 1);
    }
  }

  private readonly service: CrawlJobService;
  private readonly pageService: CrawlPageService;
  private readonly exportService: CrawlExportService;
  private readonly assetService: CrawlAssetService;
  private readonly auditLogService: AuditLogService;

  constructor(
    service?: CrawlJobService,
    pageService?: CrawlPageService,
    exportService?: CrawlExportService,
    assetService?: CrawlAssetService,
    auditLogService?: AuditLogService,
  ) {
    this.service = service ?? new CrawlJobService();
    this.pageService = pageService ?? new CrawlPageService();
    this.exportService = exportService ?? new CrawlExportService();
    this.assetService = assetService ?? new CrawlAssetService();
    this.auditLogService = auditLogService ?? new AuditLogService();
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.id;
      const createCrawlJobDto: CreateCrawlJobDto = req.body;
      const result = await this.service.create(userId, createCrawlJobDto);

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.CREATE_JOB,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
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
      const roles = req.user.roles;
      const query: CrawlJobQueryDto = req.query;
      const result = await this.service.findAllByUser(
        userId,
        role,
        query,
        roles,
      );

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
      const roles = req.user.roles;
      const result = await this.service.findById(
        userId,
        role,
        req.params.id,
        roles,
      );

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
      const roles = req.user.roles;
      const result = await this.service.cancel(
        userId,
        role,
        req.params.id,
        roles,
      );

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.CANCEL_JOB,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
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
      await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user.roles,
      );
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
      await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user.roles,
      );
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
      await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user.roles,
      );

      const assetType = req.query.assetType as AssetType | undefined;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;

      const result = await this.assetService.findByJobId(
        req.params.id,
        assetType,
        page,
        limit,
      );

      res.json({
        success: true,
        data: {
          items: result.items,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getExports = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user.roles,
      );
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
        req.user?.roles,
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
        req.user.roles,
      );

      await this.auditLogService.log({
        userId,
        action: AUDIT_ACTIONS.DOWNLOAD_EXPORT,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] as string,
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
      await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user.roles,
      );
      const { ChangeDetectionService } =
        await import("../change-detection/change-detection.service");
      const changeDetectionService = new ChangeDetectionService();
      const compareWithJobId = req.query.compareWithJobId as string | undefined;
      const diffReport = await changeDetectionService.getDiffReport(
        req.params.id,
        compareWithJobId,
      );
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
      await this.service.findById(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user.roles,
      );
      const { ChangeDetectionService } =
        await import("../change-detection/change-detection.service");
      const changeDetectionService = new ChangeDetectionService();
      const compareWithJobId = req.query.compareWithJobId as string | undefined;
      const diffReport = await changeDetectionService.getDiffReport(
        req.params.id,
        compareWithJobId,
      );

      const jsonStr = JSON.stringify(diffReport, null, 2);
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="diff_report_${req.params.id}.json"`,
      );
      res.send(jsonStr);
    } catch (error) {
      next(error);
    }
  };

  streamEvents = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const currentStreams = CrawlJobController.activeUserStreams.get(userId) ?? 0;
    if (currentStreams >= CrawlJobController.MAX_CONCURRENT_STREAMS_PER_USER) {
      return next(
        new (await import("../../common/errors/app-error")).AppError(
          "Too many active event streams. Please close existing streams before opening new ones.",
          429,
          (await import("../../common/errors/error-code")).ERROR_CODE.RATE_LIMIT_EXCEEDED,
        ),
      );
    }

    CrawlJobController.activeUserStreams.set(userId, currentStreams + 1);

    try {
      const jobId = req.params.id;
      const initialJob = await this.service.findById(
        req.user.id,
        req.user.role,
        jobId,
        req.user.roles,
      );

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      if (res.flushHeaders) {
        res.flushHeaders();
      }

      res.write(`event: initial\ndata: ${JSON.stringify(initialJob)}\n\n`);

      const TERMINAL_STATUSES: string[] = [
        JOB_STATUS.COMPLETED,
        JOB_STATUS.FAILED,
        JOB_STATUS.CANCELED,
      ];
      if (TERMINAL_STATUSES.includes(initialJob.status)) {
        res.write(
          `event: done\ndata: ${JSON.stringify({ status: initialJob.status })}\n\n`,
        );
        res.end();
        CrawlJobController.decrementActiveStream(userId);
        return;
      }

      let isClosed = false;
      let interval: NodeJS.Timeout | null = null;
      let maxDurationTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (!isClosed) {
          isClosed = true;
          CrawlJobController.decrementActiveStream(userId);
        }
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        if (maxDurationTimeout) {
          clearTimeout(maxDurationTimeout);
          maxDurationTimeout = null;
        }
      };

      req.on("close", cleanup);
      res.on("close", cleanup);

      // Max stream duration guard (10 minutes)
      const MAX_STREAM_DURATION_MS = 10 * 60 * 1000;
      maxDurationTimeout = setTimeout(() => {
        if (!isClosed) {
          cleanup();
          res.write(
            `event: done\ndata: ${JSON.stringify({ status: "TIMEOUT", message: "Stream reached max duration" })}\n\n`,
          );
          res.end();
        }
      }, MAX_STREAM_DURATION_MS);

      interval = setInterval(async () => {
        if (isClosed || req.destroyed || res.writableEnded) {
          cleanup();
          return;
        }
        try {
          const currentJob = await this.service.findById(
            req.user.id,
            req.user.role,
            jobId,
            req.user.roles,
          );
          res.write(`event: progress\ndata: ${JSON.stringify(currentJob)}\n\n`);

          if (TERMINAL_STATUSES.includes(currentJob.status)) {
            res.write(
              `event: done\ndata: ${JSON.stringify({ status: currentJob.status })}\n\n`,
            );
            cleanup();
            res.end();
          }
        } catch {
          cleanup();
          res.end();
        }
      }, 3000);
    } catch (error) {
      CrawlJobController.decrementActiveStream(userId);
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.delete(
        req.user.id,
        req.user.role,
        req.params.id,
        req.user?.roles,
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
        req.user?.roles,
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
        data: {
          items: result.items,
          meta: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / (result.limit || 1)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
