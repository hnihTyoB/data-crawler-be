import "dotenv/config";
import { Worker } from "bullmq";
import { envConfig } from "../config/env.config";
import { getBullMQConnection } from "../common/redis/redis-connection";
import { WebhookDeliveryService } from "../modules/webhooks/webhook-delivery.service";

import { getErrorMessage } from "../common/helpers/error-mapping.helper";

if (!envConfig.redis.enabled) {
  console.log(
    "[Webhook Worker] REDIS_ENABLED is not set to true. Webhook Worker will not start.",
  );
  process.exit(0);
}

const deliveryService = new WebhookDeliveryService();

export const webhookWorker = new Worker(
  envConfig.webhook.queueName,
  async (job) => {
    const { deliveryId } = job.data;
    const currentAttempt = job.attemptsMade + 1;

    console.log(
      `[Webhook Worker] Processing delivery ${deliveryId}, attempt ${currentAttempt}/${job.opts.attempts || 3}`,
    );

    try {
      await deliveryService.send(deliveryId, currentAttempt);
      console.log(`[Webhook Worker] Delivery ${deliveryId} succeeded`);
    } catch (err: unknown) {
      const maxAttempts = job.opts.attempts || 3;
      const errorMessage = getErrorMessage(err);
      console.error(
        `[Webhook Worker] Delivery ${deliveryId} failed on attempt ${currentAttempt}/${maxAttempts}: ${errorMessage}`,
      );

      if (currentAttempt >= maxAttempts) {
        // Mark as permanently failed in DB when attempts are exhausted
        await deliveryService.markFailed(
          deliveryId,
          errorMessage || "Attempts exhausted",
        );
        console.log(
          `[Webhook Worker] Delivery ${deliveryId} marked as permanently FAILED`,
        );
      }

      throw err;
    }
  },
  {
    connection: getBullMQConnection({
      maxRetriesPerRequest: null,
    }),
    concurrency: 5,
  },
);

webhookWorker.on("error", (err) => {
  console.error("[Webhook Worker] Error:", err);
});

// Setup graceful shutdown helper
export async function closeWebhookWorker() {
  console.log("[Webhook Worker] Closing worker gracefully...");
  await webhookWorker.close();
  console.log("[Webhook Worker] Closed");
}

// Handle signals if this file is run standalone
if (require.main === module) {
  const gracefulShutdown = async (signal: string) => {
    console.log(
      `[Webhook Worker] Received ${signal}, initiating graceful shutdown...`,
    );
    await closeWebhookWorker();
    process.exit(0);
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  console.log("[Webhook Worker] Standalone Webhook Worker started");
}
