jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../crawl-job.repository");
jest.mock("../../users/user.repository");
jest.mock("../../crawl-exports/crawl-export.repository");
jest.mock("../../crawl-schedules/crawl-schedule.repository");
jest.mock("../../../common/helpers/url.helper");
jest.mock("../../../queues/crawl.queue", () => ({
  crawlQueue: {
    add: jest.fn().mockResolvedValue({ id: "bull-job-1" }),
  },
}));

import { CrawlJobService } from "../crawl-job.service";
import { CrawlJobRepository } from "../crawl-job.repository";
import { UserRepository } from "../../users/user.repository";
import { CrawlScheduleRepository } from "../../crawl-schedules/crawl-schedule.repository";
import * as urlHelper from "../../../common/helpers/url.helper";

describe("CrawlJobService", () => {
  let service: CrawlJobService;
  let mockJobRepo: jest.Mocked<CrawlJobRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;
  let mockScheduleRepo: jest.Mocked<CrawlScheduleRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJobRepo = {
      create: jest.fn().mockResolvedValue({ id: "job-1", status: "PENDING" }),
      countJobsSince: jest.fn().mockResolvedValue(0),
      countConcurrentJobs: jest.fn().mockResolvedValue(0),
      findById: jest.fn(),
    } as any;

    mockScheduleRepo = {
      findById: jest.fn().mockResolvedValue(null),
    } as any;

    (CrawlJobRepository as jest.Mock).mockReturnValue(mockJobRepo);
    (CrawlScheduleRepository as jest.Mock).mockReturnValue(mockScheduleRepo);

    mockUserRepo = {
      findById: jest.fn().mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        role: "CRAWLER_USER",
        maxPagesLimit: 50,
        maxJobsPerDayLimit: 10,
        maxConcurrentJobsLimit: 3,
        isActive: true,
      }),
    } as any;

    (CrawlJobRepository as jest.Mock).mockReturnValue(mockJobRepo);
    (UserRepository as jest.Mock).mockReturnValue(mockUserRepo);
    (urlHelper.validateUrl as jest.Mock).mockImplementation(
      (url: string) => new URL(url),
    );
    (urlHelper.extractDomain as jest.Mock).mockReturnValue("example.com");
    (urlHelper.validateUrlAsync as jest.Mock).mockResolvedValue(undefined);

    service = new CrawlJobService();
  });

  describe("create", () => {
    it("creates a job when within quota and valid startUrl", async () => {
      const result = await service.create("user-1", {
        startUrl: "https://example.com",
        mode: "SCRAPE",
        maxPages: 10,
      });

      expect(mockUserRepo.findById).toHaveBeenCalledWith("user-1");
      expect(mockJobRepo.countJobsSince).toHaveBeenCalled();
      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          startUrl: "https://example.com/",
          mode: "SCRAPE",
        }),
      );
      expect(result.id).toBe("job-1");
    });

    it("throws error when requested pages exceed user maxPagesLimit", async () => {
      await expect(
        service.create("user-1", {
          startUrl: "https://example.com",
          mode: "CRAWL",
          maxPages: 100,
        }),
      ).rejects.toThrow("exceeds quota limit");
    });

    it("throws error when daily job quota is reached", async () => {
      mockJobRepo.countJobsSince.mockResolvedValue(10);

      await expect(
        service.create("user-1", {
          startUrl: "https://example.com",
          mode: "SCRAPE",
          maxPages: 5,
        }),
      ).rejects.toThrow("Daily job quota of 10 exceeded");
    });

    it("throws error when concurrent job quota is reached", async () => {
      mockJobRepo.countConcurrentJobs.mockResolvedValue(3);

      await expect(
        service.create("user-1", {
          startUrl: "https://example.com",
          mode: "SCRAPE",
          maxPages: 5,
        }),
      ).rejects.toThrow("Concurrent jobs quota of 3 exceeded");
    });

    it("throws error when scheduleId does not belong to user", async () => {
      mockScheduleRepo.findById.mockResolvedValue({
        id: "sched-1",
        userId: "other-user",
      } as any);

      await expect(
        service.create("user-1", {
          startUrl: "https://example.com",
          scheduleId: "sched-1",
        }),
      ).rejects.toThrow("Crawl schedule not found");
    });

    it("attaches scheduleId when schedule belongs to user", async () => {
      mockScheduleRepo.findById.mockResolvedValue({
        id: "sched-1",
        userId: "user-1",
      } as any);

      await service.create("user-1", {
        startUrl: "https://example.com",
        scheduleId: "sched-1",
      });

      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduleId: "sched-1",
        }),
      );
    });
  });
});
