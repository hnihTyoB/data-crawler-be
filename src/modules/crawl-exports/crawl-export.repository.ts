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
}

