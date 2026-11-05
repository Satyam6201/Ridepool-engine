import test from "node:test";
import assert from "node:assert";
import { createTokenBucketLimiter } from "../src/rateLimiter.js";

function createMockRedis() {
  const store = new Map();

  return {
    async eval(script, numKeys, key, capacity, refillRate, now, requested, ttl) {
      const cap = Number(capacity);
      const rate = Number(refillRate);
      const req = Number(requested);
      const currentTime = Number(now);

      let data = store.get(key);
      let tokens;
      let lastRefill;

      if (!data) {
        tokens = cap;
        lastRefill = currentTime;
      } else {
        const elapsed = Math.max(0, currentTime - data.lastRefill);
        tokens = Math.min(cap, data.tokens + elapsed * rate);
        lastRefill = currentTime;
      }

      if (tokens >= req) {
        tokens -= req;
        store.set(key, { tokens, lastRefill });
        return [1, Math.floor(tokens), 0];
      } else {
        const missing = req - tokens;
        const waitMs = Math.ceil(missing / rate);
        const retryAfter = Math.max(1, Math.ceil(waitMs / 1000));
        store.set(key, { tokens, lastRefill });
        return [0, 0, retryAfter];
      }
    }
  };
}

function createMockReqRes({ userId, ip = "127.0.0.1" } = {}) {
  const headers = {};
  let statusCode = 200;
  let responseBody = null;

  const req = {
    ip,
    headers: {},
    user: userId ? { id: userId } : null
  };

  const res = {
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    status(code) {
      statusCode = code;
      return {
        json(body) {
          responseBody = body;
          return this;
        }
      };
    }
  };

  return { req, res, getStatus: () => statusCode, getHeader: (k) => headers[k.toLowerCase()] };
}

test("token bucket limiter allows first 5 requests in burst of 5 and blocks 6th", async () => {
  const mockRedis = createMockRedis();
  const limiter = createTokenBucketLimiter({
    redis: mockRedis,
    capacity: 5,
    refillRatePerMs: 0.0001, // very slow refill so burst is strictly 5
    keyPrefix: "test"
  });

  // Run first 5 requests
  for (let i = 1; i <= 5; i++) {
    const { req, res, getStatus } = createMockReqRes({ ip: "192.168.1.100" });
    let nextCalled = false;

    await limiter(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, `Request ${i} should be allowed`);
    assert.strictEqual(getStatus(), 200, `Request ${i} status should not be 429`);
  }

  // 6th request should be blocked
  const sixth = createMockReqRes({ ip: "192.168.1.100" });
  let nextCalledOnSixth = false;

  await limiter(sixth.req, sixth.res, () => {
    nextCalledOnSixth = true;
  });

  assert.strictEqual(nextCalledOnSixth, false, "6th request should not call next()");
  assert.strictEqual(sixth.getStatus(), 429, "6th request should return HTTP 429");
  assert.ok(sixth.getHeader("Retry-After") >= 1, "Retry-After header must be set");
});

test("rate limiter keys by user id when logged in", async () => {
  const mockRedis = createMockRedis();
  const limiter = createTokenBucketLimiter({
    redis: mockRedis,
    capacity: 5,
    refillRatePerMs: 0.0001
  });

  // Exhaust quota for user-1
  for (let i = 1; i <= 5; i++) {
    const { req, res } = createMockReqRes({ userId: "user-1", ip: "10.0.0.1" });
    await limiter(req, res, () => {});
  }

  // user-1 is blocked
  const user1Blocked = createMockReqRes({ userId: "user-1", ip: "10.0.0.1" });
  await limiter(user1Blocked.req, user1Blocked.res, () => {});
  assert.strictEqual(user1Blocked.getStatus(), 429);

  // user-2 from SAME IP has fresh quota
  const user2Fresh = createMockReqRes({ userId: "user-2", ip: "10.0.0.1" });
  let user2Allowed = false;
  await limiter(user2Fresh.req, user2Fresh.res, () => {
    user2Allowed = true;
  });
  assert.strictEqual(user2Allowed, true, "User 2 should not be affected by User 1's quota");
});
