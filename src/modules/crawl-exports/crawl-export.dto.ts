import {
  ExportType,
  ExportStatus,
} from "../../common/constants/export-type.constant";

export interface CreateCrawlExportDto {
  jobId: string;
  exportType: ExportType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  expiredAt?: Date | null;
}

export interface UpdateCrawlExportDto {
  status?: ExportStatus;
  fileSize?: number;
  errorMessage?: string;
}
