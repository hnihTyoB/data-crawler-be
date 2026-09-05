import fs from "fs";
import { parse as parseHtml } from "node-html-parser";
import {
  CrawlJob,
  CrawlPage,
  CrawlAsset,
} from "../../common/types/database.types";
import { CrawlAssetRepository } from "../crawl-assets/crawl-asset.repository";
import { JOB_EXPORT_FILES } from "../../common/constants/storage-path.constant";
import { EXPORT_MIME_TYPES } from "../../common/constants/export-type.constant";
import {
  buildJobDataFilePath,
  buildJobDataRawFilePath,
  buildJobDataCleanFilePath,
} from "../../common/helpers/file.helper";
import { BaseExportService } from "./base-export.service";
import { extractDomain } from "../../common/helpers/url.helper";
import { TableRecord } from "../../common/types/data-contract.types";
import {
  transformPageToRecord,
  buildPagesJsonEnvelope,
} from "../../common/helpers/data-contract.helper";

export class JsonExportService extends BaseExportService {
  readonly mimeType = EXPORT_MIME_TYPES.JSON;
  private readonly crawlAssetRepository = new CrawlAssetRepository();

  protected async executeExport(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{ fileName: string; filePath: string }> {
    const { fileName, filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.PAGES_JSON,
    );

    const assets = (await this.crawlAssetRepository.findAssetsForJsonExport(
      job.id,
    )) as unknown as CrawlAsset[];

    const seenContentHashes = new Set<string>();
    const jobDomain = job.domain || extractDomain(job.startUrl);

    const pages = job.pages.map((page) => {
      const pageAssets = assets.filter((a) => a.pageId === page.id);
      const tables = this.parsePageTables(
        page.content || page.markdownContent,
        page.url,
      );

      return transformPageToRecord({
        page,
        assets: pageAssets,
        tables,
        jobDomain,
        seenContentHashes,
      });
    });

    const wrapper = buildPagesJsonEnvelope(job.id, pages);
    fs.writeFileSync(filePath, JSON.stringify(wrapper, null, 2), "utf-8");

    // 1. Xuất pages.raw.json (Lọc bỏ các trường dữ liệu sạch & chất lượng)
    const rawPages = pages.map((page) => ({
      id: page.id,
      jobId: page.jobId,
      url: page.url,
      normalizedUrl: page.normalizedUrl,
      status: page.status,
      statusCode: page.statusCode,
      errorMessage: page.errorMessage,
      title: page.title,
      description: page.description,
      rawMarkdown: page.rawMarkdown,
      links: page.links,
      images: page.images,
      tables: page.tables,
      crawledAt: page.crawledAt,
    }));
    const { filePath: rawFilePath } = buildJobDataRawFilePath(
      job.id,
      JOB_EXPORT_FILES.PAGES_RAW_JSON,
    );
    const rawWrapper = buildPagesJsonEnvelope(job.id, rawPages);
    fs.writeFileSync(rawFilePath, JSON.stringify(rawWrapper, null, 2), "utf-8");

    // 2. Xuất pages.clean.json (Lọc bỏ trường rawMarkdown)
    const cleanPages = pages.map((page) => ({
      id: page.id,
      jobId: page.jobId,
      url: page.url,
      normalizedUrl: page.normalizedUrl,
      status: page.status,
      statusCode: page.statusCode,
      errorMessage: page.errorMessage,
      title: page.title,
      description: page.description,
      cleanText: page.cleanText,
      mainContent: page.mainContent,
      wordCount: page.wordCount,
      contentHash: page.contentHash,
      dataQualityScore: page.dataQualityScore,
      warnings: page.warnings,
      links: page.links,
      images: page.images,
      tables: page.tables,
      crawledAt: page.crawledAt,
    }));
    const { filePath: cleanFilePath } = buildJobDataCleanFilePath(
      job.id,
      JOB_EXPORT_FILES.PAGES_CLEAN_JSON,
    );
    const cleanWrapper = buildPagesJsonEnvelope(job.id, cleanPages);
    fs.writeFileSync(
      cleanFilePath,
      JSON.stringify(cleanWrapper, null, 2),
      "utf-8",
    );

    return { fileName, filePath };
  }

  private parsePageTables(
    content: string | null,
    pageUrl: string,
  ): TableRecord[] {
    const rawHtml = content ?? "";
    if (!rawHtml.includes("<table")) return [];

    try {
      return parseHtml(rawHtml)
        .querySelectorAll("table")
        .map((table, tableIndex) => {
          const headers = table
            .querySelectorAll("thead th, tr:first-child th")
            .map((cell) => cell.text.trim());
          const rows = table
            .querySelectorAll("tbody tr, tr")
            .map((row) =>
              row.querySelectorAll("td").map((cell) => cell.text.trim()),
            )
            .filter((row) => row.length > 0);

          return {
            tableIndex,
            headers,
            rowsCount: rows.length,
            colsCount: Math.max(
              headers.length,
              ...rows.map((row) => row.length),
            ),
            sheetName: this.buildTableSheetName(pageUrl, tableIndex),
          };
        })
        .filter((table) => table.headers.length > 0 || table.rowsCount > 0);
    } catch (error) {
      console.error("Failed to parse HTML tables for JSON export:", error);
      return [];
    }
  }

  private buildTableSheetName(pageUrl: string, tableIndex: number): string {
    return `Table-P${pageUrl
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/[^a-zA-Z0-9]/g, "-")
      .slice(0, 15)
      .replace(/-+$/, "")}-${tableIndex + 1}`.slice(0, 31);
  }
}
