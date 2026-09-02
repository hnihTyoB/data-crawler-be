import { prisma } from '../../database/prisma.client';
import { CrawlPageStatus } from '@prisma/client';
import { CrawlPageQueryDto } from './crawl-page.dto';

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
    const where: any = { jobId };
    const andConditions: any[] = [];

    if (query.status) {
      where.status = query.status;
    }
    if (query.statusCode !== undefined && query.statusCode !== '') {
      where.statusCode = Number(query.statusCode);
    }
    if (query.search) {
      where.OR = [
        { url: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { markdownContent: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const exactScore = query.dataQualityScore ?? query.qualityScore;
    const minScore = query.minDataQualityScore ?? query.minQualityScore;
    const maxScore = query.maxDataQualityScore ?? query.maxQualityScore;

    if (exactScore !== undefined && exactScore !== '') {
      where.dataQualityScore = Number(exactScore);
    } else {
      if (minScore !== undefined && minScore !== '') {
        where.dataQualityScore = {
          ...(where.dataQualityScore || {}),
          gte: Number(minScore),
        };
      }
      if (maxScore !== undefined && maxScore !== '') {
        where.dataQualityScore = {
          ...(where.dataQualityScore || {}),
          lte: Number(maxScore),
        };
      }
    }

    if (query.hasImages !== undefined && query.hasImages !== '') {
      const isTrue = query.hasImages === true || query.hasImages === 'true' || query.hasImages === '1';
      if (isTrue) {
        andConditions.push({ assets: { some: { assetType: 'IMAGE' } } });
      } else {
        andConditions.push({ assets: { none: { assetType: 'IMAGE' } } });
      }
    }

    if (query.hasLinks !== undefined && query.hasLinks !== '') {
      const isTrue = query.hasLinks === true || query.hasLinks === 'true' || query.hasLinks === '1';
      if (isTrue) {
        andConditions.push({ assets: { some: { assetType: 'LINK' } } });
      } else {
        andConditions.push({ assets: { none: { assetType: 'LINK' } } });
      }
    }

    if (query.hasTables !== undefined && query.hasTables !== '') {
      const isTrue = query.hasTables === true || query.hasTables === 'true' || query.hasTables === '1';
      const tableConditions = [
        { markdownContent: { contains: '<table', mode: 'insensitive' } },
        { content: { contains: '<table', mode: 'insensitive' } },
        { markdownContent: { contains: '|', mode: 'insensitive' } },
      ];
      if (isTrue) {
        andConditions.push({ OR: tableConditions });
      } else {
        andConditions.push({
          AND: [
            { markdownContent: { not: { contains: '<table', mode: 'insensitive' } } },
            { content: { not: { contains: '<table', mode: 'insensitive' } } },
            { markdownContent: { not: { contains: '|', mode: 'insensitive' } } },
          ],
        });
      }
    }

    const exactLength = query.contentLength ?? query.wordCount;
    const minLength = query.minContentLength ?? query.minWordCount;
    const maxLength = query.maxContentLength ?? query.maxWordCount;

    if (exactLength !== undefined && exactLength !== '') {
      where.wordCount = Number(exactLength);
    } else {
      if (minLength !== undefined && minLength !== '') {
        where.wordCount = {
          ...(where.wordCount || {}),
          gte: Number(minLength),
        };
      }
      if (maxLength !== undefined && maxLength !== '') {
        where.wordCount = {
          ...(where.wordCount || {}),
          lte: Number(maxLength),
        };
      }
    }

    if (andConditions.length > 0) {
      where.AND = [...(where.AND || []), ...andConditions];
    }

    const sortBy = query.sortBy || 'createdAt';
    const order = query.order || 'asc';
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'url',
      'title',
      'statusCode',
      'status',
      'crawledAt',
      'dataQualityScore',
      'wordCount',
    ];
    const orderBy: any = allowedSortFields.includes(sortBy)
      ? { [sortBy]: order }
      : { createdAt: 'asc' };

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);
    const skip = (page - 1) * limit;

    const select: any = {
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

    if (query.preview === true || query.preview === 'true') {
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

  update(id: string, data: {
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
  }) {
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
      },
    });
  }
}