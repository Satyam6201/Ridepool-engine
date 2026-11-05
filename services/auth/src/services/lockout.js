import { UnauthorizedError, logger } from "shared";
import { getRedis } from "../config/redis.js";
import { env } from "../config/env.js";

function getLockKey(email) {
  return `auth:lockout:${email}`;
}

function getFailKey(email) {
  return `auth:failed:${email}`;
}

export async function checkLockout(email, ip = "unknown") {
  if (env.NODE_ENV === "test") return;

  try {
    const redis = getRedis();
    const isLocked = await redis.get(getLockKey(email));

    if (isLocked) {
      logger.warn("AUDIT: Login attempt on locked account", { email, ip });
      throw new UnauthorizedError("Account is temporarily locked. Try again in 15 minutes.");
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    logger.error("Failed to check lockout status in Redis", { error: err.message });
  }
}

export async function recordFailedLogin(email, ip = "unknown") {
  if (env.NODE_ENV === "test") {
    throw new UnauthorizedError("Invalid email or password");
  }

  try {
    const redis = getRedis();
    const failKey = getFailKey(email);
    const lockKey = getLockKey(email);

    const attempts = await redis.incr(failKey);

    if (attempts === 1) {
      await redis.expire(failKey, env.LOCKOUT_WINDOW_SECONDS);
    }

    if (attempts >= env.LOCKOUT_THRESHOLD) {
      await redis.set(lockKey, "locked", "EX", env.LOCKOUT_WINDOW_SECONDS);
      await redis.del(failKey);

      logger.warn("AUDIT: Account locked due to repeated failed logins", {
        email,
        ip,
        threshold: env.LOCKOUT_THRESHOLD,
        durationSeconds: env.LOCKOUT_WINDOW_SECONDS
      });

      throw new UnauthorizedError("Account is temporarily locked. Try again in 15 minutes.");
    }

    logger.warn("AUDIT: Login failed invalid credentials", {
      email,
      ip,
      failedAttempts: attempts,
      remainingAttempts: env.LOCKOUT_THRESHOLD - attempts
    });

    throw new UnauthorizedError("Invalid email or password");
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    logger.error("Failed to record failed login in Redis", { error: err.message });
    throw new UnauthorizedError("Invalid email or password");
  }
}

export async function resetFailedLogins(email) {
  if (env.NODE_ENV === "test") return;

  try {
    const redis = getRedis();
    await redis.del(getFailKey(email), getLockKey(email));
  } catch (err) {
    logger.error("Failed to reset login attempts in Redis", { error: err.message });
  }
}
