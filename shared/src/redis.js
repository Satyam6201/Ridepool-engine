import Redis from "ioredis";
import { logger } from "./logger.js";

export function createRedisClient(redisUrl, options = {}) {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    ...options
  });

  client.on("connect", () => {
    logger.info("Connected to Redis");
  });

  client.on("error", (err) => {
    logger.error("Redis connection error", { error: err.message });
  });

  return client;
}
