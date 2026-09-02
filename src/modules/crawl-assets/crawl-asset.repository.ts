import { prisma } from '../../database/prisma.client';
import { AssetType } from '@prisma/client';

export class CrawlAssetRepository {
  create(data: {
    jobId: string;
    pageId?: string;
    assetType: AssetType;
    url: string;
    sourceUrl?: string;
    altText?: string;
    mimeType?: string;
    orderIndex?: number;
    cssSelector?: string;
    domPath?: string;
  }) {
    const { jobId, ...rest } = data;
    return prisma.crawlAsset.create({
      data: {
        ...rest,
        crawlJobId: jobId,
      },
    });
  }

  createMany(assets: Array<{
    jobId: string;
    pageId?: string;
    assetType: AssetType;
    url: string;
    sourceUrl?: string;
    altText?: string;
    mimeType?: string;
    orderIndex?: number;
  }>) {
    const prismaAssets = assets.map(({ jobId, ...rest }) => ({
      ...rest,
      crawlJobId: jobId,
    }));
    return prisma.crawlAsset.createMany({ data: prismaAssets });
  }

  findByJobId(jobId: string, assetType?: AssetType) {
  return prisma.crawlAsset.findMany({
    where: {
      crawlJobId: jobId,
      ...(assetType ? { assetType } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  }

  findAssetsForJsonExport(jobId: string) {
    return prisma.crawlAsset.findMany({
      where: { crawlJobId: jobId },
      select: {
        pageId: true,
        url: true,
        assetType: true,
        sourceUrl: true,
        altText: true,
        orderIndex: true,
        mimeType: true,
      },
    });
  }

  findByPageId(pageId: string) {
    return prisma.crawlAsset.findMany({
      where: { pageId },
    });
  }
}
