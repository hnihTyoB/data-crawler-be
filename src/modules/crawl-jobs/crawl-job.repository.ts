import { prisma } from "../../database/prisma.client";
import { CrawlJobStatus, CrawlMode, LogLevel, Prisma } from "@prisma/client";
import { CrawlJobQueryDto } from "./crawl-job.dto";
import { JOB_STATUS } from "../../common/constants/job-status.constant";
import { isConnectionLossError } from "../../common/helpers/error-mapping.helper";

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
    const where: Prisma.CrawlJobWhereInput = { deletedAt: null };
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

  async findById(id: string) {
    const job = await prisma.crawlJob.findUnique({
      where: { id },
      include: {
        exports: true,
      },
    });
    if (!job || job.deletedAt) {
      return null;
    }
    return job;
  }

  async findByIdWithPages(id: string) {
    const job = await prisma.crawlJob.findUnique({
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
    if (!job || job.deletedAt) {
      return null;
    }
    return job;
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
        deletedAt: null,
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
        deletedAt: null,
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
        where: { scheduleId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.crawlJob.count({ where: { scheduleId, deletedAt: null } }),
    ]);
  }

  async countJobsSince(userId: string, sinceDate: Date): Promise<number> {
    const totalCount = await prisma.crawlJob.count({
      where: {
        userId,
        createdAt: { gte: sinceDate },
      },
    });

    try {
      // Find jobs that failed due to connection loss with 0 successful pages
      const failedJobs = await prisma.crawlJob.findMany({
        where: {
          userId,
          status: JOB_STATUS.FAILED,
          createdAt: { gte: sinceDate },
          successPages: 0,
        },
        select: {
          errorMessage: true,
        },
      });

      const waivedCount = failedJobs.filter(
        (job) => !job.errorMessage || isConnectionLossError(job.errorMessage),
      ).length;

      return Math.max(0, totalCount - waivedCount);
    } catch {
      return totalCount;
    }
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
        deletedAt: null,
        ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
      },
    });
  }

  async sumPagesCrawledByUser(userId: string, since?: Date): Promise<number> {
    const aggregate = await prisma.crawlJob.aggregate({
      where: {
        userId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { totalPages: true },
    });
    const totalPages = aggregate._sum.totalPages ?? 0;

    try {
      // Deduct un-crawled totalPages for jobs that failed due to connection error with 0 success pages
      const failedJobs = await prisma.crawlJob.findMany({
        where: {
          userId,
          status: JOB_STATUS.FAILED,
          successPages: 0,
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        select: {
          totalPages: true,
          errorMessage: true,
        },
      });

      const waivedPages = failedJobs
        .filter(
          (job) =>
            !job.errorMessage || isConnectionLossError(job.errorMessage),
        )
        .reduce((sum, job) => sum + (job.totalPages ?? 0), 0);

      return Math.max(0, totalPages - waivedPages);
    } catch {
      return totalPages;
    }
  }

  async delete(id: string, deletedBy?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.crawlAsset.deleteMany({ where: { crawlJobId: id } });
      await tx.crawlJobLog.deleteMany({ where: { jobId: id } });
      await tx.crawlExport.deleteMany({ where: { jobId: id } });
      await tx.crawlPage.deleteMany({ where: { jobId: id } });
      return tx.crawlJob.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          ...(deletedBy ? { deletedBy } : {}),
        },
      });
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

  findRecentActiveJob(userId: string, startUrl: string, windowMs = 5000) {
    const since = new Date(Date.now() - windowMs);
    return prisma.crawlJob.findFirst({
      where: {
        userId,
        startUrl,
        status: {
          in: [JOB_STATUS.PENDING, JOB_STATUS.QUEUED, JOB_STATUS.RUNNING],
        },
        deletedAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
