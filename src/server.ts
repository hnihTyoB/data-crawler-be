import "dotenv/config";
import { envConfig } from "./config/env.config";
import { authorizationCache } from "./common/helpers/authorization-cache.helper";

async function bootstrap() {
  let isRedisAvailable = false;
  if (envConfig.redis.enabled) {
    const { initRedisClient } = await import("./common/redis/redis-client");
    const client = await initRedisClient();
    if (client) {
      isRedisAvailable = true;
      console.log("[Server] Redis connection confirmed and client initialized.");
    } else {
      console.warn(
        "[Server] Redis is offline. Running in degraded mode without queue workers (Database & APIs active).",
      );
    }
  } else {
    console.warn(
      "[Server] REDIS_ENABLED is false. Running in degraded mode without queue workers (Database & APIs active).",
    );
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

  const { permissionService } = await import(
    "./modules/permissions/permission.service"
  );
  try {
    await permissionService.ensureSystemPermissions();
    console.log("[Server] System permissions and role bindings synchronized successfully.");
  } catch (err) {
    console.warn("[Server] Failed to synchronize system permissions:", err);
  }

  if (isRedisAvailable) {
    systemConfigService.initRedisSubscriber();
    authorizationCache.initRedisSubscriber();

    await import("./queues/webhook.worker");
    console.log("[Server] Webhook worker initialized in background.");

    const { startScheduleWorker } = await import("./queues/schedule.worker");
    startScheduleWorker();
    console.log("[Server] Schedule worker initialized in background.");

    const { cronQueue } = await import("./queues/cron.queue");
    const { cronRepository } = await import("./modules/cron/cron.repository");
    try {
      const jobStatuses = await cronRepository.getJobStatuses();
      await cronQueue.registerDefaultSchedulers(jobStatuses);
      console.log("[Server] Cron job schedulers registered successfully.");
    } catch (cronErr) {
      console.warn("[Server] Failed to register cron schedulers:", cronErr);
    }

    await import("./queues/cron.worker");
    console.log("[Server] Cron worker initialized in background.");
  }

  app.listen(envConfig.port, () => {
    console.log(
      `Server running on port ${envConfig.port} in ${envConfig.nodeEnv} mode`,
    );
  });
}

bootstrap();
