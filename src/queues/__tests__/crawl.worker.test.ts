import { CrawlJobRepository } from "../../modules/crawl-jobs/crawl-job.repository";
import { CrawlPageRepository } from "../../modules/crawl-pages/crawl-page.repository";
import { CrawlAssetRepository } from "../../modules/crawl-assets/crawl-asset.repository";
import { FirecrawlService } from "../../modules/firecrawl/firecrawl.service";
import { CrawlPageProcessorService } from "../../modules/crawl-pages/crawl-page-processor.service";
import { SensitiveScanService } from "../../modules/crawl-pages/sensitive-scan.service";
import * as urlHelper from "../../common/helpers/url.helper";

jest.mock("../../modules/crawl-jobs/crawl-job.repository");
jest.mock("../../modules/crawl-pages/crawl-page.repository");
jest.mock("../../modules/crawl-assets/crawl-asset.repository");
jest.mock("../../modules/firecrawl/firecrawl.service");
jest.mock("../../modules/crawl-pages/crawl-page-processor.service");
jest.mock("../../modules/crawl-pages/sensitive-scan.service");
jest.mock("../../common/helpers/url.helper");
jest.mock("../../modules/system-config/system-config.service", () => ({
  systemConfigService: {
    isFeatureEnabled: jest.fn().mockResolvedValue(false),
    get: jest.fn().mockResolvedValue(null),
  },
}));

import { processCrawlJob } from "../crawl.worker.processor";

// ── Factories ──────────────────────────────────────────────────────────────

function makeJob(overrides: Record<string, any> = {}): any {
  return {
    id: "job-1",
    userId: "user-1",
    startUrl: "https://example.com",
    domain: "example.com",
    mode: "SCRAPE",
    status: "PENDING",
    maxPages: 20,
    maxDepth: 1,
    urls: [],
    ...overrides,
  };
}

