import { prisma } from "../../database/prisma.client";
import { CrawlJobStatus, CrawlMode, LogLevel, Prisma } from "@prisma/client";
import { CrawlJobQueryDto } from "./crawl-job.dto";
import { JOB_STATUS } from "../../common/constants/job-status.constant";

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
        status: JOB_STATUS.PENDING,
      },
    });
  }

  findAllByUser(userId: string, query: CrawlJobQueryDto = {}) {
    return this.find(query, userId);
  }

  findAll(query: CrawlJobQueryDto = {}) {
    return this.find(query);
  }

  private async find(query: CrawlJobQueryDto, userId?: string) {
    const where: Prisma.CrawlJobWhereInput = {};
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
      const trimmedSearch = query.search.trim();
      let matchingIds: string[] = [];

      try {
        const searchPattern = `%${trimmedSearch}%`;
        const matched = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "crawl_jobs" 
          WHERE id::text ILIKE ${searchPattern}
          LIMIT 100
        `;
        matchingIds = matched.map((r) => r.id);
      } catch {
        const isFullUuid =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
            trimmedSearch,
          );
        if (isFullUuid) {
          matchingIds = [trimmedSearch];
        }
      }

      where.OR = [
        { startUrl: { contains: trimmedSearch, mode: "insensitive" } },
        { domain: { contains: trimmedSearch, mode: "insensitive" } },
        ...(matchingIds.length > 0 ? [{ id: { in: matchingIds } }] : []),
      ];
    }

    const sortBy = query.sortBy || "createdAt";
    const order = (query.order || "desc") as Prisma.SortOrder;
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "status",
      "mode",
      "totalPages",
      "successPages",
      "failedPages",
    ];
    const orderBy: Prisma.CrawlJobOrderByWithRelationInput =
      allowedSortFields.includes(sortBy)
        ? { [sortBy]: order }
        : { createdAt: "desc" };

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

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      items,
      total,
      page,
      limit,
      pageSize: limit,
      totalPages,
      meta: {
        total,
        page,
        limit,
        totalPages,
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
      include: {
        pages: {
          select: {
            id: true,
            url: true,
            normalizedUrl: true,
            contentHash: true,
            wordCount: true,
            status: true,
            statusCode: true,
            title: true,
            crawledAt: true,
          },
        },
      },
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
    await prisma.crawlJob.updateMany({
      where: {
        id,
        ...(status !== JOB_STATUS.CANCELED
          ? { status: { not: JOB_STATUS.CANCELED } }
          : {}),
      },
      data: { status, ...extra },
    });

    return prisma.crawlJob.findUnique({
      where: { id },
      include: {
        exports: true,
      },
    });
  }

  updateProgress(
    id: string,
    data: { totalPages?: number; successPages?: number; failedPages?: number },
  ) {
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

  findPreviousCompletedJobForSchedule(
    scheduleId: string,
    currentJobId: string,
  ) {
    return prisma.crawlJob.findFirst({
      where: {
        scheduleId,
        id: { not: currentJobId },
        status: JOB_STATUS.COMPLETED,
      },
      orderBy: { createdAt: "desc" },
      include: {
        pages: {
          select: {
            id: true,
            url: true,
            normalizedUrl: true,
            contentHash: true,
            wordCount: true,
            status: true,
            statusCode: true,
            title: true,
            crawledAt: true,
          },
        },
      },
    });
  }

  findPreviousCompletedJobForDomain(
    userId: string,
    domain: string | null,
    startUrl: string,
    currentJobId: string,
  ) {
    return prisma.crawlJob.findFirst({
      where: {
        userId,
        id: { not: currentJobId },
        status: JOB_STATUS.COMPLETED,
        OR: [...(domain ? [{ domain }] : []), { startUrl }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        pages: {
          select: {
            id: true,
            url: true,
            normalizedUrl: true,
            contentHash: true,
            wordCount: true,
            status: true,
            statusCode: true,
            title: true,
            crawledAt: true,
          },
        },
      },
    });
  }

  updateDiffReport(
    id: string,
    diffReportPath: string,
    diffSummary: Prisma.InputJsonValue,
  ) {
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
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.crawlJob.count({ where: { scheduleId } }),
    ]);
  }

  countJobsSince(userId: string, sinceDate: Date): Promise<number> {
    return prisma.crawlJob.count({
      where: {
        userId,
        createdAt: { gte: sinceDate },
      },
    });
  }

  countConcurrentJobs(
    userId: string,
    activeStatuses: CrawlJobStatus[],
    sinceDate?: Date,
  ): Promise<number> {
    return prisma.crawlJob.count({
      where: {
        userId,
        status: { in: activeStatuses },
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
    });
  }

  async sumPagesCrawledByUser(userId: string): Promise<number> {
    const aggregate = await prisma.crawlJob.aggregate({
      where: { userId },
      _sum: { totalPages: true },
    });
    return aggregate._sum.totalPages ?? 0;
  }

  async delete(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.crawlAsset.deleteMany({ where: { crawlJobId: id } });
      await tx.crawlJobLog.deleteMany({ where: { jobId: id } });
      await tx.crawlExport.deleteMany({ where: { jobId: id } });
      await tx.crawlPage.deleteMany({ where: { jobId: id } });
      return tx.crawlJob.delete({ where: { id } });
    });
  }

  async createJobLog(data: {
    jobId: string;
    level: LogLevel;
    step: string;
    message: string;
  }) {
    return prisma.crawlJobLog.create({
      data,
    });
  }

  async findLogsByJobId(jobId: string, page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const skip = (safePage - 1) * safeLimit;
    const [items, total] = await Promise.all([
      prisma.crawlJobLog.findMany({
        where: { jobId },
        orderBy: { createdAt: "asc" },
        skip,
        take: safeLimit,
      }),
      prisma.crawlJobLog.count({ where: { jobId } }),
    ]);
    return { items, total, page: safePage, limit: safeLimit };
  }
}
