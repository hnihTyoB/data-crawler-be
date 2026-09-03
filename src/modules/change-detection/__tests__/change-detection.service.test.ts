jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../../crawl-jobs/crawl-job.repository");
jest.mock("fs");

import { ChangeDetectionService } from "../change-detection.service";
import { CrawlJobRepository } from "../../crawl-jobs/crawl-job.repository";
import fs from "fs";

describe("ChangeDetectionService", () => {
  let service: ChangeDetectionService;
  let mockJobRepo: jest.Mocked<CrawlJobRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJobRepo = {
      findByIdWithPages: jest.fn(),
      findPreviousCompletedJobForSchedule: jest.fn(),
      findPreviousCompletedJobForDomain: jest.fn(),
      updateDiffReport: jest.fn(),
    } as any;
    (CrawlJobRepository as jest.Mock).mockReturnValue(mockJobRepo);
    service = new ChangeDetectionService();
  });

  const baseJob = {
    id: "job-current",
    userId: "user-1",
    startUrl: "https://example.com",
    domain: "example.com",
    mode: "CRAWL" as const,
    status: "COMPLETED" as const,
    maxPages: 20,
    maxDepth: 1,
    urls: [],
    totalPages: 2,
    successPages: 2,
    failedPages: 0,
    timeoutMs: 30000,
    retryCount: 3,
    respectRobotsTxt: true,
    userAgent: null,
    delayMs: 1000,
    errorMessage: null,
    firecrawlJobId: null,
    scheduleId: "schedule-1",
    diffReportPath: null,
    diffSummary: null,
    startedAt: new Date(),
    finishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makePage = (
    id: string,
    url: string,
    contentHash: string | null,
    wordCount = 100,
    title = "Page Title",
  ) => ({
    id,
    jobId: "job-current",
    url,
    normalizedUrl: url,
    title,
    description: "Desc",
    markdownContent: "# Content",
    htmlContentPath: null,
    content: null,
    status: "SUCCESS" as const,
    statusCode: 200,
    errorMessage: null,
    hasSensitiveData: false,
    crawledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    wordCount,
    contentHash,
    dataQualityScore: 100,
    warnings: [],
    structuredData: null,
  });

  describe("comparePageSets", () => {
    it("detects all pages as NEW when there is no previous job", () => {
      const current = {
        ...baseJob,
        pages: [
          makePage("p1", "https://example.com/page-1", "hash-1"),
          makePage("p2", "https://example.com/page-2", "hash-2"),
        ],
      };

      const result = service.comparePageSets(current, null);

      expect(result.summary.totalCurrentPages).toBe(2);
      expect(result.summary.totalPreviousPages).toBe(0);
      expect(result.summary.newPagesCount).toBe(2);
      expect(result.summary.modifiedPagesCount).toBe(0);
      expect(result.summary.deletedPagesCount).toBe(0);
      expect(result.summary.unchangedPagesCount).toBe(0);
      expect(result.changes.new).toHaveLength(2);
      expect(result.changes.new[0].url).toBe("https://example.com/page-1");
    });

    it("detects NEW, MODIFIED, UNCHANGED, and DELETED pages correctly", () => {
      const prevJob = {
        ...baseJob,
        id: "job-prev",
        pages: [
          makePage(
            "prev-1",
            "https://example.com/unchanged",
            "hash-same",
            100,
            "Unchanged Title",
          ),
          makePage(
            "prev-2",
            "https://example.com/modified",
            "hash-old",
            100,
            "Old Title",
          ),
          makePage(
            "prev-3",
            "https://example.com/deleted",
            "hash-deleted",
            150,
            "Deleted Title",
          ),
        ],
      };

      const currentJob = {
        ...baseJob,
        pages: [
          makePage(
            "curr-1",
            "https://example.com/unchanged",
            "hash-same",
            100,
            "Unchanged Title",
          ),
          makePage(
            "curr-2",
            "https://example.com/modified",
            "hash-new",
            200,
            "New Title",
          ),
          makePage(
            "curr-3",
            "https://example.com/new-page",
            "hash-new-page",
            120,
            "New Page Title",
          ),
        ],
      };

      const result = service.comparePageSets(currentJob, prevJob);

      expect(result.summary.totalCurrentPages).toBe(3);
      expect(result.summary.totalPreviousPages).toBe(3);
      expect(result.summary.newPagesCount).toBe(1);
      expect(result.summary.modifiedPagesCount).toBe(1);
      expect(result.summary.deletedPagesCount).toBe(1);
      expect(result.summary.unchangedPagesCount).toBe(1);

      // Verify NEW
      expect(result.changes.new[0].url).toBe("https://example.com/new-page");

      // Verify MODIFIED
      expect(result.changes.modified[0].url).toBe(
        "https://example.com/modified",
      );
      expect(result.changes.modified[0].oldContentHash).toBe("hash-old");
      expect(result.changes.modified[0].newContentHash).toBe("hash-new");
      expect(result.changes.modified[0].wordCountDiff).toBe(100);
      expect(result.changes.modified[0].oldTitle).toBe("Old Title");
      expect(result.changes.modified[0].title).toBe("New Title");

      // Verify DELETED
      expect(result.changes.deleted[0].url).toBe("https://example.com/deleted");
      expect(result.changes.deleted[0].previousContentHash).toBe(
        "hash-deleted",
      );

      // Verify UNCHANGED
      expect(result.changes.unchanged[0].url).toBe(
        "https://example.com/unchanged",
      );
    });

    it("matches URLs despite trailing slash or tracking params differences due to normalization", () => {
      const prevJob = {
        ...baseJob,
        id: "job-prev",
        pages: [makePage("prev-1", "https://example.com/article/", "hash-1")],
      };

      const currentJob = {
        ...baseJob,
        pages: [
          makePage(
            "curr-1",
            "https://example.com/article?utm_source=facebook",
            "hash-1",
          ),
        ],
      };

      const result = service.comparePageSets(currentJob, prevJob);

      expect(result.summary.unchangedPagesCount).toBe(1);
      expect(result.summary.newPagesCount).toBe(0);
      expect(result.summary.deletedPagesCount).toBe(0);
    });
  });

  describe("generateAndSaveDiffReport", () => {
    it("finds baseline for schedule, compares, writes diff_report.json, and updates DB", async () => {
      const current = {
        ...baseJob,
        scheduleId: "schedule-1",
        pages: [makePage("p1", "https://example.com", "hash-1")],
      };
      const prev = {
        ...baseJob,
        id: "job-prev",
        scheduleId: "schedule-1",
        pages: [makePage("p0", "https://example.com", "hash-old")],
      };

      mockJobRepo.findByIdWithPages.mockResolvedValue(current as any);
      mockJobRepo.findPreviousCompletedJobForSchedule.mockResolvedValue(
        prev as any,
      );
      mockJobRepo.updateDiffReport.mockResolvedValue({} as any);
      (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

      const diff = await service.generateAndSaveDiffReport("job-current");

      expect(
        mockJobRepo.findPreviousCompletedJobForSchedule,
      ).toHaveBeenCalledWith("schedule-1", "job-current");
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockJobRepo.updateDiffReport).toHaveBeenCalledWith(
        "job-current",
        expect.stringContaining("diff_report.json"),
        expect.objectContaining({ modifiedPagesCount: 1 }),
      );
      expect(diff.changes.modified).toHaveLength(1);
    });
  });
});
