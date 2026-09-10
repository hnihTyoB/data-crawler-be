import Redis from "ioredis";
import { envConfig } from "../../config/env.config";
import { getRedisClientOptions } from "./redis-connection";

let publisherClient: Redis | null = null;
let subscriberClient: Redis | null = null;

export function getRedisPublisher(): Redis | null {
  if (!envConfig.redis.enabled) return null;

  if (!publisherClient) {
    try {
      const conn = getRedisClientOptions();
      publisherClient = conn.url
        ? new Redis(conn.url, conn.options)
        : new Redis(conn.options);

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
      const conn = getRedisClientOptions();
      subscriberClient = conn.url
        ? new Redis(conn.url, conn.options)
        : new Redis(conn.options);

      subscriberClient.on("error", () => {
        // Suppress unhandled redis error crashes
      });
    } catch {
      subscriberClient = null;
    }
  }

  return subscriberClient;
}
