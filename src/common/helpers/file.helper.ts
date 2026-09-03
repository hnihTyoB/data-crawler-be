import path from "path";
import fs from "fs";
import { storageConfig } from "../../config/storage.config";
import {
  JOB_EXPORT_SUBDIRS,
  buildCrawlResultZipName,
  buildMarkdownZipName,
} from "../constants/storage-path.constant";
import { generatePageFileName } from "./slug.helper";

export function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function initLocalStorage(): void {
  // Export generators use this directory for bounded staging even when the
  // final ZIP is streamed to S3/MinIO.
  ensureDirExists(storageConfig.exportDir);
}

export function buildJobRootDir(jobId: string): string {
  const jobDir = path.join(storageConfig.exportDir, jobId);
  ensureDirExists(jobDir);
  return jobDir;
}

export function ensureJobExportStructure(jobId: string): string {
  const rootDir = buildJobRootDir(jobId);
  for (const subdir of Object.values(JOB_EXPORT_SUBDIRS)) {
    ensureDirExists(path.join(rootDir, subdir));
  }
  return rootDir;
}

export function buildJobSubDir(jobId: string, subdir: string): string {
  const dir = path.join(ensureJobExportStructure(jobId), subdir);
  ensureDirExists(dir);
  return dir;
}

export function buildJobRootFilePath(
  jobId: string,
  fileName: string,
): { fileName: string; filePath: string } {
  const rootDir = buildJobRootDir(jobId);
  return { fileName, filePath: path.join(rootDir, fileName) };
}

export function buildJobDataFilePath(
  jobId: string,
  fileName: string,
): { fileName: string; filePath: string } {
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.DATA);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobDataRawFilePath(
  jobId: string,
  fileName: string,
): { fileName: string; filePath: string } {
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.DATA_RAW);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobDataCleanFilePath(
  jobId: string,
  fileName: string,
): { fileName: string; filePath: string } {
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.DATA_CLEAN);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobMarkdownFilePath(
  jobId: string,
  index: number,
  url: string,
  ext = "md",
): { fileName: string; filePath: string } {
  const fileName = generatePageFileName(index, url, ext);
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.MARKDOWN);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobMarkdownRawFilePath(
  jobId: string,
  index: number,
  url: string,
  ext = "md",
): { fileName: string; filePath: string } {
  const fileName = generatePageFileName(index, url, ext);
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.MARKDOWN_RAW);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobMarkdownCleanFilePath(
  jobId: string,
  index: number,
  url: string,
  ext = "md",
): { fileName: string; filePath: string } {
  const fileName = generatePageFileName(index, url, ext);
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.MARKDOWN_CLEAN);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobRawFilePath(
  jobId: string,
  index: number,
  url: string,
  ext = "html",
): { fileName: string; filePath: string } {
  const fileName = generatePageFileName(index, url, ext);
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.RAW);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobLogsFilePath(
  jobId: string,
  fileName: string,
): { fileName: string; filePath: string } {
  const dirPath = buildJobSubDir(jobId, JOB_EXPORT_SUBDIRS.LOGS);
  return { fileName, filePath: path.join(dirPath, fileName) };
}

export function buildJobResultZipPath(jobId: string): {
  fileName: string;
  filePath: string;
} {
  const fileName = buildCrawlResultZipName(jobId);
  const rootDir = buildJobRootDir(jobId);
  return { fileName, filePath: path.join(rootDir, fileName) };
}

export function buildJobMarkdownZipPath(jobId: string): {
  fileName: string;
  filePath: string;
} {
  const fileName = buildMarkdownZipName(jobId);
  const rootDir = buildJobRootDir(jobId);
  return { fileName, filePath: path.join(rootDir, fileName) };
}

export function buildExportFilePath(
  exportDir: string,
  fileName: string,
): string {
  return path.join(exportDir, fileName);
}

export function getFileSizeBytes(filePath: string): number {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}
