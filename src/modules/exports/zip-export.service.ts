import fs from "fs";
import path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";
import { CrawlJob, CrawlPage } from "../../common/types/database.types";
import { CrawlAssetRepository } from "../crawl-assets/crawl-asset.repository";
import {
  JOB_EXPORT_FILES,
  JOB_EXPORT_SUBDIRS,
  buildCrawlResultZipKey,
  buildCrawlResultZipName,
} from "../../common/constants/storage-path.constant";
import { EXPORT_MIME_TYPES } from "../../common/constants/export-type.constant";
import {
  buildJobLogsFilePath,
  buildJobRootFilePath,
  ensureJobExportStructure,
  buildJobDataFilePath,
} from "../../common/helpers/file.helper";
import { JsonExportService } from "./json-export.service";
import { CsvExportService } from "./csv-export.service";
import { XlsxExportService } from "./xlsx-export.service";
import { MarkdownExportService } from "./markdown-export.service";
import { BaseExportService } from "./base-export.service";
import {
  extractMainContent,
  countWords,
  hashContent,
  calcDataQualityScore,
  detectWarnings,
} from "../../common/helpers/data-contract.helper";
import { StorageFactory } from "../../common/storage/storage.factory";

export class ZipExportService extends BaseExportService {
  readonly mimeType = EXPORT_MIME_TYPES.ZIP;
  private readonly crawlAssetRepository = new CrawlAssetRepository();

  protected async executeExport(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{
    fileName: string;
    filePath: string;
    fileSize: number;
    stored: true;
  }> {
    const assets = await this.crawlAssetRepository.findByJobId(job.id);

    await new JsonExportService().export(job);
    this.writeStructuredJson(job);
    const csvService = new CsvExportService();
    await csvService.export(job);
    await csvService.exportLinks(job, assets);
    await csvService.exportImages(job, assets);
    await new XlsxExportService().export(job);
    await new MarkdownExportService().export(job);

    this.writeMetadata(job);
    this.writeSummary(job);
    this.writeErrors(job);
    this.writeDataQuality(job);

    return this.createResultZip(job.id);
  }

  private writeStructuredJson(job: CrawlJob & { pages: CrawlPage[] }): void {
    const { filePath } = buildJobDataFilePath(
      job.id,
      JOB_EXPORT_FILES.STRUCTURED_JSON,
    );
    const records = job.pages
      .filter((p) => p.structuredData != null)
      .map((p) => ({
        pageId: p.id,
        url: p.url,
        structuredData: p.structuredData,
      }));
    fs.writeFileSync(
      filePath,
      JSON.stringify({ jobId: job.id, records }, null, 2),
      "utf-8",
    );
  }

  private writeMetadata(job: CrawlJob): void {
    const { filePath } = buildJobRootFilePath(
      job.id,
      JOB_EXPORT_FILES.METADATA,
    );
    const metadata = {
      jobId: job.id,
      startUrl: job.startUrl,
      domain: job.domain,
      mode: job.mode,
      status: job.status,
      maxPages: job.maxPages,
      maxDepth: job.maxDepth,
      exportedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), "utf-8");
  }

