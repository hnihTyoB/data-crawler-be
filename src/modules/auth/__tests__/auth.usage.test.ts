import { AuthService } from "../auth.service";
import { CrawlJobRepository } from "../../crawl-jobs/crawl-job.repository";

jest.mock("../../crawl-jobs/crawl-job.repository");

describe("AuthService getUsage and avatarUrl", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    fullName: "Test User",
    avatarUrl: "https://example.com/old-avatar.png",
    role: "CRAWLER_USER",
    isActive: true,
    maxPagesLimit: 100,
    maxJobsPerDayLimit: 10,
    maxConcurrentJobsLimit: 3,
    maxPagesPerMonthLimit: 1000,
    maxJobsPerMonthLimit: 100,
    quotaResetAt: null,
    createdAt: new Date(),
  };

  it("calculates quota usage correctly in UTC+7 timezone", async () => {
    const service = new AuthService();
    const repository = {
      findById: jest.fn().mockResolvedValue(mockUser),
    };
    (service as any).repository = repository;

    (CrawlJobRepository.prototype.countJobsSince as jest.Mock)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(15);
    (
      CrawlJobRepository.prototype.countConcurrentJobs as jest.Mock
    ).mockResolvedValue(1);
    (CrawlJobRepository.prototype.sumPagesCrawledByUser as jest.Mock)
      .mockResolvedValueOnce(125)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(75);

    const usage = await service.getUsage("user-123");

    expect(usage.quota).toEqual({
      maxPagesLimit: 100,
      maxJobsPerDayLimit: 10,
      maxConcurrentJobsLimit: 3,
      maxPagesPerMonthLimit: 1000,
      maxJobsPerMonthLimit: 100,
    });
    expect(usage.usage).toEqual({
      jobsUsedToday: 4,
      jobsRemainingToday: 6,
      concurrentJobsRunning: 1,
      concurrentJobsAvailable: 2,
      totalPagesCrawled: 125,
      pagesCrawledToday: 25,
      pagesRemainingToday: 75,
      jobsUsedThisMonth: 15,
      jobsRemainingThisMonth: 85,
      pagesCrawledThisMonth: 75,
      pagesRemainingThisMonth: 925,
    });
    expect(usage.resetAt).toBeDefined();
    expect(usage.monthlyResetAt).toBeDefined();
    expect(usage.quotaResetAt).toBeNull();
  });

  it("updates fullName via updateMe", async () => {
    const service = new AuthService();
    const repository = {
      findById: jest.fn().mockResolvedValue(mockUser),
      updateUser: jest.fn().mockResolvedValue({
        ...mockUser,
        fullName: "Updated Name",
      }),
    };
    (service as any).repository = repository;

    const result = await service.updateMe("user-123", {
      fullName: "Updated Name",
    });

    expect(result.fullName).toBe("Updated Name");
    expect(repository.updateUser).toHaveBeenCalledWith("user-123", {
      fullName: "Updated Name",
    });
  });
});