function makePage(overrides: Record<string, any> = {}): any {
  return {
    id: "page-1",
    jobId: "job-1",
    url: "https://example.com",
    title: "Example",
    markdownContent: "# Content",
    status: "SUCCESS",
    statusCode: 200,
    hasSensitiveData: false,
    crawledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeBullJob(jobId: string): any {
  return {
    data: { jobId },
    updateProgress: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────

let mockJobRepo: jest.Mocked<CrawlJobRepository>;
let mockPageRepo: jest.Mocked<CrawlPageRepository>;
let mockAssetRepo: jest.Mocked<CrawlAssetRepository>;
let mockFirecrawl: jest.Mocked<FirecrawlService>;
let mockPageProcessor: jest.Mocked<CrawlPageProcessorService>;
let mockSensitiveScanner: jest.Mocked<SensitiveScanService>;

beforeEach(() => {
  jest.clearAllMocks();

  mockJobRepo = {
    findById: jest.fn(),
    findByIdWithPages: jest.fn(),
    updateStatus: jest.fn(),
    updateProgress: jest.fn(),
    findPreviousCompletedJobForSchedule: jest.fn(),
    findPreviousCompletedJobForDomain: jest.fn(),
    updateDiffReport: jest.fn(),
  } as any;

  mockPageRepo = {
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  } as any;

  mockAssetRepo = {
    createMany: jest.fn(),
  } as any;

  mockFirecrawl = {
    scrapePage: jest.fn(),
    parseSitemapUrls: jest.fn(),
    batchScrapePages: jest.fn(),
    crawlSite: jest.fn(),
  } as any;

  mockPageProcessor = {
    normalize: jest.fn(),
    normalizeFailedPage: jest.fn(),
  } as any;

  mockSensitiveScanner = {
    hasSensitiveData: jest.fn(),
  } as any;

  // Every new X() anywhere in the processor returns the same mock instance
  (CrawlJobRepository as jest.Mock).mockReturnValue(mockJobRepo);
  (CrawlPageRepository as jest.Mock).mockReturnValue(mockPageRepo);
  (CrawlAssetRepository as jest.Mock).mockReturnValue(mockAssetRepo);
  (FirecrawlService as jest.Mock).mockReturnValue(mockFirecrawl);
  (CrawlPageProcessorService as jest.Mock).mockReturnValue(mockPageProcessor);
  (SensitiveScanService as jest.Mock).mockReturnValue(mockSensitiveScanner);

  // Default happy-path stubs
  (urlHelper.validateUrlAsync as jest.Mock).mockResolvedValue(undefined);
  mockJobRepo.findById.mockResolvedValue(makeJob() as any);
  mockJobRepo.findByIdWithPages.mockResolvedValue({
    ...makeJob(),
    pages: [],
  } as any);
  mockJobRepo.updateStatus.mockResolvedValue(undefined as any);
  mockJobRepo.updateProgress.mockResolvedValue(undefined as any);
  mockJobRepo.updateDiffReport.mockResolvedValue(undefined as any);
  mockJobRepo.findPreviousCompletedJobForSchedule.mockResolvedValue(null);
  mockJobRepo.findPreviousCompletedJobForDomain.mockResolvedValue(null);
  mockPageRepo.create.mockResolvedValue(makePage() as any);
  mockPageRepo.upsert.mockResolvedValue(makePage() as any);
  mockPageRepo.update.mockResolvedValue(undefined as any);
  mockAssetRepo.createMany.mockResolvedValue(undefined as any);
  mockPageProcessor.normalize.mockReturnValue({
    url: "https://example.com",
    jobId: "job-1",
  } as any);
  mockPageProcessor.normalizeFailedPage.mockReturnValue({
    url: "https://example.com",
    jobId: "job-1",
  } as any);
  mockSensitiveScanner.hasSensitiveData.mockReturnValue(false);
});

// ── SCRAPE mode ────────────────────────────────────────────────────────────

describe("processCrawlJob — SCRAPE mode", () => {
  it("marks job RUNNING then COMPLETED on successful scrape", async () => {
    mockFirecrawl.scrapePage = jest.fn().mockResolvedValue({
      success: true,
      url: "https://example.com",
      markdown: "# Page",
      metadata: { statusCode: 200 },
    });

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "RUNNING",
      expect.objectContaining({ startedAt: expect.any(Date) }),
    );
    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "COMPLETED",
      expect.objectContaining({
        totalPages: 1,
        successPages: 1,
        failedPages: 0,
      }),
    );
  });

  it("marks job FAILED when scrape returns success:false", async () => {
    mockFirecrawl.scrapePage = jest.fn().mockResolvedValue({
      success: false,
      url: "https://example.com",
      error: "Timeout",
    });

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      expect.objectContaining({ totalPages: 1, failedPages: 1 }),
    );
  });

  it("marks job FAILED when URL validation rejects before crawl", async () => {
    (urlHelper.validateUrlAsync as jest.Mock).mockRejectedValue(
      new Error("URL validation failed before crawl"),
    );

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      expect.objectContaining({ errorMessage: expect.any(String) }),
    );
    expect(mockFirecrawl.scrapePage).not.toHaveBeenCalled();
  });

  it("skips processing when job is CANCELED", async () => {
    mockJobRepo.findById = jest
      .fn()
      .mockResolvedValue(makeJob({ status: "CANCELED" }));

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).not.toHaveBeenCalled();
    expect(mockFirecrawl.scrapePage).not.toHaveBeenCalled();
  });

  it("throws when job not found in DB", async () => {
    mockJobRepo.findById = jest.fn().mockResolvedValue(null);

    await expect(processCrawlJob(makeBullJob("job-1"))).rejects.toThrow(
      "not found",
    );
  });

  it("flags page hasSensitiveData when scanner detects sensitive content", async () => {
    mockFirecrawl.scrapePage = jest.fn().mockResolvedValue({
      success: true,
      url: "https://example.com",
      markdown: "email: user@example.com",
      metadata: { statusCode: 200 },
    });
    // normalize must return non-empty content so scanAndFlagPage doesn't early-return
    mockPageProcessor.normalize.mockReturnValue({
      url: "https://example.com",
      jobId: "job-1",
      markdownContent: "email: user@example.com",
      title: "Example",
      description: "Desc",
    } as any);
    mockSensitiveScanner.hasSensitiveData.mockReturnValue(true);

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockPageRepo.update).toHaveBeenCalledWith("page-1", {
      hasSensitiveData: true,
    });
  });
});

// ── SITEMAP mode ───────────────────────────────────────────────────────────