  private writeSummary(job: CrawlJob & { pages: CrawlPage[] }): void {
    const { filePath } = buildJobRootFilePath(job.id, JOB_EXPORT_FILES.SUMMARY);
    const successPages = job.pages.filter((p) => p.status === "SUCCESS").length;
    const failedPages = job.pages.filter(
      (p) => p.status !== "SUCCESS" && p.status !== "SKIPPED",
    ).length;

    const summary = {
      jobId: job.id,
      status: job.status,
      totalPages: job.pages.length,
      successPages,
      failedPages,
      exportedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), "utf-8");
  }

  private writeErrors(job: CrawlJob & { pages: CrawlPage[] }): void {
    const { filePath } = buildJobLogsFilePath(
      job.id,
      JOB_EXPORT_FILES.ERRORS_JSON,
    );
    const errors = job.pages
      .filter(
        (p) =>
          p.status !== "SUCCESS" &&
          p.status !== "PENDING" &&
          p.status !== "SKIPPED",
      )
      .map((p) => ({
        url: p.url,
        status: p.status,
        statusCode: p.statusCode,
        errorMessage: p.errorMessage,
        crawledAt: p.crawledAt?.toISOString() ?? null,
      }));
    fs.writeFileSync(filePath, JSON.stringify(errors, null, 2), "utf-8");
  }

  private writeDataQuality(job: CrawlJob & { pages: CrawlPage[] }): void {
    const { filePath } = buildJobRootFilePath(
      job.id,
      JOB_EXPORT_FILES.DATA_QUALITY_JSON,
    );

    const successPages = job.pages.filter((p) => p.status === "SUCCESS");
    const errorPages = job.pages.filter(
      (p) =>
        p.status !== "SUCCESS" &&
        p.status !== "SKIPPED" &&
        p.status !== "PENDING",
    );

    const seenHashes = new Set<string>();
    const warningCounts: Record<string, number> = {};
    let duplicateRemoved = 0;
    let navNoisePages = 0;
    let tooShortPages = 0;

    for (const page of successPages) {
      const rawMarkdown = page.markdownContent ?? null;
      const mainContent = extractMainContent(rawMarkdown) || null;
      const cleanText = mainContent
        ? mainContent
            .replace(/[#*_\[\]`>]/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : null;
      const wordCount = cleanText ? countWords(cleanText) : 0;
      const contentHash = cleanText ? hashContent(cleanText) : null;

      const originalLines = rawMarkdown ? rawMarkdown.split("\n").length : 0;
      const mainLines = mainContent ? mainContent.split("\n").length : 0;
      const isNavNoise =
        originalLines > 10 && (originalLines - mainLines) / originalLines > 0.3;
      const isDuplicate = contentHash !== null && seenHashes.has(contentHash);
      if (contentHash && !isDuplicate) seenHashes.add(contentHash);

      if (isDuplicate) duplicateRemoved++;
      if (isNavNoise) navNoisePages++;
      if (wordCount > 0 && wordCount < 50) tooShortPages++;

      const score = calcDataQualityScore({
        isSuccess: true,
        mainContent,
        wordCount,
        title: page.title ?? null,
        description: page.description ?? null,
      });

      const warnings = detectWarnings({
        title: page.title ?? null,
        description: page.description ?? null,
        wordCount,
        dataQualityScore: score,
        isDuplicateContent: isDuplicate,
        isNavNoise,
      });

      for (const w of warnings) {
        warningCounts[w] = (warningCounts[w] ?? 0) + 1;
      }
    }

    const cleanPages =
      successPages.length - duplicateRemoved - navNoisePages - tooShortPages;
    const cleanDataRatio =
      job.pages.length > 0
        ? parseFloat((Math.max(0, cleanPages) / job.pages.length).toFixed(4))
        : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      jobId: job.id,
      summary: {
        totalPages: job.pages.length,
        successPages: successPages.length,
        errorPages: errorPages.length,
        duplicateRemoved,
        navNoisePages,
        tooShortPages,
        cleanDataRatio,
      },
      warningBreakdown: warningCounts,
      errorBreakdown: Object.fromEntries(
        Object.entries(
          errorPages.reduce((acc: Record<string, number>, p) => {
            acc[p.status] = (acc[p.status] ?? 0) + 1;
            return acc;
          }, {}),
        ),
      ),
    };

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8");
  }

  private async createResultZip(jobId: string): Promise<{
    fileName: string;
    filePath: string;
    fileSize: number;
    stored: true;
  }> {
    const fileName = buildCrawlResultZipName(jobId);
    const destinationKey = buildCrawlResultZipKey(jobId);
    const rootDir = ensureJobExportStructure(jobId);
    const storage = StorageFactory.getStorageService();
    const archive = archiver("zip", { zlib: { level: 9 } });
    const zipStream = new PassThrough();

    archive.on("warning", (error) => {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        zipStream.destroy(error);
      }
    });
    archive.on("error", (error) => zipStream.destroy(error));
    archive.pipe(zipStream);

    const uploadPromise = storage.uploadStream(destinationKey, zipStream, {
      contentType: this.mimeType,
    });

    const metadataPath = path.join(rootDir, JOB_EXPORT_FILES.METADATA);
    if (fs.existsSync(metadataPath)) {
      archive.file(metadataPath, { name: JOB_EXPORT_FILES.METADATA });
    }

    const summaryPath = path.join(rootDir, JOB_EXPORT_FILES.SUMMARY);
    if (fs.existsSync(summaryPath)) {
      archive.file(summaryPath, { name: JOB_EXPORT_FILES.SUMMARY });
    }

    const dataQualityPath = path.join(
      rootDir,
      JOB_EXPORT_FILES.DATA_QUALITY_JSON,
    );
    if (fs.existsSync(dataQualityPath)) {
      archive.file(dataQualityPath, {
        name: JOB_EXPORT_FILES.DATA_QUALITY_JSON,
      });
    }

    const diffReportPath = path.join(
      rootDir,
      JOB_EXPORT_FILES.DIFF_REPORT_JSON,
    );
    if (fs.existsSync(diffReportPath)) {
      archive.file(diffReportPath, {
        name: JOB_EXPORT_FILES.DIFF_REPORT_JSON,
      });
    }

    const dataDir = path.join(rootDir, JOB_EXPORT_SUBDIRS.DATA);
    if (fs.existsSync(dataDir)) {
      const filesToAddToData = [
        JOB_EXPORT_FILES.PAGES_JSON,
        JOB_EXPORT_FILES.STRUCTURED_JSON,
        JOB_EXPORT_FILES.PAGES_CSV,
        JOB_EXPORT_FILES.LINKS_CSV,
        JOB_EXPORT_FILES.IMAGES_CSV,
        JOB_EXPORT_FILES.PAGES_XLSX,
        JOB_EXPORT_FILES.TABLES_XLSX,
      ];
      for (const file of filesToAddToData) {
        const fileToZip = path.join(dataDir, file);
        if (fs.existsSync(fileToZip)) {
          archive.file(fileToZip, {
            name: path.join(JOB_EXPORT_SUBDIRS.DATA, file),
          });
        }
      }

      const rawJsonPath = path.join(
        dataDir,
        "raw",
        JOB_EXPORT_FILES.PAGES_RAW_JSON,
      );
      if (fs.existsSync(rawJsonPath)) {
        archive.file(rawJsonPath, {
          name: path.join(
            JOB_EXPORT_SUBDIRS.DATA_RAW,
            JOB_EXPORT_FILES.PAGES_RAW_JSON,
          ),
        });
      }

      const cleanJsonPath = path.join(
        dataDir,
        "clean",
        JOB_EXPORT_FILES.PAGES_CLEAN_JSON,
      );
      if (fs.existsSync(cleanJsonPath)) {
        archive.file(cleanJsonPath, {
          name: path.join(
            JOB_EXPORT_SUBDIRS.DATA_CLEAN,
            JOB_EXPORT_FILES.PAGES_CLEAN_JSON,
          ),
        });
      }
    }

    const markdownDir = path.join(rootDir, JOB_EXPORT_SUBDIRS.MARKDOWN);
    if (fs.existsSync(markdownDir)) {
      archive.directory(markdownDir, JOB_EXPORT_SUBDIRS.MARKDOWN);
    }

    const rawDir = path.join(rootDir, JOB_EXPORT_SUBDIRS.RAW);
    if (fs.existsSync(rawDir)) {
      const rawFiles = fs.readdirSync(rawDir);
      if (rawFiles.length > 0) {
        archive.directory(rawDir, JOB_EXPORT_SUBDIRS.RAW);
      }
    }

    const logsDir = path.join(rootDir, JOB_EXPORT_SUBDIRS.LOGS);
    if (fs.existsSync(logsDir)) {
      const filesToAddToLogs = [
        JOB_EXPORT_FILES.ERRORS_JSON,
        JOB_EXPORT_FILES.CRAWL_LOG,
      ];
      for (const file of filesToAddToLogs) {
        const fileToZip = path.join(logsDir, file);
        if (fs.existsSync(fileToZip)) {
          archive.file(fileToZip, {
            name: path.join(JOB_EXPORT_SUBDIRS.LOGS, file),
          });
        }
      }
    }

    try {
      const [, uploadResult] = await Promise.all([
        archive.finalize(),
        uploadPromise,
      ]);
      return {
        fileName,
        filePath: uploadResult.filePath,
        fileSize: uploadResult.sizeBytes ?? archive.pointer(),
        stored: true,
      };
    } catch (error) {
      archive.abort();
      zipStream.destroy(error as Error);
      await uploadPromise.catch(() => undefined);
      throw error;
    }
  }
}
