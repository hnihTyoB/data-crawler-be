import { CrawlJob, CrawlPage } from "@prisma/client";
import path from "path";
import {
  ensureJobExportStructure,
  getFileSizeBytes,
} from "../../common/helpers/file.helper";
import { StorageFactory } from "../../common/storage/storage.factory";
import { storageConfig } from "../../config/storage.config";

export interface ExportResult {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface IExportService {
  export(job: CrawlJob & { pages: CrawlPage[] }): Promise<ExportResult>;
}

type ExportExecutionResult =
  | {
      fileName: string;
      filePath: string;
      fileSize?: number;
      stored?: false;
    }
  | {
      fileName: string;
      filePath: string;
      fileSize: number;
      stored: true;
    };

export abstract class BaseExportService implements IExportService {
  abstract readonly mimeType: string;

  protected abstract executeExport(
    job: CrawlJob & { pages: CrawlPage[] },
  ): Promise<ExportExecutionResult>;

  async export(job: CrawlJob & { pages: CrawlPage[] }): Promise<ExportResult> {
    ensureJobExportStructure(job.id);
    const result = await this.executeExport(job);

    if (result.stored) {
      return {
        fileName: result.fileName,
        filePath: result.filePath,
        fileSize: result.fileSize,
        mimeType: this.mimeType,
      };
    }

    const relativePath = path.relative(
      storageConfig.exportDir,
      result.filePath,
    );
    const destinationKey = relativePath.split(path.sep).join("/");
    const uploadResult = await StorageFactory.getStorageService().uploadFile(
      result.filePath,
      destinationKey,
    );

    return {
      fileName: result.fileName,
      filePath: uploadResult.filePath,
      fileSize:
        uploadResult.sizeBytes ??
        result.fileSize ??
        getFileSizeBytes(result.filePath),
      mimeType: this.mimeType,
    };
  }
}