describe("processCrawlJob — SITEMAP mode", () => {
  beforeEach(() => {
    mockJobRepo.findById = jest
      .fn()
      .mockResolvedValue(makeJob({ mode: "SITEMAP" }));
  });

  it("marks job COMPLETED after batch scrape succeeds", async () => {
    mockFirecrawl.parseSitemapUrls = jest
      .fn()
      .mockResolvedValue(["https://example.com/1", "https://example.com/2"]);
    mockFirecrawl.batchScrapePages = jest.fn().mockResolvedValue({
      success: true,
      pages: [
        {
          url: "https://example.com/1",
          success: true,
          markdown: "# P1",
          metadata: { statusCode: 200 },
        },
        {
          url: "https://example.com/2",
          success: true,
          markdown: "# P2",
          metadata: { statusCode: 200 },
        },
      ],
      failedUrls: [],
      robotsBlockedUrls: [],
      total: 2,
    });

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "COMPLETED",
      expect.objectContaining({
        successPages: 2,
        failedPages: 0,
        totalPages: 2,
      }),
    );
  });

  it("persists the very first provider progress update for live polling", async () => {
    mockFirecrawl.parseSitemapUrls = jest
      .fn()
      .mockResolvedValue(["https://example.com/1", "https://example.com/2"]);
    mockFirecrawl.batchScrapePages = jest
      .fn()
      .mockImplementation(async (_urls, _maxPages, onProgress) => {
        await onProgress?.(1, 2);
        return {
          success: true,
          pages: [
            {
              url: "https://example.com/1",
              success: true,
              markdown: "# P1",
              metadata: { statusCode: 200 },
            },
            {
              url: "https://example.com/2",
              success: true,
              markdown: "# P2",
              metadata: { statusCode: 200 },
            },
          ],
          failedUrls: [],
          robotsBlockedUrls: [],
          total: 2,
        };
      });

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateProgress).toHaveBeenCalledWith("job-1", {
      successPages: 1,
      totalPages: 2,
    });
  });

  it("marks job FAILED when sitemap parse throws", async () => {
    mockFirecrawl.parseSitemapUrls = jest
      .fn()
      .mockRejectedValue(new Error("Sitemap fetch failed"));

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      expect.objectContaining({ errorMessage: expect.any(String) }),
    );
  });

  it("marks job FAILED when sitemap returns 0 URLs", async () => {
    mockFirecrawl.parseSitemapUrls = jest.fn().mockResolvedValue([]);

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      expect.objectContaining({
        errorMessage: expect.stringContaining("no valid URLs"),
      }),
    );
  });

  it("marks job FAILED when batch scrape returns success:false", async () => {
    mockFirecrawl.parseSitemapUrls = jest
      .fn()
      .mockResolvedValue(["https://example.com/1"]);
    mockFirecrawl.batchScrapePages = jest.fn().mockResolvedValue({
      success: false,
      error: "Batch failed",
      total: 1,
    });

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      expect.objectContaining({ errorMessage: expect.any(String) }),
    );
  });

  it("counts failed pages correctly when some pages fail in batch", async () => {
    mockFirecrawl.parseSitemapUrls = jest
      .fn()
      .mockResolvedValue(["https://example.com/1", "https://example.com/2"]);
    mockFirecrawl.batchScrapePages = jest.fn().mockResolvedValue({
      success: true,
      pages: [
        {
          url: "https://example.com/1",
          success: true,
          markdown: "# P1",
          metadata: { statusCode: 200 },
        },
        {
          url: "https://example.com/2",
          success: false,
          error: "Timeout",
          metadata: { statusCode: 408 },
        },
      ],
      failedUrls: [],
      robotsBlockedUrls: [],
      total: 2,
    });
    mockPageRepo.upsert
      .mockResolvedValueOnce(
        makePage({ id: "page-1", url: "https://example.com/1" }),
      )
      .mockResolvedValueOnce(
        makePage({ id: "page-2", url: "https://example.com/2" }),
      );

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "COMPLETED",
      expect.objectContaining({ successPages: 1, failedPages: 1 }),
    );
  });
});

// ── URL_LIST mode ──────────────────────────────────────────────────────────

