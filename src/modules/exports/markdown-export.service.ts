import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { CrawlJob, CrawlPage } from '@prisma/client';
import { JOB_EXPORT_SUBDIRS } from '../../common/constants/storage-path.constant';
import { EXPORT_MIME_TYPES } from '../../common/constants/export-type.constant';
import {
  buildJobMarkdownFilePath,
  buildJobMarkdownRawFilePath,
  buildJobMarkdownCleanFilePath,
  buildJobMarkdownZipPath,
  buildJobSubDir,
  ensureJobExportStructure,
} from '../../common/helpers/file.helper';
import { BaseExportService } from './base-export.service';
import { extractMainContent } from '../../common/helpers/data-contract.helper';

export class MarkdownExportService extends BaseExportService {
  readonly mimeType = EXPORT_MIME_TYPES.MARKDOWN;

  protected async executeExport(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<{ fileName: string; filePath: string }> {
    this.writePageFiles(job);
    return this.zipMarkdownFolder(job.id);
  }

  writePageFiles(
    job: CrawlJob & { pages: CrawlPage[] },
  ): { fileName: string; filePath: string }[] {
    ensureJobExportStructure(job.id);

    const results: { fileName: string; filePath: string }[] = [];

    job.pages.forEach((page, idx) => {
      const rawContent =
        page.markdownContent ??
        `# ${page.title ?? page.url}\n\n**URL:** ${page.url}\n\nNo content available.`;

      // 1. Tương thích ngược: ghi ở markdown/
      const { fileName, filePath } = buildJobMarkdownFilePath(
        job.id,
        idx,
        page.url,
      );
      fs.writeFileSync(filePath, rawContent, 'utf-8');
      results.push({ fileName, filePath });

      // 2. Ghi bản raw ở markdown/raw/
      const { fileName: rawName, filePath: rawPath } = buildJobMarkdownRawFilePath(
        job.id,
        idx,
        page.url,
      );
      fs.writeFileSync(rawPath, rawContent, 'utf-8');
      results.push({ fileName: rawName, filePath: rawPath });

      // 3. Ghi bản clean ở markdown/clean/
      const { fileName: cleanName, filePath: cleanPath } = buildJobMarkdownCleanFilePath(
        job.id,
        idx,
        page.url,
      );
      const cleanContent = extractMainContent(page.markdownContent) ||
        `# ${page.title ?? page.url}\n\n**URL:** ${page.url}\n\nNo clean content available.`;
      fs.writeFileSync(cleanPath, cleanContent, 'utf-8');
      results.push({ fileName: cleanName, filePath: cleanPath });
    });

    return results;
  }

  private async zipMarkdownFolder(
    jobId: string,
  ): Promise<{ fileName: string; filePath: string }> {
    const { fileName, filePath } = buildJobMarkdownZipPath(jobId);
    const markdownDir = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.MARKDOWN);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);

      archive.directory(markdownDir, 'markdown');
      archive.finalize();
    });

    return { fileName, filePath };
  }
}
