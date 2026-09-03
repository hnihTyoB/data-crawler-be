import { prisma } from '../../database/prisma.client';
import { CreateCrawlExportDto, UpdateCrawlExportDto } from './crawl-export.dto';

export class CrawlExportRepository {
  create(data: CreateCrawlExportDto) {
    return prisma.crawlExport.create({ data });
  }

  findByJobId(jobId: string) {
    return prisma.crawlExport.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return prisma.crawlExport.findUnique({
      where: { id },
    });
  }

  update(id: string, data: UpdateCrawlExportDto) {
    return prisma.crawlExport.update({
      where: { id },
      data,
    });
  }

  async findAllByUser(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;
    const where = {
      job: {
        userId,
      },
    };

    const [items, total] = await Promise.all([
      prisma.crawlExport.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              startUrl: true,
              domain: true,
              mode: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.crawlExport.count({ where }),
    ]);

    return { items, total, page: safePage, limit: safeLimit };
  }

  delete(id: string) {
    return prisma.crawlExport.delete({
      where: { id },
    });
  }
}

