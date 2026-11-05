process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://localhost:27017/matching_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { acquireDriverLock, releaseDriverLock } from "../src/services/lock.js";

function createMockRedis() {
  const store = new Map();

  return {
    store,
    async set(key, val, mode, ttl, condition) {
      if (condition === "NX") {
        if (store.has(key)) return null;
        store.set(key, val);
        return "OK";
      }
      store.set(key, val);
      return "OK";
    },

    async get(key) {
      return store.get(key) || null;
    },

    async del(key) {
      return store.delete(key) ? 1 : 0;
    },

    async eval(script, numKeys, key, lockValue) {
      // Replicate the Lua script: if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end
      if (store.get(key) === lockValue) {
        store.delete(key);
        return 1;
      }
      return 0;
    }
  };
}

test("driver lock: acquires lock and prevents concurrent offers to same driver", async () => {
  const mockRedis = createMockRedis();
  const driverId = "drv_42";
  const trip1Lock = "trip_1:token_abc";
  const trip2Lock = "trip_2:token_xyz";

  // 1. First trip acquires lock successfully
  const acquired1 = await acquireDriverLock(driverId, trip1Lock, 10000, mockRedis);
  assert.strictEqual(acquired1, true);

  // 2. Second trip attempts to lock same driver concurrently -> BLOCKED
  const acquired2 = await acquireDriverLock(driverId, trip2Lock, 10000, mockRedis);
  assert.strictEqual(acquired2, false, "Concurrent offer should be blocked by active lock");
});

test("driver lock: safe release using Lua script ensures only owner can release", async () => {
  const mockRedis = createMockRedis();
  const driverId = "drv_99";
  const realOwner = "trip_100:owner_token";
  const fakeOwner = "trip_200:fake_token";

  await acquireDriverLock(driverId, realOwner, 10000, mockRedis);

  // Attempting to release with wrong owner token fails
  const fakeRelease = await releaseDriverLock(driverId, fakeOwner, mockRedis);
  assert.strictEqual(fakeRelease, false, "Wrong owner must not be allowed to release the lock");
  assert.strictEqual(await mockRedis.get(`lock:driver:${driverId}`), realOwner);

  // Releasing with correct owner token succeeds
  const realRelease = await releaseDriverLock(driverId, realOwner, mockRedis);
  assert.strictEqual(realRelease, true, "Correct owner must release the lock");
  assert.strictEqual(await mockRedis.get(`lock:driver:${driverId}`), null);
});
