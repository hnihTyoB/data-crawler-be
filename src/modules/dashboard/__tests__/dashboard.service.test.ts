import { DashboardService } from "../dashboard.service";
import { DashboardRepository } from "../dashboard.repository";
import { AuthService } from "../../auth/auth.service";

jest.mock("../dashboard.repository");
jest.mock("../../auth/auth.service");

describe("DashboardService getStats", () => {
  it("combines dashboard counts and user quota usage", async () => {
    const service = new DashboardService();
    (DashboardRepository.prototype.getStats as jest.Mock).mockResolvedValue({
      jobs: { total: 10, completed: 8, failed: 1, running: 1, pending: 0 },
      pages: { total: 120, successful: 115, failed: 5 },
      schedules: { total: 2, active: 1 },
      exports: { total: 5 },
    });
    (AuthService.prototype.getUsage as jest.Mock).mockResolvedValue({
      quota: {
        maxPagesLimit: 100,
        maxJobsPerDayLimit: 10,
        maxConcurrentJobsLimit: 3,
      },
      usage: {
        jobsUsedToday: 2,
        jobsRemainingToday: 8,
        concurrentJobsRunning: 1,
        concurrentJobsAvailable: 2,
        totalPagesCrawled: 120,
      },
      resetAt: "2026-09-04T00:00:00.000Z",
    });

    const stats = await service.getStats("user-1", "CRAWLER_USER");

    expect(stats.jobs.total).toBe(10);
    expect(stats.pages.successful).toBe(115);
    expect(stats.quotaAndUsage.usage.jobsUsedToday).toBe(2);
  });
});
