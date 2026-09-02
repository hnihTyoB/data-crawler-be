import { CrawlExportRepository } from './crawl-export.repository';
import { CrawlJobRepository } from '../crawl-jobs/crawl-job.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { ExportType } from '@prisma/client';
import { ROLES } from '../../common/constants/role.constant';

export class CrawlExportService {
  private readonly repository = new CrawlExportRepository();
  private readonly jobRepository = new CrawlJobRepository();

  async findByJobId(jobId: string) {
    return this.repository.findByJobId(jobId);
  }

  async findById(userId: string, role: string, id: string) {
    const exportRecord = await this.repository.findById(id);

    if (!exportRecord) {
      throw new AppError('Export not found', 404, ERROR_CODE.NOT_FOUND);
    }

    const job = await this.jobRepository.findById(exportRecord.jobId);
    if (!job) {
      throw new AppError('Job associated with export not found', 404, ERROR_CODE.NOT_FOUND);
    }

    if (role !== ROLES.ADMIN && job.userId !== userId) {
      throw new AppError('Export not found', 404, ERROR_CODE.NOT_FOUND);
    }

    return exportRecord;
  }

  async createExport(userId: string, role: string, jobId: string, exportType: ExportType) {
    const job = await this.jobRepository.findById(jobId);

    if (!job) {
      throw new AppError('Crawl job not found', 404, ERROR_CODE.CRAWL_JOB_NOT_FOUND);
    }

    if (role !== ROLES.ADMIN && job.userId !== userId) {
      throw new AppError('Crawl job not found', 404, ERROR_CODE.CRAWL_JOB_NOT_FOUND);
    }

    if (job.status !== 'COMPLETED') {
      throw new AppError('Crawl job is not completed yet', 400, ERROR_CODE.CRAWL_JOB_NOT_COMPLETED);
    }

    const { ExportService } = await import('../exports/export.service');
    const exportService = new ExportService();

    return exportService.generate(job, exportType);
  }
}
