import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { StorageFactory } from '../storage.factory';
import { LocalStorageService } from '../local-storage.service';
import { S3StorageService } from '../s3-storage.service';
import { storageConfig } from '../../../config/storage.config';

const mockUploadDone = jest.fn();

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: mockUploadDone,
  })),
}));

describe('Storage providers', () => {
  const originalDriver = storageConfig.driver;
  const localTestKey = 'storage-provider-tests/streamed.txt';
  const localTestPath = path.join(storageConfig.exportDir, localTestKey);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadDone.mockResolvedValue({});
  });

  afterEach(() => {
    storageConfig.driver = originalDriver;
    fs.rmSync(path.dirname(localTestPath), { recursive: true, force: true });
  });

  it('selects local and S3 providers from STORAGE_DRIVER', () => {
    storageConfig.driver = 'local';
    expect(StorageFactory.getStorageService()).toBeInstanceOf(
      LocalStorageService,
    );

    storageConfig.driver = 's3';
    expect(StorageFactory.getStorageService()).toBeInstanceOf(S3StorageService);
  });

  it('streams to local storage without collecting the source in memory', async () => {
    const service = new LocalStorageService();
    const source = Readable.from(['large-', 'zip-', 'content']);

    const result = await service.uploadStream(localTestKey, source, {
      contentType: 'application/zip',
    });

    expect(fs.readFileSync(result.filePath, 'utf8')).toBe('large-zip-content');
    expect(result.sizeBytes).toBe(Buffer.byteLength('large-zip-content'));
  });

  it('uses a bounded multipart upload with a Readable body for S3/MinIO', async () => {
    const mockClient = { send: jest.fn() };
    const service = new S3StorageService(mockClient as unknown as S3Client);
    const source = Readable.from(['zip-content']);

    const result = await service.uploadStream('jobs\\job-1.zip', source, {
      contentType: 'application/zip',
    });

    expect(Upload).toHaveBeenCalledWith(
      expect.objectContaining({
        client: mockClient,
        params: expect.objectContaining({
          Key: 'jobs/job-1.zip',
          Body: source,
          ContentType: 'application/zip',
        }),
        queueSize: 2,
        partSize: 8 * 1024 * 1024,
        leavePartsOnError: false,
      }),
    );
    expect(mockUploadDone).toHaveBeenCalledTimes(1);
    expect(result.filePath).toBe('jobs/job-1.zip');
  });

  it('streams downloads and checks object existence through the S3 client', async () => {
    const body = Readable.from(['download']);
    const mockClient = {
      send: jest
        .fn()
        .mockResolvedValueOnce({ Body: body })
        .mockResolvedValueOnce({}),
    };
    const service = new S3StorageService(mockClient as unknown as S3Client);

    await expect(service.getReadStream('job-1/result.zip')).resolves.toBe(body);
    await expect(service.exists('job-1/result.zip')).resolves.toBe(true);
    expect(mockClient.send).toHaveBeenCalledTimes(2);
  });

  it('returns false when S3/MinIO reports a missing object', async () => {
    const mockClient = {
      send: jest.fn().mockRejectedValue({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      }),
    };
    const service = new S3StorageService(mockClient as unknown as S3Client);

    await expect(service.exists('missing.zip')).resolves.toBe(false);
  });
});
