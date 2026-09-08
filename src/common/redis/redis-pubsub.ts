import Redis from "ioredis";
import { envConfig } from "../../config/env.config";

let publisherClient: Redis | null = null;
let subscriberClient: Redis | null = null;

export function getRedisPublisher(): Redis | null {
  if (!envConfig.redis.enabled) return null;

  if (!publisherClient) {
    try {
      publisherClient = new Redis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 2000,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });

      publisherClient.on("error", () => {
        // Suppress unhandled redis error crashes
      });
    } catch {
      publisherClient = null;
    }
  }

  return publisherClient;
}

export function getRedisSubscriber(): Redis | null {
  if (!envConfig.redis.enabled) return null;

  if (!subscriberClient) {
    try {
      subscriberClient = new Redis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 2000,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      });

      subscriberClient.on("error", () => {
        // Suppress unhandled redis error crashes
      });
    } catch {
      subscriberClient = null;
    }
  }

  return subscriberClient;
}
