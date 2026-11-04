import Redis from "ioredis";
import { logger } from "./logger.js";

export function createRedisClient(redisUrl) {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    }
  });

  client.on("connect", () => {
    logger.info("Connected to Redis");
  });

  client.on("error", (err) => {
    logger.error("Redis connection error", { error: err.message });
  });

  return client;
}
