import { CrawlJobRepository } from './crawl-job.repository';
import { CrawlExportRepository } from '../crawl-exports/crawl-export.repository';
import { UserRepository } from '../users/user.repository';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { validateUrl, extractDomain } from '../../common/helpers/url.helper';
import {
  getZonedDateParts,
  createUtcDateFromZonedParts,
} from '../../common/helpers/schedule-calculator.helper';
import { crawlQueue } from '../../queues/crawl.queue';
import { ROLES } from '../../common/constants/role.constant';
import { JOB_STATUS } from '../../common/constants/job-status.constant';
import { CreateCrawlJobDto, CrawlJobQueryDto } from './crawl-job.dto';
import { StorageFactory } from '../../common/storage/storage.factory';
import { getErrorMessage } from '../../common/helpers/error-mapping.helper';

export class CrawlJobService {
  private readonly repository = new CrawlJobRepository();
  private readonly userRepository = new UserRepository();

  async create(userId: string, payload: CreateCrawlJobDto) {
    const isUrlList = payload.mode === 'URL_LIST';

    // Deduplicate URLs before anything else
    const deduplicatedUrls = isUrlList
      ? [...new Set(payload.urls!.map((u) => u.trim()))]
      : [];

    const parsed = isUrlList ? null : validateUrl(payload.startUrl!);
    const domain = isUrlList
      ? new URL(deduplicatedUrls[0]).hostname
      : extractDomain(payload.startUrl!);

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404, ERROR_CODE.NOT_FOUND);
    }

    // SSRF validation with bounded concurrency for URL_LIST
    if (isUrlList) {
      const { validateUrlAsync } =
        await import('../../common/helpers/url.helper');
      const chunkSize = 10;
      for (let i = 0; i < deduplicatedUrls.length; i += chunkSize) {
        const chunk = deduplicatedUrls.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (url) => {
            try {
              await validateUrlAsync(url);
            } catch (err: unknown) {
              throw new AppError(
                `Invalid or blocked URL in list: ${url} — ${getErrorMessage(err)}`,
                400,
                ERROR_CODE.INVALID_URL,
              );
            }
          }),
        );
      }
    }

    if (user.role !== ROLES.ADMIN) {
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

      // Timezone UTC+7 start of day calculation
      const nowZoned = getZonedDateParts(new Date(), 'Asia/Ho_Chi_Minh');
      const startOfDay = createUtcDateFromZonedParts(
        nowZoned.year,
        nowZoned.month,
        nowZoned.day,
        0,
        0,
        'Asia/Ho_Chi_Minh',
      );

      const jobsTodayCount = await this.repository.countJobsSince(userId, startOfDay);

      if (jobsTodayCount >= user.maxJobsPerDayLimit) {
        throw new AppError(
          `Daily job quota of ${user.maxJobsPerDayLimit} exceeded`,
          400,
          ERROR_CODE.QUOTA_JOBS_PER_DAY_EXCEEDED,
        );
      }

      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const activeStatuses = [
        JOB_STATUS.PENDING,
        JOB_STATUS.QUEUED,
        JOB_STATUS.RUNNING,
        JOB_STATUS.PROCESSING_EXPORT,
      ];
      const concurrentJobsCount = await this.repository.countConcurrentJobs(
        userId,
        activeStatuses,
        twoHoursAgo,
      );

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
