import "dotenv/config";
import { envConfig } from "./config/env.config";
import Redis from "ioredis";

async function bootstrap() {
  let isRedisAvailable = false;
  if (envConfig.redis.enabled) {
    const redis = new Redis({
      host: envConfig.redis.host,
      port: envConfig.redis.port,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      connectTimeout: 1500,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    redis.on("error", () => {});

    try {
      await Promise.race([
        redis.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis connection timeout")), 1500)),
      ]);
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Redis ping timeout")), 1500)),
      ]);
      await redis.quit();
      isRedisAvailable = true;
      console.log("[Server] Redis connection confirmed.");
    } catch {
      try {
        redis.disconnect();
      } catch {}
      console.warn("[Server] Redis is offline. Running in degraded mode without queue workers (Database & APIs active).");
    }
  } else {
    console.warn("[Server] REDIS_ENABLED is false. Running in degraded mode without queue workers (Database & APIs active).");
  }

  // Import app so Database endpoints and Express routes are fully available
  const { default: app } = await import("./app");
  const { initLocalStorage } = await import("./common/helpers/file.helper");

  initLocalStorage();

  const { systemConfigService } = await import(
    "./modules/system-config/system-config.service"
  );
  try {
    await systemConfigService.ensureDefaultConfigs();
    console.log("[Server] Default system configs initialized successfully.");
  } catch (err) {
    console.warn("[Server] Failed to initialize default system configs:", err);
  }

  if (isRedisAvailable) {
    systemConfigService.initRedisSubscriber();

    await import("./queues/webhook.worker");
    console.log("[Server] Webhook worker initialized in background.");

    const { startScheduleWorker } = await import("./queues/schedule.worker");
    startScheduleWorker();
    console.log("[Server] Schedule worker initialized in background.");
  }

  app.listen(envConfig.port, () => {
    console.log(
      `Server running on port ${envConfig.port} in ${envConfig.nodeEnv} mode`,
    );
  });
}

bootstrap();
