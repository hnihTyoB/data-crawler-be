jest.mock("../../../database/prisma.client", () => ({
  prisma: {
    crawlExport: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    crawlJob: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../../modules/exports/export.service");
jest.mock("../../../modules/exports/json-export.service");
jest.mock("../../../modules/exports/csv-export.service");
jest.mock("../../../modules/exports/xlsx-export.service");
jest.mock("../../../modules/exports/markdown-export.service");
jest.mock("../../../modules/exports/zip-export.service");
jest.mock("../../../modules/audit-logs/audit-log.service");
jest.mock("../../../common/storage/storage-download.helper");

import { prisma } from "../../../database/prisma.client";
import { CrawlExportService } from "../crawl-export.service";
import { ExportService } from "../../../modules/exports/export.service";
import { streamStorageDownload } from "../../../common/storage/storage-download.helper";

// ── Factories ──────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, any> = {}): any {
  return {
    id: "job-1",
    userId: "user-1",
    status: "COMPLETED",
    startUrl: "https://example.com",
    domain: "example.com",
    mode: "SCRAPE",
    maxPages: 20,
    maxDepth: 1,
    urls: [],
    ...overrides,
  };
}

function makeExport(overrides: Record<string, any> = {}): any {
  return {
    id: "export-1",
    jobId: "job-1",
    exportType: "JSON",
    status: "COMPLETED",
    fileName: "pages.json",
    filePath: "/storage/job-1/data/pages.json",
    fileSize: 512,
    mimeType: "application/json",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── CrawlExportService ─────────────────────────────────────────────────────

describe("CrawlExportService", () => {
  let service: CrawlExportService;
  let mockExportService: jest.Mocked<ExportService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrawlExportService();
    mockExportService = {
      generate: jest.fn(),
    } as any;
    (ExportService as jest.Mock).mockImplementation(() => mockExportService);
  });

  describe("createExport()", () => {
    it("generates and returns an export record for a COMPLETED job", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
      const exportRecord = makeExport();
      mockExportService.generate.mockResolvedValue(exportRecord as any);

      const result = await service.createExport(
        "user-1",
        "CRAWLER_USER",
        "job-1",
        "JSON",
      );

      expect(mockExportService.generate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "job-1" }),
        "JSON",
      );
      expect(result).toEqual(exportRecord);
    });

    it("throws 400 when job is still RUNNING", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ status: "RUNNING" }),
      );

      await expect(
        service.createExport("user-1", "CRAWLER_USER", "job-1", "JSON"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("allows exporting a CANCELED job when successPages > 0", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ status: "CANCELED", successPages: 5 }),
      );
      const exportRecord = makeExport();
      mockExportService.generate.mockResolvedValue(exportRecord as any);

      const result = await service.createExport(
        "user-1",
        "CRAWLER_USER",
        "job-1",
        "JSON",
      );

      expect(mockExportService.generate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "job-1" }),
        "JSON",
      );
      expect(result).toEqual(exportRecord);
    });

    it("throws 400 when CANCELED job has 0 successPages", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ status: "CANCELED", successPages: 0 }),
      );

      await expect(
        service.createExport("user-1", "CRAWLER_USER", "job-1", "JSON"),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("allows exporting a FAILED job when successPages > 0", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ status: "FAILED", successPages: 10 }),
      );
      const exportRecord = makeExport();
      mockExportService.generate.mockResolvedValue(exportRecord as any);

      const result = await service.createExport(
        "user-1",
        "CRAWLER_USER",
        "job-1",
        "CSV",
      );

      expect(mockExportService.generate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "job-1" }),
        "CSV",
      );
      expect(result).toEqual(exportRecord);
    });

    it("throws 404 when job does not exist", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createExport("user-1", "CRAWLER_USER", "job-1", "JSON"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 404 when non-owner tries to export another user job", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ userId: "other-user" }),
      );

      await expect(
        service.createExport("user-1", "CRAWLER_USER", "job-1", "JSON"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("allows ADMIN to export any user job", async () => {
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ userId: "other-user" }),
      );
      mockExportService.generate.mockResolvedValue(makeExport() as any);

      const result = await service.createExport(
        "admin-1",
        "ADMIN",
        "job-1",
        "JSON",
      );

      expect(result).toBeDefined();
    });
  });

  describe("findById()", () => {
    it("returns export when user owns the associated job", async () => {
      (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(
        makeExport(),
      );
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());

      const result = await service.findById(
        "user-1",
        "CRAWLER_USER",
        "export-1",
      );

      expect(result).toMatchObject({ id: "export-1" });
    });

    it("throws 404 when export does not exist", async () => {
      (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findById("user-1", "CRAWLER_USER", "export-1"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 404 when non-owner tries to access export", async () => {
      (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(
        makeExport(),
      );
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ userId: "other-user" }),
      );

      await expect(
        service.findById("user-1", "CRAWLER_USER", "export-1"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("allows ADMIN to access any export", async () => {
      (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(
        makeExport(),
      );
      (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(
        makeJob({ userId: "other-user" }),
      );

      const result = await service.findById("admin-1", "ADMIN", "export-1");

      expect(result).toMatchObject({ id: "export-1" });
    });
  });
});

// ── CrawlExportController.download ────────────────────────────────────────

describe("CrawlExportController — download()", () => {
  const { CrawlExportController } = require("../crawl-export.controller");
  const {
    AuditLogService,
  } = require("../../../modules/audit-logs/audit-log.service");

  let controller: any;
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    AuditLogService.prototype.log = jest.fn().mockResolvedValue(undefined);
    (streamStorageDownload as jest.Mock).mockResolvedValue(undefined);
    controller = new CrawlExportController();
    req = {
      user: { id: "user-1", role: "CRAWLER_USER" },
      params: { exportId: "export-1" },
      ip: "127.0.0.1",
      headers: { "user-agent": "jest" },
    };
    res = {};
    next = jest.fn();
  });

  it("streams the export through the configured storage provider", async () => {
    const exportRecord = makeExport();
    (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(
      exportRecord,
    );
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());

    await controller.download(req, res, next);

    expect(streamStorageDownload).toHaveBeenCalledWith(exportRecord, res);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next with 404 when the object does not exist in storage", async () => {
    const missingError = Object.assign(new Error("missing"), {
      statusCode: 404,
    });
    (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(
      makeExport(),
    );
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue(makeJob());
    (streamStorageDownload as jest.Mock).mockRejectedValueOnce(missingError);

    await controller.download(req, res, next);

    expect(next).toHaveBeenCalledWith(missingError);
  });

  it("calls next with error when export record not found", async () => {
    (prisma.crawlExport.findUnique as jest.Mock).mockResolvedValue(null);

    await controller.download(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(streamStorageDownload).not.toHaveBeenCalled();
  });
});
