import { prisma } from "../../database/prisma.client";
import { CrawlPageStatus, Prisma } from "@prisma/client";
import { CrawlPageQueryDto } from "./crawl-page.dto";

export class CrawlPageRepository {
  create(data: {
    jobId: string;
    url: string;
    normalizedUrl?: string;
    title?: string;
    description?: string;
    markdownContent?: string;
    content?: string;
    htmlContentPath?: string;
    status?: CrawlPageStatus;
    statusCode?: number;
    errorMessage?: string;
    crawledAt?: Date;
    wordCount?: number;
    contentHash?: string | null;
    dataQualityScore?: number | null;
    warnings?: string[];
  }) {
    return prisma.crawlPage.create({ data });
  }

  async findByJobId(jobId: string, query: CrawlPageQueryDto = {}) {
    const where: Prisma.CrawlPageWhereInput = { jobId };
    const andConditions: Prisma.CrawlPageWhereInput[] = [];

    if (query.status) {
      where.status = query.status;
    }
    if (query.statusCode !== undefined && query.statusCode !== "") {
      where.statusCode = Number(query.statusCode);
    }
    if (query.search) {
      where.OR = [
        { url: { contains: query.search, mode: "insensitive" } },
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { markdownContent: { contains: query.search, mode: "insensitive" } },
        { content: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const exactScore = query.dataQualityScore ?? query.qualityScore;
    const minScore = query.minDataQualityScore ?? query.minQualityScore;
    const maxScore = query.maxDataQualityScore ?? query.maxQualityScore;

    if (exactScore !== undefined && exactScore !== "") {
      where.dataQualityScore = Number(exactScore);
    } else {
      const scoreFilter: Prisma.IntNullableFilter = {};
      if (minScore !== undefined && minScore !== "") {
        scoreFilter.gte = Number(minScore);
      }
      if (maxScore !== undefined && maxScore !== "") {
        scoreFilter.lte = Number(maxScore);
      }
      if (Object.keys(scoreFilter).length > 0) {
        where.dataQualityScore = scoreFilter;
      }
    }

    if (query.hasImages !== undefined && query.hasImages !== "") {
      const isTrue =
        query.hasImages === true ||
        query.hasImages === "true" ||
        query.hasImages === "1";
      if (isTrue) {
        andConditions.push({ assets: { some: { assetType: "IMAGE" } } });
      } else {
        andConditions.push({ assets: { none: { assetType: "IMAGE" } } });
      }
    }

    if (query.hasLinks !== undefined && query.hasLinks !== "") {
      const isTrue =
        query.hasLinks === true ||
        query.hasLinks === "true" ||
        query.hasLinks === "1";
      if (isTrue) {
        andConditions.push({ assets: { some: { assetType: "LINK" } } });
      } else {
        andConditions.push({ assets: { none: { assetType: "LINK" } } });
      }
    }

    if (query.hasTables !== undefined && query.hasTables !== "") {
      const isTrue =
        query.hasTables === true ||
        query.hasTables === "true" ||
        query.hasTables === "1";
      const insensitiveMode = Prisma.QueryMode.insensitive;
      const tableConditions: Prisma.CrawlPageWhereInput[] = [
        { markdownContent: { contains: "<table", mode: insensitiveMode } },
        { content: { contains: "<table", mode: insensitiveMode } },
        { markdownContent: { contains: "|", mode: insensitiveMode } },
      ];
      if (isTrue) {
        andConditions.push({ OR: tableConditions });
      } else {
        andConditions.push({
          AND: [
            { markdownContent: { not: { contains: "<table" } } },
            { content: { not: { contains: "<table" } } },
            { markdownContent: { not: { contains: "|" } } },
          ],
        });
      }
    }

    const exactLength = query.contentLength ?? query.wordCount;
    const minLength = query.minContentLength ?? query.minWordCount;
    const maxLength = query.maxContentLength ?? query.maxWordCount;

    if (exactLength !== undefined && exactLength !== "") {
      where.wordCount = Number(exactLength);
    } else {
      const countFilter: Prisma.IntFilter = {};
      if (minLength !== undefined && minLength !== "") {
        countFilter.gte = Number(minLength);
      }
      if (maxLength !== undefined && maxLength !== "") {
        countFilter.lte = Number(maxLength);
      }
      if (Object.keys(countFilter).length > 0) {
        where.wordCount = countFilter;
      }
    }

    if (andConditions.length > 0) {
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [...existingAnd, ...andConditions];
    }

    const sortBy = query.sortBy || "createdAt";
    const order = query.order || "asc";
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "url",
      "title",
      "statusCode",
      "status",
      "crawledAt",
      "dataQualityScore",
      "wordCount",
    ];
    const orderBy: Prisma.CrawlPageOrderByWithRelationInput =
      allowedSortFields.includes(sortBy)
        ? { [sortBy]: order as Prisma.SortOrder }
        : { createdAt: "asc" };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const select: Prisma.CrawlPageSelect = {
      id: true,
      jobId: true,
      url: true,
      normalizedUrl: true,
      title: true,
      description: true,
      status: true,
      statusCode: true,
      errorMessage: true,
      hasSensitiveData: true,
      wordCount: true,
      contentHash: true,
      dataQualityScore: true,
      warnings: true,
      crawledAt: true,
      createdAt: true,
      updatedAt: true,
    };

    if (query.preview === true || query.preview === "true") {
      select.markdownContent = true;
      select.content = true;
    }

    const [items, total] = await Promise.all([
      prisma.crawlPage.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select,
      }),
      prisma.crawlPage.count({ where }),
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
    return prisma.crawlPage.findUnique({
      where: { id },
      include: { assets: true },
    });
  }

  update(
    id: string,
    data: {
      title?: string;
      description?: string;
      markdownContent?: string;
      content?: string;
      htmlContentPath?: string;
      status?: CrawlPageStatus;
      statusCode?: number;
      errorMessage?: string;
      crawledAt?: Date;
      hasSensitiveData?: boolean;
      normalizedUrl?: string;
      wordCount?: number;
      contentHash?: string | null;
      dataQualityScore?: number | null;
      warnings?: string[];
      extractedData?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.crawlPage.update({
      where: { id },
      data,
    });
  }

  countByJobId(jobId: string) {
    return prisma.crawlPage.count({ where: { jobId } });
  }

  countByJobIdAndStatus(jobId: string, status: CrawlPageStatus) {
    return prisma.crawlPage.count({ where: { jobId, status } });
  }
  /**
   * Upsert on (jobId, url) unique constraint — idempotent on BullMQ retries.
   * If a page with the same jobId+url already exists, it is overwritten with
   * fresh data. This prevents duplicate rows when the worker retries a job
   * that crashed mid-run.
   */
  upsert(data: {
    jobId: string;
    url: string;
    normalizedUrl?: string;
    title?: string;
    description?: string;
    markdownContent?: string;
    content?: string;
    htmlContentPath?: string;
    status?: CrawlPageStatus;
    statusCode?: number;
    errorMessage?: string;
    crawledAt?: Date;
    wordCount?: number;
    contentHash?: string | null;
    dataQualityScore?: number | null;
    warnings?: string[];
    hasSensitiveData?: boolean;
  }) {
    return prisma.crawlPage.upsert({
      where: { jobId_url: { jobId: data.jobId, url: data.url } },
      create: data,
      update: {
        normalizedUrl: data.normalizedUrl,
        title: data.title,
        description: data.description,
        markdownContent: data.markdownContent,
        content: data.content,
        htmlContentPath: data.htmlContentPath,
        status: data.status,
        statusCode: data.statusCode,
        errorMessage: data.errorMessage,
        crawledAt: data.crawledAt,
        wordCount: data.wordCount,
        contentHash: data.contentHash,
        dataQualityScore: data.dataQualityScore,
        warnings: data.warnings,
        hasSensitiveData: data.hasSensitiveData,
      },
    });
  }
}
