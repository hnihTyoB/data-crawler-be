import fs from 'fs';
import path from 'path';
import { CrawlJob, CrawlPage } from '@prisma/client';
import { BaseExportService } from '../base-export.service';
import { StorageFactory } from '../../../common/storage/storage.factory';
import { IStorageService } from '../../../common/storage/storage.interface';
import { buildJobDataFilePath } from '../../../common/helpers/file.helper';
import { JOB_EXPORT_FILES } from '../../../common/constants/storage-path.constant';

class TestExportService extends BaseExportService {
  readonly mimeType = 'application/json';

  protected async executeExport(job: CrawlJob & { pages: CrawlPage[] }) {
    const result = buildJobDataFilePath(job.id, JOB_EXPORT_FILES.PAGES_JSON);
    fs.writeFileSync(result.filePath, '{"ok":true}', 'utf8');
    return result;
  }
}

class TestStoredExportService extends BaseExportService {
  readonly mimeType = 'application/zip';

  protected async executeExport() {
    return {
      fileName: 'result.zip',
      filePath: `${jobId}/result.zip`,
      fileSize: 123,
      stored: true as const,
    };
  }
}

const jobId = 'base-export-storage-regression';

describe('BaseExportService storage upload', () => {
  const rootDir = path.join(process.cwd(), 'storage', 'exports', jobId);

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('uploads generated files and returns the storage path for persistence', async () => {
    const uploadFile = jest.fn(
      async (localFilePath: string, destinationKey: string) => ({
        fileName: path.posix.basename(destinationKey),
        filePath: destinationKey,
        sizeBytes: fs.statSync(localFilePath).size,
      }),
    );

    jest
      .spyOn(StorageFactory, 'getStorageService')
      .mockReturnValue({ uploadFile } as unknown as IStorageService);

    const job = { id: jobId, pages: [] } as unknown as CrawlJob & {
      pages: CrawlPage[];
    };
    const result = await new TestExportService().export(job);

    expect(uploadFile).toHaveBeenCalledWith(
      expect.stringContaining(
        path.join(jobId, 'data', JOB_EXPORT_FILES.PAGES_JSON),
      ),
      `${jobId}/data/${JOB_EXPORT_FILES.PAGES_JSON}`,
    );
    expect(result).toEqual({
      fileName: JOB_EXPORT_FILES.PAGES_JSON,
      filePath: `${jobId}/data/${JOB_EXPORT_FILES.PAGES_JSON}`,
      fileSize: Buffer.byteLength('{"ok":true}'),
      mimeType: 'application/json',
    });
  });

  it('does not upload an artifact that was already streamed to storage', async () => {
    const uploadFile = jest.fn();
    jest
      .spyOn(StorageFactory, 'getStorageService')
      .mockReturnValue({ uploadFile } as unknown as IStorageService);

    const job = { id: jobId, pages: [] } as unknown as CrawlJob & {
      pages: CrawlPage[];
    };
    const result = await new TestStoredExportService().export(job);

    expect(uploadFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      fileName: 'result.zip',
      filePath: `${jobId}/result.zip`,
      fileSize: 123,
      mimeType: 'application/zip',
    });
  });
});
