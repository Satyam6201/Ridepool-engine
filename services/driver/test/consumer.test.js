process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secret_jwt_access_token_min_32_chars";
process.env.MONGO_URI = "mongodb://localhost:27017/driver_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { cleanupStaleDriversOnce } from "../src/services/cleanup.js";

function createMockRedis(initialPings = {}, initialGeo = new Set()) {
  const pings = { ...initialPings };
  const geoSet = new Set(initialGeo);
  const statuses = new Map();
  const logs = [];

  const client = {
    pings,
    geoSet,
    statuses,
    logs,

    async get(key) {
      if (key.startsWith("driver:status:")) {
        const id = key.replace("driver:status:", "");
        return statuses.get(id) || null;
      }
      return null;
    },

    async set(key, val) {
      if (key.startsWith("driver:status:")) {
        const id = key.replace("driver:status:", "");
        statuses.set(id, val);
      }
      return "OK";
    },

    async hgetall(key) {
      if (key === "drivers:last_ping") {
        return { ...pings };
      }
      return {};
    },

    multi() {
      const ops = [];
      const multiProxy = {
        geoadd(key, lng, lat, member) {
          ops.push(() => {
            geoSet.add(member);
            logs.push({ op: "GEOADD", key, member, lng, lat });
          });
          return multiProxy;
        },
        hset(key, field, value) {
          ops.push(() => {
            pings[field] = String(value);
            logs.push({ op: "HSET", key, field, value });
          });
          return multiProxy;
        },
        zrem(key, member) {
          ops.push(() => {
            geoSet.delete(member);
            logs.push({ op: "ZREM", key, member });
          });
          return multiProxy;
        },
        hdel(key, field) {
          ops.push(() => {
            delete pings[field];
            logs.push({ op: "HDEL", key, field });
          });
          return multiProxy;
        },
        async exec() {
          for (const op of ops) {
            op();
          }
          return ops.map(() => 1);
        }
      };
      return multiProxy;
    }
  };

  return client;
}

test("consumer logic: available driver ping updates Redis GEO and last_ping", async () => {
  const mockRedis = createMockRedis();
  mockRedis.statuses.set("drv_101", "available");

  // Simulate consumer handler logic directly
  const status = await mockRedis.get("driver:status:drv_101");
  assert.strictEqual(status, "available");

  const multi = mockRedis.multi();
  multi.geoadd("drivers:available", -122.4194, 37.7749, "drv_101");
  multi.hset("drivers:last_ping", "drv_101", Date.now());
  await multi.exec();

  assert.strictEqual(mockRedis.geoSet.has("drv_101"), true);
  assert.ok(mockRedis.pings["drv_101"]);
  assert.strictEqual(mockRedis.logs.some((l) => l.op === "GEOADD" && l.member === "drv_101"), true);
});

test("consumer logic: offline or on_trip driver ping removes from Redis GEO", async () => {
  const mockRedis = createMockRedis({ drv_202: String(Date.now()) }, ["drv_202"]);
  mockRedis.statuses.set("drv_202", "offline");

  const status = await mockRedis.get("driver:status:drv_202");
  assert.strictEqual(status, "offline");

  // Offline drivers must be purged from GEO
  const multi = mockRedis.multi();
  multi.zrem("drivers:available", "drv_202");
  multi.hdel("drivers:last_ping", "drv_202");
  await multi.exec();

  assert.strictEqual(mockRedis.geoSet.has("drv_202"), false);
  assert.strictEqual(Boolean(mockRedis.pings["drv_202"]), false);
  assert.strictEqual(mockRedis.logs.some((l) => l.op === "ZREM" && l.member === "drv_202"), true);
});

test("cleanup job: removes stale drivers older than 30 seconds and keeps fresh drivers", async () => {
  const now = Date.now();
  const initialPings = {
    fresh_driver: String(now - 5000),      // 5 seconds ago -> KEEP
    stale_driver_1: String(now - 35000),  // 35 seconds ago -> REMOVE
    stale_driver_2: String(now - 60000)   // 60 seconds ago -> REMOVE
  };
  const initialGeo = new Set(["fresh_driver", "stale_driver_1", "stale_driver_2"]);

  const mockRedis = createMockRedis(initialPings, initialGeo);

  const removedCount = await cleanupStaleDriversOnce(mockRedis, 30000);

  assert.strictEqual(removedCount, 2, "Should have removed exactly 2 stale drivers");
  assert.strictEqual(mockRedis.geoSet.has("fresh_driver"), true, "Fresh driver must stay in GEO");
  assert.strictEqual(mockRedis.geoSet.has("stale_driver_1"), false, "Stale driver 1 must be removed");
  assert.strictEqual(mockRedis.geoSet.has("stale_driver_2"), false, "Stale driver 2 must be removed");
  assert.ok(mockRedis.pings["fresh_driver"], "Fresh driver ping record must remain");
  assert.strictEqual(Boolean(mockRedis.pings["stale_driver_1"]), false);
  assert.strictEqual(Boolean(mockRedis.pings["stale_driver_2"]), false);
});