describe("processCrawlJob — URL_LIST mode", () => {
  beforeEach(() => {
    mockJobRepo.findById = jest.fn().mockResolvedValue(
      makeJob({
        mode: "URL_LIST",
        urls: ["https://example.com/a", "https://example.com/b"],
      }),
    );
  });

  it("skips URL validation for URL_LIST mode", async () => {
    mockFirecrawl.batchScrapePages = jest.fn().mockResolvedValue({
      success: true,
      pages: [],
      failedUrls: [],
      robotsBlockedUrls: [],
      total: 0,
    });

    await processCrawlJob(makeBullJob("job-1"));

    expect(urlHelper.validateUrlAsync).not.toHaveBeenCalled();
  });

  it("marks job FAILED when urls array is empty", async () => {
    mockJobRepo.findById = jest
      .fn()
      .mockResolvedValue(makeJob({ mode: "URL_LIST", urls: [] }));

    await processCrawlJob(makeBullJob("job-1"));

    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "FAILED",
      expect.objectContaining({
        errorMessage: expect.stringContaining("at least one URL"),
      }),
    );
  });

  it("deduplicates pages from batch result when same URL appears twice", async () => {
    mockFirecrawl.batchScrapePages = jest.fn().mockResolvedValue({
      success: true,
      pages: [
        {
          url: "https://example.com/a",
          success: true,
          markdown: "# A",
          metadata: { statusCode: 200 },
        },
        {
          url: "https://example.com/a",
          success: true,
          markdown: "# A dup",
          metadata: { statusCode: 200 },
        },
      ],
      failedUrls: [],
      robotsBlockedUrls: [],
      total: 2,
    });

    await processCrawlJob(makeBullJob("job-1"));

    // Second identical URL is skipped by seenUrls Set — create called only once
    expect(mockPageRepo.upsert).toHaveBeenCalledTimes(1);
  });
});

// ── Real-time persistence & Cancel preservation ────────────────────────────

describe("processCrawlJob — Real-time persistence & Cancel preservation", () => {
  it("persists pages incrementally during live crawl onProgress calls", async () => {
    mockJobRepo.findById = jest.fn().mockResolvedValue(makeJob({ mode: "CRAWL" }));
    mockFirecrawl.crawlSite = jest
      .fn()
      .mockImplementation(async (_url, _maxPages, _maxDepth, onProgress) => {
        // First progress event with 1 page
        await onProgress?.(1, 2, [
          {
            url: "https://example.com/p1",
            success: true,
            markdown: "# P1",
            metadata: { statusCode: 200 },
          },
        ]);
        return {
          success: true,
          status: "completed",
          pages: [
            {
              url: "https://example.com/p1",
              success: true,
              markdown: "# P1",
              metadata: { statusCode: 200 },
            },
            {
              url: "https://example.com/p2",
              success: true,
              markdown: "# P2",
              metadata: { statusCode: 200 },
            },
          ],
          failedUrls: [],
          robotsBlockedUrls: [],
          total: 2,
        };
      });

    await processCrawlJob(makeBullJob("job-1"));

    // Upsert called twice for 2 pages
    expect(mockPageRepo.upsert).toHaveBeenCalledTimes(2);
    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "COMPLETED",
      expect.objectContaining({
        successPages: 2,
        totalPages: 2,
      }),
    );
  });

  it("preserves scraped pages and maintains CANCELED status when cancelled during crawl", async () => {
    mockJobRepo.findById = jest.fn().mockResolvedValue(makeJob({ mode: "CRAWL" }));
    mockFirecrawl.crawlSite = jest
      .fn()
      .mockImplementation(async (_url, _maxPages, _maxDepth, onProgress) => {
        await onProgress?.(1, 10, [
          {
            url: "https://example.com/p1",
            success: true,
            markdown: "# P1",
            metadata: { statusCode: 200 },
          },
        ]);
        return {
          success: false,
          status: "cancelled",
          error: "Cancelled locally",
          pages: [],
          total: 10,
        };
      });

    await processCrawlJob(makeBullJob("job-1"));

    // Page p1 was persisted during onProgress
    expect(mockPageRepo.upsert).toHaveBeenCalledTimes(1);
    // Preserved CANCELED status instead of overwriting to FAILED
    expect(mockJobRepo.updateStatus).toHaveBeenCalledWith(
      "job-1",
      "CANCELED",
      expect.objectContaining({
        successPages: 1,
      }),
    );
  });
});

