import { CrawlScheduleRepository } from './crawl-schedule.repository';
import { CrawlJobRepository } from '../crawl-jobs/crawl-job.repository';
import {
  CreateCrawlScheduleDto,
  UpdateCrawlScheduleDto,
  CrawlScheduleQueryDto,
} from './crawl-schedule.dto';
import { calculateNextRun } from '../../common/helpers/schedule-calculator.helper';
import { validateUrl, extractDomain, validateUrlAsync } from '../../common/helpers/url.helper';
import { AppError } from '../../common/errors/app-error';
import { ERROR_CODE } from '../../common/errors/error-code';
import { ROLES } from '../../common/constants/role.constant';
import { crawlQueue } from '../../queues/crawl.queue';

export class CrawlScheduleService {
  private readonly repository = new CrawlScheduleRepository();
  private readonly jobRepository = new CrawlJobRepository();

  async create(userId: string, role: string, payload: CreateCrawlScheduleDto) {
    const isUrlList = payload.mode === 'URL_LIST';
    const deduplicatedUrls = isUrlList
      ? [...new Set(payload.urls!.map((u) => u.trim()))]
      : [];

    const parsed = isUrlList ? null : validateUrl(payload.startUrl);
    const domain = isUrlList
      ? new URL(deduplicatedUrls[0]).hostname
      : extractDomain(payload.startUrl);

    // SSRF validation for URL_LIST
    if (isUrlList) {
      for (const url of deduplicatedUrls) {
        try {
          await validateUrlAsync(url);
        } catch (err: any) {
          throw new AppError(
            `Invalid or blocked URL in schedule: ${url} — ${err?.message}`,
            400,
            ERROR_CODE.INVALID_URL,
          );
        }
      }
    } else {
      await validateUrlAsync(payload.startUrl);
    }

    const frequency = payload.frequency ?? 'DAILY';
    const hour = payload.hour ?? 0;
    const minute = payload.minute ?? 0;
    const dayOfWeek = payload.dayOfWeek ?? (frequency === 'WEEKLY' ? 0 : undefined);
    const dayOfMonth = payload.dayOfMonth ?? (frequency === 'MONTHLY' ? 1 : undefined);

    let nextRunAt: Date | undefined;
    const timezone = payload.timezone ?? 'Asia/Ho_Chi_Minh';
    if (payload.isActive !== false) {
      try {
        nextRunAt = calculateNextRun({
          frequency,
          hour,
          minute,
          dayOfWeek,
          dayOfMonth,
          cronExpression: payload.cronExpression,
          timezone,
        });
      } catch (err: any) {
        throw new AppError(err.message || 'Failed to calculate next run date', 400, ERROR_CODE.VALIDATION_ERROR);
      }
    }

    return this.repository.create({
      userId,
      name: payload.name,
      startUrl: isUrlList ? (deduplicatedUrls[0] ?? '') : parsed!.href,
      domain,
      mode: payload.mode ?? 'SCRAPE',
      frequency,
      cronExpression: payload.cronExpression,
      hour,
      minute,
      dayOfWeek,
      dayOfMonth,
      timezone,
      maxPages: isUrlList ? deduplicatedUrls.length : (payload.maxPages ?? 20),
      maxDepth: payload.maxDepth ?? 1,
      urls: deduplicatedUrls,
      isActive: payload.isActive ?? true,
      autoDiff: payload.autoDiff ?? true,
      nextRunAt,
    });
  }

  async findAllByUser(userId: string, role: string, query: CrawlScheduleQueryDto) {
    if (role === ROLES.ADMIN) {
      return this.repository.findAll(query);
    }
    return this.repository.findAllByUser(userId, query);
  }

  async findById(userId: string, role: string, scheduleId: string) {
    const schedule = await this.repository.findById(scheduleId);
    if (!schedule) {
      throw new AppError('Crawl schedule not found', 404, ERROR_CODE.CRAWL_SCHEDULE_NOT_FOUND);
    }

    if (role !== ROLES.ADMIN && schedule.userId !== userId) {
      throw new AppError('Crawl schedule not found', 404, ERROR_CODE.CRAWL_SCHEDULE_NOT_FOUND);
    }

    return schedule;
  }

