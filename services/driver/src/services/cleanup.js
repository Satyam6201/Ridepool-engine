import { logger } from "shared";
import { redis } from "../config/redis.js";
import { REDIS_GEO_KEY, REDIS_LAST_PING_KEY } from "./consumer.js";

let cleanupTimer = null;

/**
 * Runs a single pass of stale driver cleanup.
 * Removes drivers from Redis GEO whose last ping is older than maxStaleMs.
 */
export async function cleanupStaleDriversOnce(redisClient = redis, maxStaleMs = 30000) {
  try {
    const pings = await redisClient.hgetall(REDIS_LAST_PING_KEY);
    if (!pings || Object.keys(pings).length === 0) {
      return 0;
    }

    const now = Date.now();
    const staleDriverIds = [];

    for (const [driverId, lastPingStr] of Object.entries(pings)) {
      const lastPing = Number(lastPingStr);
      if (now - lastPing > maxStaleMs) {
        staleDriverIds.push(driverId);
      }
    }

    if (staleDriverIds.length === 0) {
      return 0;
    }

    const pipeline = redisClient.multi();
    for (const driverId of staleDriverIds) {
      pipeline.zrem(REDIS_GEO_KEY, driverId);
      pipeline.hdel(REDIS_LAST_PING_KEY, driverId);
    }
    await pipeline.exec();

    logger.info("Removed stale drivers from Redis GEO", {
      count: staleDriverIds.length,
      driverIds: staleDriverIds
    });

    return staleDriverIds.length;
  } catch (err) {
    logger.error("Error running stale driver cleanup", { error: err.message });
    return 0;
  }
}

/**
 * Starts periodic stale driver cleanup job.
 */
export function startStaleDriverCleanup(intervalMs = 10000, maxStaleMs = 30000) {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(async () => {
    await cleanupStaleDriversOnce(redis, maxStaleMs);
  }, intervalMs);

  logger.info("Stale driver cleanup job started", { intervalMs, maxStaleMs });
}

/**
 * Stops periodic stale driver cleanup job.
 */
export function stopStaleDriverCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    logger.info("Stale driver cleanup job stopped");
  }
}
