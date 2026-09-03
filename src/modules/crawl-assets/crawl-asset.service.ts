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
    return this.repository.findByJobId(jobId, assetType, page, limit);
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
