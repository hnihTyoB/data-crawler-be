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
    createdAt: new Date(),
  };

  it("calculates quota usage correctly in UTC+7 timezone", async () => {
    const service = new AuthService();
    const repository = {
      findById: jest.fn().mockResolvedValue(mockUser),
    };
    (service as any).repository = repository;

    (
      CrawlJobRepository.prototype.countJobsSince as jest.Mock
    ).mockResolvedValue(4);
    (
      CrawlJobRepository.prototype.countConcurrentJobs as jest.Mock
    ).mockResolvedValue(1);
    (
      CrawlJobRepository.prototype.sumPagesCrawledByUser as jest.Mock
    ).mockResolvedValue(125);

    const usage = await service.getUsage("user-123");

    expect(usage.quota).toEqual({
      maxPagesLimit: 100,
      maxJobsPerDayLimit: 10,
      maxConcurrentJobsLimit: 3,
    });
    expect(usage.usage).toEqual({
      jobsUsedToday: 4,
      jobsRemainingToday: 6,
      concurrentJobsRunning: 1,
      concurrentJobsAvailable: 2,
      totalPagesCrawled: 125,
    });
    expect(usage.resetAt).toBeDefined();
  });

  it("updates avatarUrl via updateMe", async () => {
    const service = new AuthService();
    const repository = {
      findById: jest.fn().mockResolvedValue(mockUser),
      updateUser: jest.fn().mockResolvedValue({
        ...mockUser,
        avatarUrl: "https://example.com/new-avatar.png",
      }),
    };
    (service as any).repository = repository;

    const result = await service.updateMe("user-123", {
      avatarUrl: "https://example.com/new-avatar.png",
    });

    expect(result.avatarUrl).toBe("https://example.com/new-avatar.png");
    expect(repository.updateUser).toHaveBeenCalledWith("user-123", {
      avatarUrl: "https://example.com/new-avatar.png",
    });
  });
});
