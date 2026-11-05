import { createRedisClient, logger } from "shared";
import { env } from "./env.js";

export const redis = createRedisClient(env.REDIS_URL);

export async function closeRedis() {
  try {
    await redis.quit();
    logger.info("Closed Redis connection");
  } catch (err) {
    logger.error("Error closing Redis connection", { error: err.message });
  }
}
