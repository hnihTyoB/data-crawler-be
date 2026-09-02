import { AssetType } from '@prisma/client';

export interface CreateCrawlAssetDto {
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
}
