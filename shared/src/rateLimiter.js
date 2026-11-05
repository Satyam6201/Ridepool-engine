import { logger } from "./logger.js";

const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local currentTokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if currentTokens == nil then
    currentTokens = capacity
    lastRefill = now
else
    local elapsed = math.max(0, now - lastRefill)
    local generated = elapsed * refillRate
    currentTokens = math.min(capacity, currentTokens + generated)
    lastRefill = now
end

if currentTokens >= requested then
    currentTokens = currentTokens - requested
    redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, ttl)
    return { 1, math.floor(currentTokens), 0 }
else
    local missing = requested - currentTokens
    local waitMs = math.ceil(missing / refillRate)
    local retryAfter = math.max(1, math.ceil(waitMs / 1000))
    redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, ttl)
    return { 0, 0, retryAfter }
end
`;

export const RATE_LIMIT_PRESETS = {
  // Strict: 5 burst, 1 token every 10 seconds (0.0001 tokens/ms)
  login: { capacity: 5, refillRatePerMs: 0.0001, ttlSeconds: 900, name: "login" },
  // High: 30 burst, 1 token every 500ms (0.002 tokens/ms)
  location: { capacity: 30, refillRatePerMs: 0.002, ttlSeconds: 300, name: "location" },
  // Medium: 10 burst, 1 token every 2 seconds (0.0005 tokens/ms)
  trip: { capacity: 10, refillRatePerMs: 0.0005, ttlSeconds: 600, name: "trip" }
};

export function createTokenBucketLimiter({
  redis,
  preset = "trip",
  capacity,
  refillRatePerMs,
  ttlSeconds,
  keyPrefix = "rl"
}) {
  const config = typeof preset === "string" ? RATE_LIMIT_PRESETS[preset] || RATE_LIMIT_PRESETS.trip : preset;
  const cap = capacity || config.capacity;
  const rate = refillRatePerMs || config.refillRatePerMs;
  const ttl = ttlSeconds || config.ttlSeconds || 3600;

  return async (req, res, next) => {
    if (!redis) {
      return next();
    }

    try {
      const identifier = req.user?.id ? `usr:${req.user.id}` : `ip:${req.ip || req.headers["x-forwarded-for"] || "anon"}`;
      const bucketKey = `${keyPrefix}:${config.name || "default"}:${identifier}`;
      const now = Date.now();

      const result = await redis.eval(
        TOKEN_BUCKET_LUA,
        1,
        bucketKey,
        cap,
        rate,
        now,
        1,
        ttl
      );

      const [allowed, remaining, retryAfter] = result;

      res.setHeader("X-RateLimit-Limit", cap);
      res.setHeader("X-RateLimit-Remaining", remaining);

      if (allowed === 1) {
        return next();
      }

      res.setHeader("Retry-After", retryAfter);
      logger.warn("Rate limit exceeded", { identifier, bucketKey, retryAfter });

      return res.status(429).json({
        status: "error",
        message: "Too many requests, please try again later"
      });
    } catch (err) {
      // Fail open so service remains functional during transient Redis errors
      logger.error("Rate limiter evaluation failed", { error: err.message });
      next();
    }
  };
}
