import { HealthRepository } from "./health.repository";
import { crawlQueue } from "../../queues/crawl.queue";
import { webhookQueue } from "../../queues/webhook.queue";
import { getErrorMessage } from "../../common/helpers/error-mapping.helper";

export interface QueueCountMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export type QueueMetricsResult = QueueCountMetrics | "unavailable" | null;

export class HealthService {
  constructor(private readonly repository = new HealthRepository()) {}

  getLiveness() {
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
    };
  }

  async getReadiness() {
    const checks: Record<
      string,
      { status: string; latencyMs?: number; error?: string }
    > = {};
    let isReady = true;

    // 1. Check Database
    const dbStart = Date.now();
    try {
      await this.repository.pingDatabase();
      checks.database = {
        status: "up",
        latencyMs: Date.now() - dbStart,
      };
    } catch (err: unknown) {
      isReady = false;
      checks.database = {
        status: "down",
        error: getErrorMessage(err),
      };
    }

    // 2. Check Queue / Redis
    if (crawlQueue) {
      const redisStart = Date.now();
      try {
        const client = await Promise.race([
          crawlQueue.client,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Redis connection timeout")), 1500)
          ),
        ]);
        if (
          "ping" in client &&
          typeof (client as { ping: () => Promise<string> }).ping === "function"
        ) {
          await Promise.race([
            (client as { ping: () => Promise<string> }).ping(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Redis ping timeout")), 1500)
            ),
          ]);
        }
        checks.redis = {
          status: "up",
          latencyMs: Date.now() - redisStart,
        };
      } catch (err: unknown) {
        checks.redis = {
          status: "degraded",
          error: getErrorMessage(err),
        };
      }
    } else {
      checks.redis = {
        status: "skipped",
      };
    }

    return {
      status: isReady ? "ready" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async getMetrics() {
    const mem = process.memoryUsage();
    let crawlQueueMetrics: QueueMetricsResult = null;
    let webhookQueueMetrics: QueueMetricsResult = null;

    if (crawlQueue) {
      try {
        const metricsPromise = Promise.all([
          crawlQueue.getWaitingCount(),
          crawlQueue.getActiveCount(),
          crawlQueue.getCompletedCount(),
          crawlQueue.getFailedCount(),
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Queue metrics timeout")), 1500)
        );
        const [waiting, active, completed, failed] = await Promise.race([
          metricsPromise,
          timeoutPromise,
        ]);
        crawlQueueMetrics = { waiting, active, completed, failed };
      } catch {
        crawlQueueMetrics = "unavailable";
      }
    }

    if (webhookQueue) {
      try {
        const metricsPromise = Promise.all([
          webhookQueue.getWaitingCount(),
          webhookQueue.getActiveCount(),
          webhookQueue.getCompletedCount(),
          webhookQueue.getFailedCount(),
        ]);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Webhook queue metrics timeout")), 1500)
        );
        const [waiting, active, completed, failed] = await Promise.race([
          metricsPromise,
          timeoutPromise,
        ]);
        webhookQueueMetrics = { waiting, active, completed, failed };
      } catch {
        webhookQueueMetrics = "unavailable";
      }
    }

    return {
      timestamp: new Date().toISOString(),
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        pid: process.pid,
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        },
      },
      queues: {
        crawl: crawlQueueMetrics,
        webhook: webhookQueueMetrics,
      },
    };
  }
}
