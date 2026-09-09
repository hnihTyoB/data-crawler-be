import { CrawlExportRepository } from "./crawl-export.repository";
import { CrawlJobRepository } from "../crawl-jobs/crawl-job.repository";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODE } from "../../common/errors/error-code";
import { ExportType } from "../../common/constants/export-type.constant";
import { ROLES } from "../../common/constants/role.constant";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { hasAdminPrivilege } from "../../common/helpers/rbac.helper";

export class CrawlExportService {
  private readonly repository = new CrawlExportRepository();
  private readonly jobRepository = new CrawlJobRepository();

  async findByJobId(jobId: string) {
    return this.repository.findByJobId(jobId);
  }

  async findById(
    userId: string,
    role: string,
    id: string,
    roles?: string[],
  ) {
    const exportRecord = await this.repository.findById(id);

    if (!exportRecord) {
      throw new AppError("Export not found", 404, ERROR_CODE.NOT_FOUND);
    }

    const job = await this.jobRepository.findById(exportRecord.jobId);
    if (!job) {
      throw new AppError(
        "Job associated with export not found",
        404,
        ERROR_CODE.NOT_FOUND,
      );
    }

    if (!hasAdminPrivilege(role, roles) && job.userId !== userId) {
      throw new AppError("Export not found", 404, ERROR_CODE.NOT_FOUND);
    }

    return exportRecord;
  }

  async createExport(
    userId: string,
    role: string,
    jobId: string,
    exportType: ExportType,
    roles?: string[],
  ) {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new AppError(
        "Crawl job not found",
        404,
        ERROR_CODE.CRAWL_JOB_NOT_FOUND,
      );
    }

    if (!hasAdminPrivilege(role, roles) && job.userId !== userId) {
      throw new AppError(
        "Crawl job not found",
        404,
        ERROR_CODE.CRAWL_JOB_NOT_FOUND,
      );
    }

    const processedPages = (job.successPages ?? 0) + (job.failedPages ?? 0);
    const targetPages =
      job.totalPages > 0
        ? Math.min(job.maxPages, job.totalPages)
        : job.maxPages;
    const isFinished =
      job.totalPages > 0 &&
      processedPages >= targetPages &&
      (job.successPages ?? 0) > 0;

    if (job.status === JOB_STATUS.RUNNING && isFinished) {
      await this.jobRepository.updateStatus(job.id, JOB_STATUS.COMPLETED, {
        finishedAt: job.finishedAt || new Date(),
      });
      job.status = JOB_STATUS.COMPLETED;
    }

    const isExportable =
      job.status === JOB_STATUS.COMPLETED ||
      (job.status === JOB_STATUS.CANCELED && (job.successPages ?? 0) > 0) ||
      (job.status === JOB_STATUS.FAILED && (job.successPages ?? 0) > 0);

    if (!isExportable) {
      if (
        job.status === JOB_STATUS.RUNNING ||
        job.status === JOB_STATUS.PENDING ||
        job.status === JOB_STATUS.QUEUED ||
        job.status === JOB_STATUS.PROCESSING_EXPORT
      ) {
        throw new AppError(
          "Crawl job is still in progress",
          400,
          ERROR_CODE.CRAWL_JOB_NOT_COMPLETED,
        );
      }
      throw new AppError(
        "No successfully crawled pages available to export",
        400,
        ERROR_CODE.VALIDATION_ERROR,
      );
    }

    const { ExportService } = await import("../exports/export.service");
    const exportService = new ExportService();

    return exportService.generate(job, exportType);
  }

  async findAllByUser(userId: string, page = 1, limit = 20) {
    return this.repository.findAllByUser(userId, page, limit);
  }

  async delete(userId: string, role: string, id: string, roles?: string[]) {
    const exportRecord = await this.findById(userId, role, id, roles);

    if (exportRecord.filePath) {
      const { StorageFactory } =
        await import("../../common/storage/storage.factory");
      const storage = StorageFactory.getStorageService();
      await storage.deleteFile(exportRecord.filePath).catch(() => {});
    }

    await this.repository.delete(id);
    return { success: true, message: "Export deleted successfully" };
  }
}
