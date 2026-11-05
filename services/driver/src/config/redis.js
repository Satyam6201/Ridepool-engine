import { createRedisClient, logger } from "shared";
import { env } from "./env.js";

export const redis = createRedisClient(env.REDIS_URL);

export async function closeRedis() {
  try {
    await redis.quit();
  } catch (err) {
    logger.error("Error closing Redis", { error: err.message });
  }
}
