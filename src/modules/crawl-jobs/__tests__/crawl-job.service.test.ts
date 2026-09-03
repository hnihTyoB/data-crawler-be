jest.mock("../../../database/prisma.client", () => ({
  prisma: {},
}));

jest.mock("../crawl-job.repository");
jest.mock("../../users/user.repository");
jest.mock("../../crawl-exports/crawl-export.repository");
jest.mock("../../../common/helpers/url.helper");
jest.mock("../../../queues/crawl.queue", () => ({
  crawlQueue: {
    add: jest.fn().mockResolvedValue({ id: "bull-job-1" }),
  },
}));

import { CrawlJobService } from "../crawl-job.service";
import { CrawlJobRepository } from "../crawl-job.repository";
import { UserRepository } from "../../users/user.repository";
import * as urlHelper from "../../../common/helpers/url.helper";

describe("CrawlJobService", () => {
  let service: CrawlJobService;
  let mockJobRepo: jest.Mocked<CrawlJobRepository>;
  let mockUserRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJobRepo = {
      create: jest.fn().mockResolvedValue({ id: "job-1", status: "PENDING" }),
      countJobsSince: jest.fn().mockResolvedValue(0),
      countConcurrentJobs: jest.fn().mockResolvedValue(0),
      findById: jest.fn(),
    } as any;

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

    it("deduplicates URLs in URL_LIST mode and validates them", async () => {
      const urls = [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/1",
      ];

      await service.create("user-1", {
        mode: "URL_LIST",
        urls,
      });

      expect(urlHelper.validateUrlAsync).toHaveBeenCalledTimes(2);
      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "URL_LIST",
          startUrl: "https://example.com/1",
          urls: ["https://example.com/1", "https://example.com/2"],
        }),
      );
    });
  });
});