  async update(
    userId: string,
    role: string,
    scheduleId: string,
    payload: UpdateCrawlScheduleDto,
  ) {
    const schedule = await this.findById(userId, role, scheduleId);

    const isUrlList = (payload.mode ?? schedule.mode) === 'URL_LIST';
    let deduplicatedUrls: string[] | undefined;
    if (payload.urls) {
      deduplicatedUrls = [...new Set(payload.urls.map((u) => u.trim()))];
      for (const url of deduplicatedUrls) {
        await validateUrlAsync(url);
      }
    }

    let domain = schedule.domain;
    if (payload.startUrl && !isUrlList) {
      await validateUrlAsync(payload.startUrl);
      domain = extractDomain(payload.startUrl);
    }

    const frequency = payload.frequency ?? schedule.frequency;
    const hour = payload.hour ?? schedule.hour;
    const minute = payload.minute ?? schedule.minute;
    const dayOfWeek = payload.dayOfWeek !== undefined ? payload.dayOfWeek : schedule.dayOfWeek;
    const dayOfMonth = payload.dayOfMonth !== undefined ? payload.dayOfMonth : schedule.dayOfMonth;
    const cronExpression = payload.cronExpression !== undefined ? payload.cronExpression : schedule.cronExpression;
    const isActive = payload.isActive !== undefined ? payload.isActive : schedule.isActive;
    const timezone = payload.timezone ?? schedule.timezone ?? 'Asia/Ho_Chi_Minh';

    let nextRunAt = schedule.nextRunAt;
    if (isActive) {
      nextRunAt = calculateNextRun({
        frequency,
        hour,
        minute,
        dayOfWeek: dayOfWeek ?? undefined,
        dayOfMonth: dayOfMonth ?? undefined,
        cronExpression: cronExpression ?? undefined,
        timezone,
      });
    } else {
      nextRunAt = null as any;
    }

    return this.repository.update(scheduleId, {
      name: payload.name,
      startUrl: payload.startUrl,
      domain: domain ?? undefined,
      mode: payload.mode,
      frequency,
      cronExpression: cronExpression ?? undefined,
      hour,
      minute,
      dayOfWeek: dayOfWeek ?? undefined,
      dayOfMonth: dayOfMonth ?? undefined,
      timezone,
      maxPages: isUrlList && deduplicatedUrls ? deduplicatedUrls.length : payload.maxPages,
      maxDepth: payload.maxDepth,
      urls: deduplicatedUrls,
      isActive,
      autoDiff: payload.autoDiff,
      nextRunAt: nextRunAt ?? undefined,
    });
  }

  async delete(userId: string, role: string, scheduleId: string) {
    await this.findById(userId, role, scheduleId);
    return this.repository.delete(scheduleId);
  }

  async triggerRun(userId: string, role: string, scheduleId: string) {
    const schedule = await this.findById(userId, role, scheduleId);

    if (!crawlQueue) {
      throw new AppError(
        'Redis is not enabled. Start Docker and set REDIS_ENABLED=true in .env',
        503,
        ERROR_CODE.INTERNAL_SERVER_ERROR,
      );
    }

    const job = await this.jobRepository.create({
      userId: schedule.userId,
      startUrl: schedule.startUrl,
      domain: schedule.domain ?? undefined,
      mode: schedule.mode,
      maxPages: schedule.maxPages,
      maxDepth: schedule.maxDepth,
      urls: schedule.urls,
      scheduleId: schedule.id,
    });

    await crawlQueue.add('crawl-job', { jobId: job.id });

    // Update schedule lastRunAt and compute nextRunAt
    const now = new Date();
    const nextRunAt = calculateNextRun({
      frequency: schedule.frequency,
      hour: schedule.hour,
      minute: schedule.minute,
      dayOfWeek: schedule.dayOfWeek ?? undefined,
      dayOfMonth: schedule.dayOfMonth ?? undefined,
      cronExpression: schedule.cronExpression ?? undefined,
      timezone: schedule.timezone ?? 'Asia/Ho_Chi_Minh',
      fromDate: now,
    });

    await this.repository.updateNextRun(schedule.id, now, nextRunAt);

    return job;
  }

  async getScheduleHistory(
    userId: string,
    role: string,
    scheduleId: string,
    page = 1,
    limit = 20,
  ) {
    await this.findById(userId, role, scheduleId);
    const [items, total] = await this.jobRepository.findByScheduleId(scheduleId, page, limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async processDueSchedules(): Promise<number> {
    if (!crawlQueue) return 0;

    const now = new Date();
    const dueSchedules = await this.repository.findDueSchedules(now);
    let triggeredCount = 0;

    for (const schedule of dueSchedules) {
      try {
        const job = await this.jobRepository.create({
          userId: schedule.userId,
          startUrl: schedule.startUrl,
          domain: schedule.domain ?? undefined,
          mode: schedule.mode,
          maxPages: schedule.maxPages,
          maxDepth: schedule.maxDepth,
          urls: schedule.urls,
          scheduleId: schedule.id,
        });

        await crawlQueue.add('crawl-job', { jobId: job.id });

        const nextRunAt = calculateNextRun({
          frequency: schedule.frequency,
          hour: schedule.hour,
          minute: schedule.minute,
          dayOfWeek: schedule.dayOfWeek ?? undefined,
          dayOfMonth: schedule.dayOfMonth ?? undefined,
          cronExpression: schedule.cronExpression ?? undefined,
          timezone: schedule.timezone ?? 'Asia/Ho_Chi_Minh',
          fromDate: now,
        });

        await this.repository.updateNextRun(schedule.id, now, nextRunAt);
        triggeredCount++;
      } catch (err: any) {
        console.error(`[Schedule Service] Failed to trigger due schedule ${schedule.id}: ${err.message}`);
      }
    }

    return triggeredCount;
  }
}
