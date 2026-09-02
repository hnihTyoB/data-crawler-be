import { ExportType, ExportStatus } from '@prisma/client';

export interface CreateCrawlExportDto {
  jobId: string;
  exportType: ExportType;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}

export interface UpdateCrawlExportDto {
  status?: ExportStatus;
  fileSize?: number;
  errorMessage?: string;
}
