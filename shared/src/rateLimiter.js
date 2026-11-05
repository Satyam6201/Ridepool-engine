import { logger } from "./logger.js";

const LUA_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    lastRefill = now
else
    local elapsed = math.max(0, now - lastRefill)
    tokens = math.min(capacity, tokens + (elapsed * refillRate))
    lastRefill = now
end

if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, ttl)
    return { 1, math.floor(tokens), 0 }
else
    local missing = requested - tokens
    local waitMs = math.ceil(missing / refillRate)
    local retryAfter = math.max(1, math.ceil(waitMs / 1000))
    redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, ttl)
    return { 0, 0, retryAfter }
end
`;

export const RATE_LIMIT_PRESETS = {
  login: { capacity: 5, refillRatePerMs: 0.0001, ttlSeconds: 900, name: "login" },
  location: { capacity: 30, refillRatePerMs: 0.002, ttlSeconds: 300, name: "location" },
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
  const cfg = typeof preset === "string" ? RATE_LIMIT_PRESETS[preset] || RATE_LIMIT_PRESETS.trip : preset;
  const cap = capacity || cfg.capacity;
  const rate = refillRatePerMs || cfg.refillRatePerMs;
  const ttl = ttlSeconds || cfg.ttlSeconds || 3600;

  return async (req, res, next) => {
    if (!redis) return next();

    try {
      const id = req.user?.id ? `usr:${req.user.id}` : `ip:${req.ip || req.headers["x-forwarded-for"] || "anon"}`;
      const bucket = `${keyPrefix}:${cfg.name || "default"}:${id}`;
      const now = Date.now();

      const [allowed, remaining, retryAfter] = await redis.eval(
        LUA_SCRIPT,
        1,
        bucket,
        cap,
        rate,
        now,
        1,
        ttl
      );

      res.setHeader("X-RateLimit-Limit", cap);
      res.setHeader("X-RateLimit-Remaining", remaining);

      if (allowed === 1) return next();

      res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({
        status: "error",
        message: "Too many requests, please try again later"
      });
    } catch (err) {
      logger.error("Rate limiter failed", { error: err.message });
      next();
    }
  };
}
