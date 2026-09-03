import { CrawlJobService } from "../crawl-job.service";
import { CrawlJobRepository } from "../crawl-job.repository";
import { CrawlExportRepository } from "../../crawl-exports/crawl-export.repository";
import { StorageFactory } from "../../../common/storage/storage.factory";

jest.mock("../crawl-job.repository");
jest.mock("../../crawl-exports/crawl-export.repository");
jest.mock("../../../common/storage/storage.factory");
jest.mock("../../../queues/crawl.queue", () => ({
  crawlQueue: {
    add: jest.fn().mockResolvedValue({ id: "bull-job-1" }),
  },
}));

describe("CrawlJobService delete, rerun, and getLogs", () => {
  const mockStorage = {
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (StorageFactory.getStorageService as jest.Mock).mockReturnValue(
      mockStorage,
    );
  });

  const mockJob = {
    id: "job-123",
    userId: "user-1",
    startUrl: "https://example.com",
    mode: "SCRAPE",
    status: "COMPLETED",
    maxPages: 20,
    maxDepth: 1,
    urls: [],
    diffReportPath: "diffs/job-123.json",
  };

  it("deletes completed job and cleans up storage files", async () => {
    const service = new CrawlJobService();
    (CrawlJobRepository.prototype.findById as jest.Mock).mockResolvedValue(
      mockJob,
    );
    (
      CrawlExportRepository.prototype.findByJobId as jest.Mock
    ).mockResolvedValue([{ id: "exp-1", filePath: "exports/exp-1.zip" }]);
    (CrawlJobRepository.prototype.delete as jest.Mock).mockResolvedValue(
      mockJob,
    );

    const result = await service.delete("user-1", "CRAWLER_USER", "job-123");

    expect(result.success).toBe(true);
    expect(mockStorage.deleteFile).toHaveBeenCalledWith("exports/exp-1.zip");
    expect(mockStorage.deleteFile).toHaveBeenCalledWith("diffs/job-123.json");
    expect(CrawlJobRepository.prototype.delete).toHaveBeenCalledWith("job-123");
  });

  it("blocks deletion of an actively running job", async () => {
    const service = new CrawlJobService();
    (CrawlJobRepository.prototype.findById as jest.Mock).mockResolvedValue({
      ...mockJob,
      status: "RUNNING",
    });

    await expect(
      service.delete("user-1", "CRAWLER_USER", "job-123"),
    ).rejects.toThrow("Cannot delete a job that is currently running");
  });

  it("reruns an existing job with identical configuration", async () => {
    const service = new CrawlJobService();
    (CrawlJobRepository.prototype.findById as jest.Mock).mockResolvedValue(
      mockJob,
    );
    const createSpy = jest.spyOn(service, "create").mockResolvedValue({
      ...mockJob,
      id: "job-new",
    } as any);

    const result = await service.rerun("user-1", "CRAWLER_USER", "job-123");

    expect(result.id).toBe("job-new");
    expect(createSpy).toHaveBeenCalledWith("user-1", {
      startUrl: mockJob.startUrl,
      mode: mockJob.mode,
      maxPages: mockJob.maxPages,
      maxDepth: mockJob.maxDepth,
      urls: mockJob.urls,
    });
  });

  it("fetches logs for job", async () => {
    const service = new CrawlJobService();
    (CrawlJobRepository.prototype.findById as jest.Mock).mockResolvedValue(
      mockJob,
    );
    (
      CrawlJobRepository.prototype.findLogsByJobId as jest.Mock
    ).mockResolvedValue({
      items: [{ id: "log-1", step: "INIT", message: "Job started" }],
      total: 1,
      page: 1,
      limit: 50,
    });

    const logs = await service.getLogs(
      "user-1",
      "CRAWLER_USER",
      "job-123",
      1,
      50,
    );

    expect(logs.total).toBe(1);
    expect(logs.items[0].step).toBe("INIT");
  });
});
