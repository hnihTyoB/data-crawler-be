import { CrawlAssetRepository } from "./crawl-asset.repository";
import { AssetType } from "../../common/constants/asset-type.constant";

export class CrawlAssetService {
  private readonly repository = new CrawlAssetRepository();

  async findByJobId(
    jobId: string,
    assetType?: AssetType,
    page = 1,
    limit = 50,
  ) {
    const safeLimit = Math.min(Math.max(1, limit), 500);
    const safePage = Math.max(1, page);
    const [items, total] = await Promise.all([
      this.repository.findByJobId(jobId, assetType, safePage, safeLimit),
      this.repository.countByJobId(jobId, assetType),
    ]);
    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async create(data: {
    jobId: string;
    pageId?: string;
    assetType: AssetType;
    url: string;
    sourceUrl?: string;
    altText?: string;
    mimeType?: string;
  }) {
    return this.repository.create(data);
  }

  async createMany(
    assets: Array<{
      jobId: string;
      pageId?: string;
      assetType: AssetType;
      url: string;
      sourceUrl?: string;
      altText?: string;
      mimeType?: string;
    }>,
  ) {
    return this.repository.createMany(assets);
  }
}
