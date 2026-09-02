import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { ZipExportService } from '../zip-export.service';
import { StorageFactory } from '../../../common/storage/storage.factory';
import { IStorageService } from '../../../common/storage/storage.interface';
import { ensureJobExportStructure } from '../../../common/helpers/file.helper';
import {
  JOB_EXPORT_FILES,
  JOB_EXPORT_SUBDIRS,
} from '../../../common/constants/storage-path.constant';

describe('ZipExportService storage streaming', () => {
  const jobId = 'zip-streaming-regression';
  const rootDir = path.join(process.cwd(), 'storage', 'exports', jobId);

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('streams the ZIP to the configured storage provider instead of buffering it', async () => {
    const exportRoot = ensureJobExportStructure(jobId);
    const dataFile = path.join(
      exportRoot,
      JOB_EXPORT_SUBDIRS.DATA,
      JOB_EXPORT_FILES.PAGES_JSON,
    );
    fs.writeFileSync(dataFile, Buffer.alloc(512 * 1024, 0x61));

    const uploadStream = jest.fn(
      async (destinationKey: string, source: Readable) => {
        expect(source).toBeInstanceOf(Readable);

        let sizeBytes = 0;
        for await (const chunk of source) {
          sizeBytes += Buffer.byteLength(chunk);
        }

        return {
          fileName: path.posix.basename(destinationKey),
          filePath: destinationKey,
          sizeBytes,
        };
      },
    );

    jest
      .spyOn(StorageFactory, 'getStorageService')
      .mockReturnValue({ uploadStream } as unknown as IStorageService);

    const service = new ZipExportService() as unknown as {
      createResultZip: (
        id: string,
      ) => Promise<{ fileName: string; filePath: string; fileSize: number }>;
    };
    const result = await service.createResultZip(jobId);

    expect(uploadStream).toHaveBeenCalledTimes(1);
    expect(uploadStream).toHaveBeenCalledWith(
      `${jobId}/${jobId}.zip`,
      expect.any(Readable),
      expect.objectContaining({ contentType: 'application/zip' }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        fileName: `${jobId}.zip`,
        filePath: `${jobId}/${jobId}.zip`,
        fileSize: expect.any(Number),
      }),
    );
    expect(result.fileSize).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(rootDir, `${jobId}.zip`))).toBe(false);
  });
});
