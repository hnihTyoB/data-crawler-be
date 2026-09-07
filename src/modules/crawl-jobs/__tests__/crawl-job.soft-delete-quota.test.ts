import { CrawlJobRepository } from "../crawl-job.repository";
import { prisma } from "../../../database/prisma.client";
import { JOB_STATUS } from "../../../common/constants/job-status.constant";

jest.mock("../../../database/prisma.client", () => ({
  prisma: {
    $transaction: jest.fn(),
    crawlAsset: { deleteMany: jest.fn() },
    crawlJobLog: { deleteMany: jest.fn() },
    crawlExport: { deleteMany: jest.fn() },
    crawlPage: { deleteMany: jest.fn() },
    crawlJob: {
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

describe("CrawlJobRepository soft-delete and quota retention", () => {
  let repository: CrawlJobRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CrawlJobRepository();
  });

  it("delete() soft-deletes the job and cleans up child resources in a transaction", async () => {
    const mockTx = {
      crawlAsset: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      crawlJobLog: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      crawlExport: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      crawlPage: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
      crawlJob: {
        update: jest.fn().mockResolvedValue({ id: "job-1", deletedAt: new Date(), deletedBy: "user-1" }),
      },
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(mockTx));

    const result = await repository.delete("job-1", "user-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mockTx.crawlAsset.deleteMany).toHaveBeenCalledWith({ where: { crawlJobId: "job-1" } });
    expect(mockTx.crawlJobLog.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(mockTx.crawlExport.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(mockTx.crawlPage.deleteMany).toHaveBeenCalledWith({ where: { jobId: "job-1" } });
    expect(mockTx.crawlJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: "user-1",
        }),
      }),
    );
    expect(result.deletedBy).toBe("user-1");
  });

  it("findById() excludes soft-deleted jobs by returning null when deletedAt is present", async () => {
    (prisma.crawlJob.findUnique as jest.Mock).mockResolvedValue({
      id: "deleted-job-id",
      deletedAt: new Date(),
    });

    const result = await repository.findById("deleted-job-id");

    expect(prisma.crawlJob.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "deleted-job-id" },
      }),
    );
    expect(result).toBeNull();
  });

  it("countJobsSince() preserves daily quota count by including soft-deleted jobs", async () => {
    const sinceDate = new Date("2026-09-07T00:00:00Z");
    (prisma.crawlJob.count as jest.Mock).mockResolvedValue(5);

    const count = await repository.countJobsSince("user-1", sinceDate);

    expect(count).toBe(5);
    // Notice: deletedAt is NOT filtered out, so daily job quota usage is retained
    expect(prisma.crawlJob.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        createdAt: { gte: sinceDate },
      },
    });
  });

  it("sumPagesCrawledByUser() preserves crawled pages usage by including soft-deleted jobs", async () => {
    (prisma.crawlJob.aggregate as jest.Mock).mockResolvedValue({
      _sum: { totalPages: 150 },
    });

    const pages = await repository.sumPagesCrawledByUser("user-1");

    expect(pages).toBe(150);
    // Notice: deletedAt is NOT filtered out, so totalPages crawled history is retained
    expect(prisma.crawlJob.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      _sum: { totalPages: true },
    });
  });

  it("countConcurrentJobs() excludes soft-deleted jobs", async () => {
    (prisma.crawlJob.count as jest.Mock).mockResolvedValue(1);

    await repository.countConcurrentJobs("user-1", [JOB_STATUS.RUNNING]);

    expect(prisma.crawlJob.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          status: { in: [JOB_STATUS.RUNNING] },
          deletedAt: null,
        }),
      }),
    );
  });
});
