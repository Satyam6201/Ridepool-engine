import { createRedisClient } from "shared";
import { env } from "./env.js";

let redisClient = null;

export function getRedis() {
  if (!redisClient) {
    redisClient = createRedisClient(env.REDIS_URL);
  }
  return redisClient;
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
