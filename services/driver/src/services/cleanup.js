import { logger } from "shared";
import { redis } from "../config/redis.js";
import { GEO_KEY, PING_KEY } from "./consumer.js";

let timer = null;

export async function cleanStaleDrivers(client = redis, maxAge = 30000) {
  const pings = await client.hgetall(PING_KEY);
  if (!pings || Object.keys(pings).length === 0) return 0;

  const now = Date.now();
  const stale = Object.entries(pings)
    .filter(([_, time]) => now - Number(time) > maxAge)
    .map(([id]) => id);

  if (stale.length === 0) return 0;

  const pipe = client.multi();
  for (const id of stale) {
    pipe.zrem(GEO_KEY, id);
    pipe.hdel(PING_KEY, id);
  }
  await pipe.exec();

  logger.info("Purged stale drivers", { count: stale.length });
  return stale.length;
}

export function startStaleCleanup(interval = 10000, maxAge = 30000) {
  if (timer) return;
  timer = setInterval(() => cleanStaleDrivers(redis, maxAge), interval);
}

export function stopStaleCleanup() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
