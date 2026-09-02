import { Response } from 'express';
import { pipeline } from 'stream/promises';
import { AppError } from '../errors/app-error';
import { ERROR_CODE } from '../errors/error-code';
import { StorageFactory } from './storage.factory';

interface StoredDownload {
  fileName: string;
  filePath: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

export async function streamStorageDownload(
  file: StoredDownload,
  response: Response,
): Promise<void> {
  const storage = StorageFactory.getStorageService();

  if (!(await storage.exists(file.filePath))) {
    throw new AppError(
      'Export file not found in storage',
      404,
      ERROR_CODE.EXPORT_FILE_MISSING,
    );
  }

  const source = await storage.getReadStream(file.filePath);
  const safeFileName = file.fileName.replace(/[\r\n"]/g, '_');
  const encodedFileName = encodeURIComponent(file.fileName);

  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
  );
  response.setHeader(
    'Content-Type',
    file.mimeType || 'application/octet-stream',
  );
  if (file.fileSize !== null && file.fileSize !== undefined) {
    response.setHeader('Content-Length', String(file.fileSize));
  }

  await pipeline(source, response);
}
