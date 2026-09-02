jest.mock('../../../database/prisma.client', () => ({
  prisma: {
    crawlJob: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    crawlExport: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../modules/exports/export.service');
jest.mock('../../../modules/exports/json-export.service');
jest.mock('../../../modules/exports/csv-export.service');
jest.mock('../../../modules/exports/xlsx-export.service');
jest.mock('../../../modules/exports/markdown-export.service');
jest.mock('../../../modules/exports/zip-export.service');
jest.mock('../../../modules/audit-logs/audit-log.service');
jest.mock('../../../common/storage/storage-download.helper');

import { prisma } from '../../../database/prisma.client';
import { CrawlJobService } from '../crawl-job.service';
import { ExportService } from '../../../modules/exports/export.service';
import { AuditLogService } from '../../../modules/audit-logs/audit-log.service';
import { StorageFactory } from '../../../common/storage/storage.factory';
import { streamStorageDownload } from '../../../common/storage/storage-download.helper';

const mockStorage = {
  exists: jest.fn(),
};

// ── Factories ──────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, any> = {}): any {
  return {
    id: 'job-1',
    userId: 'user-1',
    status: 'COMPLETED',
    startUrl: 'https://example.com',
    domain: 'example.com',
    mode: 'SCRAPE',
    maxPages: 20,
    maxDepth: 1,
    urls: [],
    exports: [],
    ...overrides,
  };
}

function makeExport(overrides: Record<string, any> = {}): any {
  return {
    id: 'export-1',
    jobId: 'job-1',
    exportType: 'ZIP',
    status: 'COMPLETED',
    fileName: 'result.zip',
    filePath: '/storage/job-1/result.zip',
    fileSize: 2048,
    mimeType: 'application/zip',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── CrawlJobService.getDownloadFile ────────────────────────────────────────

describe('CrawlJobService.getDownloadFile()', () => {
  let service: CrawlJobService;
  let mockExportService: jest.Mocked<ExportService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrawlJobService();
    mockExportService = { generate: jest.fn() } as any;
    (ExportService as jest.Mock).mockImplementation(() => mockExportService);
    mockStorage.exists.mockResolvedValue(true);
    jest
      .spyOn(StorageFactory, 'getStorageService')
      .mockReturnValue(mockStorage as any);
  });

  it('returns an existing COMPLETED ZIP when it exists in storage', async () => {
    const existingExport = makeExport();
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
    (prisma.crawlExport.findMany as jest.Mock).mockResolvedValue([
      existingExport,
    ]);

    const result = await service.getDownloadFile(
      'user-1',
      'CRAWLER_USER',
      'job-1',
    );

    expect(result).toEqual(existingExport);
    expect(mockStorage.exists).toHaveBeenCalledWith(existingExport.filePath);
    expect(mockExportService.generate).not.toHaveBeenCalled();
  });

  it('generates a new ZIP when no existing export found', async () => {
    const newExport = makeExport({ id: 'export-new' });
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
    (prisma.crawlExport.findMany as jest.Mock).mockResolvedValue([]);
    mockExportService.generate.mockResolvedValue(newExport as any);

    const result = await service.getDownloadFile(
      'user-1',
      'CRAWLER_USER',
      'job-1',
    );

    expect(mockExportService.generate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1' }),
      'ZIP',
    );
    expect(result).toEqual(newExport);
  });

  it('generates a new ZIP when the existing object is missing from storage', async () => {
    const staleExport = makeExport();
    const newExport = makeExport({ id: 'export-new' });
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
    (prisma.crawlExport.findMany as jest.Mock).mockResolvedValue([staleExport]);
    mockStorage.exists.mockResolvedValue(false);
    mockExportService.generate.mockResolvedValue(newExport as any);

    const result = await service.getDownloadFile(
      'user-1',
      'CRAWLER_USER',
      'job-1',
    );

    expect(mockExportService.generate).toHaveBeenCalled();
    expect(result).toEqual(newExport);
  });

  it('throws 400 when job is not COMPLETED', async () => {
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
      makeJob({ status: 'RUNNING' }),
    );

    await expect(
      service.getDownloadFile('user-1', 'CRAWLER_USER', 'job-1'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when job not found', async () => {
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.getDownloadFile('user-1', 'CRAWLER_USER', 'job-1'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when non-owner tries to download', async () => {
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
      makeJob({ userId: 'other-user' }),
    );

    await expect(
      service.getDownloadFile('user-1', 'CRAWLER_USER', 'job-1'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('skips non-ZIP exports and generates new ZIP', async () => {
    const jsonExport = makeExport({
      exportType: 'JSON',
      fileName: 'pages.json',
    });
    const newZip = makeExport({ id: 'export-new-zip' });
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
    (prisma.crawlExport.findMany as jest.Mock).mockResolvedValue([jsonExport]);
    mockExportService.generate.mockResolvedValue(newZip as any);

    const result = await service.getDownloadFile(
      'user-1',
      'CRAWLER_USER',
      'job-1',
    );

    expect(mockExportService.generate).toHaveBeenCalledWith(
      expect.anything(),
      'ZIP',
    );
    expect(result).toEqual(newZip);
  });

  it('allows ADMIN to download any user job', async () => {
    const existingExport = makeExport();
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
      makeJob({ userId: 'other-user' }),
    );
    (prisma.crawlExport.findMany as jest.Mock).mockResolvedValue([
      existingExport,
    ]);

    const result = await service.getDownloadFile('admin-1', 'ADMIN', 'job-1');

    expect(result).toEqual(existingExport);
  });
});

// ── CrawlJobController.download ────────────────────────────────────────────

describe('CrawlJobController.download()', () => {
  const { CrawlJobController } = require('../crawl-job.controller');

  let controller: any;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (AuditLogService.prototype.log as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (streamStorageDownload as jest.Mock).mockResolvedValue(undefined);
    mockStorage.exists.mockResolvedValue(true);
    jest
      .spyOn(StorageFactory, 'getStorageService')
      .mockReturnValue(mockStorage as any);
    controller = new CrawlJobController();
    req = {
      user: { id: 'user-1', role: 'CRAWLER_USER' },
      params: { id: 'job-1' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
    };
    res = {};
    next = jest.fn();
  });

  it('streams the ZIP through the configured storage provider', async () => {
    const exportRecord = makeExport();
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
    (prisma.crawlExport.findMany as jest.Mock).mockResolvedValue([
      exportRecord,
    ]);

    await controller.download(req, res, next);

    expect(streamStorageDownload).toHaveBeenCalledWith(exportRecord, res);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error when job not found', async () => {
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(null);

    await controller.download(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(streamStorageDownload).not.toHaveBeenCalled();
  });

  it('calls next with 400 error when job is not COMPLETED', async () => {
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
      makeJob({ status: 'RUNNING' }),
    );

    await controller.download(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(streamStorageDownload).not.toHaveBeenCalled();
  });
});
