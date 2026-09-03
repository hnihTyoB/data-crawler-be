import fs from "fs";
import { CrawlAsset, CrawlJob, CrawlPage } from "@prisma/client";
import { CrawlAssetRepository } from "../crawl-assets/crawl-asset.repository";
import { JOB_EXPORT_FILES } from "../../common/constants/storage-path.constant";
import { EXPORT_MIME_TYPES } from "../../common/constants/export-type.constant";
import {
  buildJobDataFilePath,
  ensureJobExportStructure,
} from "../../common/helpers/file.helper";
import { BaseExportService } from "./base-export.service";
import { extractDomain } from "../../common/helpers/url.helper";
import {
  extractMainContent,
  stripMarkdown,
} from "../../common/helpers/data-contract.helper";

export class CsvExportService extends BaseExportService {
  readonly mimeType = EXPORT_MIME_TYPES.CSV;
  private readonly crawlAssetRepository = new CrawlAssetRepository();

  protected async executeExport(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{ fileName: string; filePath: string }> {
    // Fetch assets once — reused for links.csv and images.csv
    const assets = await this.crawlAssetRepository.findByJobId(job.id);

    // 1. pages.csv
    const { fileName, filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.PAGES_CSV,
    );

    const headers = [
      "url",
      "title",
      "description",
      "status",
      "statusCode",
      "rawMarkdown",
      "cleanText",
      "mainContent",
      "crawledAt",
    ];
    const rows = job.pages.map((page) => {
      const rawMarkdown = page.markdownContent ?? "";
      const mainContent = extractMainContent(rawMarkdown);
      const cleanText = mainContent ? stripMarkdown(mainContent) : "";

      return [
        this.escapeCsv(page.url),
        this.escapeCsv(page.title ?? ""),
        this.escapeCsv(page.description ?? ""),
        this.escapeCsv(page.status),
        page.statusCode ?? "",
        this.escapeCsv(rawMarkdown),
        this.escapeCsv(cleanText),
        this.escapeCsv(mainContent),
        page.crawledAt?.toISOString() ?? "",
      ];
    });

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    fs.writeFileSync(filePath, csv, "utf-8");

    // 2. links.csv
    await this.exportLinks(job, assets);

    // 3. images.csv
    await this.exportImages(job, assets);

    return { fileName, filePath };
  }

  async exportLinks(
    job: CrawlJob & { pages: CrawlPage[] },
    assets: CrawlAsset[],
  ): Promise<{ fileName: string; filePath: string }> {
    ensureJobExportStructure(job.id);
    const { fileName, filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.LINKS_CSV,
    );

    const links = assets.filter((a) => a.assetType === "LINK");
    const headers = ["pageId", "sourceUrl", "url", "type"];
    const jobDomain = job.domain || extractDomain(job.startUrl);

    const rows = links.map((link) => {
      const linkDomain = extractDomain(link.url);
      const type =
        linkDomain === jobDomain || linkDomain.endsWith("." + jobDomain)
          ? "internal"
          : "external";
      const associatedPage = job.pages.find((p) => p.id === link.pageId);
      const sourceUrl = link.sourceUrl || associatedPage?.url || "";

      return [
        link.pageId ?? "",
        this.escapeCsv(sourceUrl),
        this.escapeCsv(link.url),
        type,
      ];
    });

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    fs.writeFileSync(filePath, csv, "utf-8");

    return { fileName, filePath };
  }

  async exportImages(
    job: CrawlJob & { pages: CrawlPage[] },
    assets: CrawlAsset[],
  ): Promise<{ fileName: string; filePath: string }> {
    ensureJobExportStructure(job.id);
    const { fileName, filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.IMAGES_CSV,
    );

    // Dedup images per page (by pageId + url)
    const seenImageKeys = new Set<string>();
    const images = assets.filter((a) => {
      if (a.assetType !== "IMAGE") return false;
      if (!a.pageId) return false;
      const key = `${a.pageId}_${a.url}`;
      if (seenImageKeys.has(key)) return false;
      seenImageKeys.add(key);
      return true;
    });

    const headers = ["pageId", "sourceUrl", "altText", "orderIndex", "type"];

    const rows = images.map((img, index) => {
      const imgSourceUrl = img.url;
      const ext =
        img.mimeType ||
        img.url.split(".").pop()?.split("?")[0]?.toLowerCase() ||
        "image";

      return [
        img.pageId ?? "",
        this.escapeCsv(imgSourceUrl),
        this.escapeCsv(img.altText ?? ""),
        img.orderIndex || index + 1,
        ext,
      ];
    });

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    fs.writeFileSync(filePath, csv, "utf-8");

    return { fileName, filePath };
  }

  private escapeCsv(value: string): string {
    let sanitized = value;
    if (/^[=+\-@\t\r]/.test(sanitized)) {
      sanitized = `'${sanitized}`;
    }
    if (
      sanitized.includes(",") ||
      sanitized.includes('"') ||
      sanitized.includes("\n") ||
      sanitized.includes("\r")
    ) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  }
}
