process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://localhost:27017/matching_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { findAndRankDrivers } from "../src/services/matching.js";

function createMockRedis() {
  const store = new Map();
  const geoStore = [];
  const ratings = new Map();

  return {
    store,
    geoStore,
    ratings,

    async set(key, val, ...args) {
      const isNX = args.includes("NX");
      if (isNX && store.has(key)) {
        return null;
      }
      store.set(key, val);
      return "OK";
    },

    async get(key) {
      if (key.startsWith("driver:rating:")) {
        const id = key.replace("driver:rating:", "");
        return ratings.get(id) || null;
      }
      return store.get(key) || null;
    },

    async georadius(key, lng, lat, radius, unit) {
      return geoStore
        .filter(([_, dist]) => dist <= radius)
        .map(([id, dist]) => [id, String(dist)]);
    }
  };
}

test("idempotency check: duplicate trip.requested events are blocked", async () => {
  const mockRedis = createMockRedis();
  const tripId = "trip_idem_123";

  // 1. First event sets the idempotency key
  const first = await mockRedis.set(`match:idempotent:${tripId}`, "1", "NX", "EX", 86400);
  assert.strictEqual(first, "OK", "First processing attempt should acquire idempotency lock");

  // 2. Duplicate event (replayed message from Kafka) is blocked
  const second = await mockRedis.set(`match:idempotent:${tripId}`, "1", "NX", "EX", 86400);
  assert.strictEqual(second, null, "Second processing attempt should be rejected as duplicate");
});

test("candidate search: expands to 5 km when 2 km is empty and ranks by distance and rating", async () => {
  const mockRedis = createMockRedis();

  // No drivers within 2 km; two drivers at 3.5 km and 4.2 km
  mockRedis.geoStore.push(["drv_far_high_rated", 3.5]);
  mockRedis.geoStore.push(["drv_far_low_rated", 3.6]);
  mockRedis.ratings.set("drv_far_high_rated", "4.9");
  mockRedis.ratings.set("drv_far_low_rated", "4.2");

  const candidates = await findAndRankDrivers(-122.4194, 37.7749, mockRedis);

  assert.strictEqual(candidates.length, 2, "Should expand and find candidates in 5 km");
  assert.strictEqual(candidates[0].driverId, "drv_far_high_rated");
  assert.strictEqual(candidates[1].driverId, "drv_far_low_rated");
});
