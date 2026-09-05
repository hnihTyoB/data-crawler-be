import { HealthService } from "../health.service";
import { HealthRepository } from "../health.repository";

jest.mock("../health.repository");

jest.mock("../../../queues/crawl.queue", () => ({
  crawlQueue: {
    client: Promise.resolve({ ping: jest.fn().mockResolvedValue("PONG") }),
    getWaitingCount: jest.fn().mockResolvedValue(2),
    getActiveCount: jest.fn().mockResolvedValue(1),
    getCompletedCount: jest.fn().mockResolvedValue(50),
    getFailedCount: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock("../../../queues/webhook.queue", () => ({
  webhookQueue: {
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(10),
    getFailedCount: jest.fn().mockResolvedValue(0),
  },
}));

describe("HealthService", () => {
  let service: HealthService;
  let mockHealthRepo: jest.Mocked<HealthRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHealthRepo = new HealthRepository() as jest.Mocked<HealthRepository>;
    service = new HealthService(mockHealthRepo);
  });

  describe("getLiveness", () => {
    it("returns ok status and uptime", () => {
      const result = service.getLiveness();
      expect(result.status).toBe("ok");
      expect(typeof result.uptimeSeconds).toBe("number");
      expect(result.timestamp).toBeDefined();
    });
  });

  describe("getReadiness", () => {
    it("returns ready status when database is up", async () => {
      mockHealthRepo.pingDatabase.mockResolvedValue();

      const result = await service.getReadiness();
      expect(result.status).toBe("ready");
      expect(result.checks.database.status).toBe("up");
      expect(result.checks.redis.status).toBe("up");
    });

    it("returns unhealthy status when database query fails", async () => {
      mockHealthRepo.pingDatabase.mockRejectedValue(
        new Error("Connection timeout"),
      );

      const result = await service.getReadiness();
      expect(result.status).toBe("unhealthy");
      expect(result.checks.database.status).toBe("down");
    });
  });

  describe("getMetrics", () => {
    it("returns process and queue metrics", async () => {
      const result = await service.getMetrics();
      expect(result.process.memory).toBeDefined();
      expect(result.queues.crawl).toEqual({
        waiting: 2,
        active: 1,
        completed: 50,
        failed: 0,
      });
    });
  });
});
