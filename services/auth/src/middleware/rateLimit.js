import { createRedisClient, logger } from "shared";
import { env } from "../config/env.js";

let redisClient = null;

function getRedis() {
  if (!redisClient) {
    redisClient = createRedisClient(env.REDIS_URL);
  }
  return redisClient;
}

export function rateLimiter({ windowSeconds = 60, maxRequests = 10, prefix = "auth" } = {}) {
  return async (req, res, next) => {
    if (env.NODE_ENV === "test") {
      return next();
    }

    try {
      const redis = getRedis();
      const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
      const key = `rl:${prefix}:${ip}`;

      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > maxRequests) {
        logger.warn("Rate limit exceeded", { prefix, ip });
        return res.status(429).json({
          status: "error",
          message: "Too many requests, please try again later"
        });
      }

      next();
    } catch (err) {
      // Fail open if Redis is unreachable so auth does not completely break
      logger.error("Rate limit check failed", { error: err.message });
      next();
    }
  };
}
