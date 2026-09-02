import { prisma } from '../../database/prisma.client';
import { CrawlJobStatus, CrawlMode } from '@prisma/client';
import { CrawlJobQueryDto } from './crawl-job.dto';
import { JOB_STATUS } from '../../common/constants/job-status.constant';

export class CrawlJobRepository {
  create(data: {
    userId: string;
    startUrl: string;
    domain?: string;
    mode: CrawlMode;
    maxPages?: number;
    maxDepth?: number;
    urls?: string[];
    scheduleId?: string;
  }) {
    return prisma.crawlJob.create({
      data: {
        userId: data.userId,
        startUrl: data.startUrl,
        domain: data.domain,
        mode: data.mode,
        maxPages: data.maxPages ?? 20,
        maxDepth: data.maxDepth ?? 1,
        urls: data.urls ?? [],
        scheduleId: data.scheduleId,
      },
    });
  }

  findAllByUser(userId: string, query: CrawlJobQueryDto) {
    return this.find(query, userId);
  }

  findAll(query: CrawlJobQueryDto = {}) {
    return this.find(query);
  }

  private async find(query: CrawlJobQueryDto, userId?: string) {
    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.mode) {
      where.mode = query.mode;
    }
    if (query.search) {
      where.OR = [
        { startUrl: { contains: query.search, mode: 'insensitive' } },
        { domain: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const order = query.order || 'desc';
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'status',
      'mode',
      'totalPages',
      'successPages',
      'failedPages',
    ];
    const orderBy: any = allowedSortFields.includes(sortBy)
      ? { [sortBy]: order }
      : { createdAt: 'desc' };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.crawlJob.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          startUrl: true,
          domain: true,
          mode: true,
          status: true,
          maxPages: true,
          maxDepth: true,
          totalPages: true,
          successPages: true,
          failedPages: true,
          startedAt: true,
          finishedAt: true,
          createdAt: true,
          updatedAt: true,
          errorMessage: true,
          exports: {
            select: {
              id: true,
              exportType: true,
              status: true,
              fileName: true,
              fileSize: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.crawlJob.count({ where }),
    ]);

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

  findById(id: string) {
    return prisma.crawlJob.findUnique({
      where: { id },
      include: {
        exports: true,
      },
    });
  }

  findByIdWithPages(id: string) {
    return prisma.crawlJob.findUnique({
      where: { id },
      include: { pages: true },
    });
  }

  async updateStatus(
    id: string,
    status: CrawlJobStatus,
    extra?: {
      errorMessage?: string;
      startedAt?: Date;
      finishedAt?: Date;
      totalPages?: number;
      successPages?: number;
      failedPages?: number;
    },
  ) {
    const currentJob = await prisma.crawlJob.findUnique({
      where: { id },
      select: { status: true },
    });

    if (currentJob?.status === JOB_STATUS.CANCELED && status !== JOB_STATUS.CANCELED) {
      return prisma.crawlJob.findUnique({
        where: { id },
        include: {
          exports: true,
        },
      });
    }

    return prisma.crawlJob.update({
      where: { id },
      data: { status, ...extra },
    });
  }

  updateProgress(id: string, data: { totalPages?: number; successPages?: number; failedPages?: number }) {
    return prisma.crawlJob.update({
      where: { id },
      data,
    });
  }

  /**
   * Persists the Firecrawl-side job ID so it can be retrieved later for
   * provider-level cancellation. Called once per CRAWL-mode job immediately
   * after asyncCrawlUrl() returns a job ID.
   */
  saveFirecrawlJobId(id: string, firecrawlJobId: string) {
    return prisma.crawlJob.update({
      where: { id },
      data: { firecrawlJobId },
    });
  }

  findPreviousCompletedJobForSchedule(scheduleId: string, currentJobId: string) {
    return prisma.crawlJob.findFirst({
      where: {
        scheduleId,
        id: { not: currentJobId },
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'desc' },
      include: { pages: true },
    });
  }

  findPreviousCompletedJobForDomain(userId: string, domain: string | null, startUrl: string, currentJobId: string) {
    return prisma.crawlJob.findFirst({
      where: {
        userId,
        id: { not: currentJobId },
        status: 'COMPLETED',
        OR: [
          ...(domain ? [{ domain }] : []),
          { startUrl },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { pages: true },
    });
  }

  updateDiffReport(id: string, diffReportPath: string, diffSummary: any) {
    return prisma.crawlJob.update({
      where: { id },
      data: {
        diffReportPath,
        diffSummary,
      },
    });
  }

  findByScheduleId(scheduleId: string, page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * limit;
    return Promise.all([
      prisma.crawlJob.findMany({
        where: { scheduleId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.crawlJob.count({ where: { scheduleId } }),
    ]);
  }
}