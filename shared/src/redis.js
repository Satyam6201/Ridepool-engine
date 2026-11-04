import Redis from "ioredis";
import { log } from "./logger.js";

export function getRedis(url) {
  const r = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (t) => Math.min(t * 200, 2000)
  });

  r.on("connect", () => log.info("Redis connected"));
  r.on("error", (err) => log.error(`Redis error: ${err.message}`));
  return r;
}
