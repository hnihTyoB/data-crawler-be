import { prisma } from '../../database/prisma.client';
import { CrawlJobRepository } from './crawl-job.repository';
import { CrawlExportRepository } from '../crawl-exports/crawl-export.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { validateUrl, extractDomain } from '../../common/helpers/url.helper';
import { crawlQueue } from '../../queues/crawl.queue';
import { ROLES } from '../../common/constants/role.constant';
import { JOB_STATUS } from '../../common/constants/job-status.constant';
import { CreateCrawlJobDto, CrawlJobQueryDto } from './crawl-job.dto';
import { StorageFactory } from '../../common/storage/storage.factory';

export class CrawlJobService {
  private readonly repository = new CrawlJobRepository();

  async create(userId: string, payload: CreateCrawlJobDto) {
    const isUrlList = payload.mode === 'URL_LIST';

    // Fix #3: Deduplicate URLs before anything else
    const deduplicatedUrls = isUrlList
      ? [...new Set(payload.urls!.map((u) => u.trim()))]
      : [];

    const parsed = isUrlList ? null : validateUrl(payload.startUrl!);
    const domain = isUrlList
      ? new URL(deduplicatedUrls[0]).hostname
      : extractDomain(payload.startUrl!);

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // Fix #1: SSRF validation for ALL roles for URL_LIST
    if (isUrlList) {
      const { validateUrlAsync } =
        await import('../../common/helpers/url.helper');
      for (const url of deduplicatedUrls) {
        try {
          await validateUrlAsync(url);
        } catch (err: any) {
          throw new AppError(
            `Invalid or blocked URL in list: ${url} — ${err?.message}`,
            400,
            ERROR_CODE.INVALID_URL,
          );
        }
      }
    }

    if (user.role !== ROLES.ADMIN) {
      // Fix #2: For URL_LIST, quota check uses deduplicated urls.length
      const requestedPages = isUrlList
        ? deduplicatedUrls.length
        : (payload.maxPages ?? 20);

      if (requestedPages > user.maxPagesLimit) {
        throw new AppError(
          `Requested pages (${requestedPages}) exceeds quota limit of ${user.maxPagesLimit}`,
          400,
          ERROR_CODE.QUOTA_MAX_PAGES_EXCEEDED,
        );
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const jobsTodayCount = await prisma.crawlJob.count({
        where: { userId, createdAt: { gte: startOfDay } },
      });

      if (jobsTodayCount >= user.maxJobsPerDayLimit) {
        throw new AppError(
          `Daily job quota of ${user.maxJobsPerDayLimit} exceeded`,
          400,
          ERROR_CODE.QUOTA_JOBS_PER_DAY_EXCEEDED,
        );
      }

      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const concurrentJobsCount = await prisma.crawlJob.count({
        where: {
          userId,
          status: {
            in: [
              JOB_STATUS.PENDING,
              JOB_STATUS.QUEUED,
              JOB_STATUS.RUNNING,
              JOB_STATUS.PROCESSING_EXPORT,
            ],
          },
          createdAt: { gte: twoHoursAgo },
        },
      });

      if (concurrentJobsCount >= user.maxConcurrentJobsLimit) {
        throw new AppError(
          `Concurrent jobs quota of ${user.maxConcurrentJobsLimit} exceeded`,
          400,
          ERROR_CODE.QUOTA_CONCURRENT_JOBS_EXCEEDED,
        );
      }
    }

    const job = await this.repository.create({
      userId,
      startUrl: isUrlList ? (deduplicatedUrls[0] ?? '') : parsed!.href,
      domain,
      mode: payload.mode ?? 'SCRAPE',
      maxPages: isUrlList ? deduplicatedUrls.length : payload.maxPages,
      maxDepth: payload.maxDepth,
      urls: deduplicatedUrls,
      scheduleId: payload.scheduleId,
    });

    if (!crawlQueue) {
      throw new AppError(
        'Redis is not enabled. Start Docker and set REDIS_ENABLED=true in .env',
        503,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    await crawlQueue.add('crawl-job', { jobId: job.id });

    return job;
  }

  async findAllByUser(userId: string, role: string, query: CrawlJobQueryDto) {
    if (role === ROLES.ADMIN) {
      return this.repository.findAll(query);
    }
    return this.repository.findAllByUser(userId, query);
  }

  async findById(userId: string, role: string, jobId: string) {
    const job = await this.repository.findById(jobId);

    if (!job) {
      throw new AppError(
        'Crawl job not found',
        404,
        ERROR_CODE.CRAWL_JOB_NOT_FOUND,
      );
    }

    if (role !== ROLES.ADMIN && job.userId !== userId) {
      throw new AppError(
        'Crawl job not found',
        404,
        ERROR_CODE.CRAWL_JOB_NOT_FOUND,
      );
    }

    return job;
  }

  async cancel(userId: string, role: string, jobId: string) {
    const job = await this.findById(userId, role, jobId);

    if (job.status === JOB_STATUS.COMPLETED) {
      throw new AppError(
        'Completed job cannot be canceled',
        400,
        ERROR_CODE.CRAWL_JOB_ALREADY_COMPLETED,
      );
    }

    // Set DB status first so the worker's shouldCancel() poll sees it immediately
    const updated = await this.repository.updateStatus(
      jobId,
      JOB_STATUS.CANCELED,
    );

    // For CRAWL mode: also cancel at the Firecrawl provider level to stop
    // quota consumption. firecrawlJobId is saved by the worker as soon as
    // asyncCrawlUrl() returns, so it may be null if the job was canceled
    // before the worker had a chance to persist it (e.g. still PENDING/QUEUED).
    // In that case the worker's pre-run CANCELED check will catch it.
    if (job.mode === 'CRAWL' && job.firecrawlJobId) {
      const { FirecrawlService } =
        await import('../firecrawl/firecrawl.service');
      const firecrawlService = new FirecrawlService();
      // Fire-and-forget — cancelCrawl() handles its own error logging internally
      void firecrawlService.cancelCrawl(job.firecrawlJobId);
    }

    return updated;
  }

  async getDownloadFile(userId: string, role: string, jobId: string) {
    const job = await this.findById(userId, role, jobId);

    if (job.status !== 'COMPLETED') {
      throw new AppError(
        'Crawl job is not completed yet',
        400,
        ERROR_CODE.CRAWL_JOB_NOT_COMPLETED,
      );
    }

    const exportRepository = new CrawlExportRepository();
    const exports = await exportRepository.findByJobId(jobId);
    const storage = StorageFactory.getStorageService();

    for (const exportRecord of exports) {
      if (
        exportRecord.exportType === 'ZIP' &&
        exportRecord.status === 'COMPLETED' &&
        (await storage.exists(exportRecord.filePath))
      ) {
        return exportRecord;
      }
    }

    const { ExportService } = await import('../exports/export.service');
    const exportService = new ExportService();
    return exportService.generate(job, 'ZIP');
  }
}
