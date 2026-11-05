process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secret_jwt_access_token_min_32_chars";
process.env.MONGO_URI = "mongodb://localhost:27017/driver_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { pingSchema } from "../src/controllers/location.js";
import { calcDistance, checkSpeed, MAX_SPEED } from "../src/utils/geo.js";

test("location validation: accepts valid coordinates and heading", () => {
  const valid = {
    lat: 37.7749,
    lng: -122.4194,
    heading: 90,
    speed: 15,
    timestamp: new Date().toISOString()
  };

  const parsed = pingSchema.parse(valid);
  assert.strictEqual(parsed.lat, 37.7749);
  assert.strictEqual(parsed.lng, -122.4194);
  assert.strictEqual(parsed.heading, 90);
});

test("location validation: rejects invalid latitude (> 90 or < -90)", () => {
  assert.throws(() => pingSchema.parse({ lat: 95.0, lng: -122.4194 }), /lat must be <= 90/);
  assert.throws(() => pingSchema.parse({ lat: -95.0, lng: -122.4194 }), /lat must be >= -90/);
});

test("location validation: rejects invalid longitude (> 180 or < -180)", () => {
  assert.throws(() => pingSchema.parse({ lat: 37.7749, lng: 185.0 }), /lng must be <= 180/);
  assert.throws(() => pingSchema.parse({ lat: 37.7749, lng: -185.0 }), /lng must be >= -180/);
});

test("location validation: rejects invalid heading (> 360 or < 0)", () => {
  assert.throws(() => pingSchema.parse({ lat: 37.7749, lng: -122.4194, heading: 400 }), /heading must be <= 360/);
  assert.throws(() => pingSchema.parse({ lat: 37.7749, lng: -122.4194, heading: -10 }), /heading must be >= 0/);
});

test("location validation: strictly rejects unknown fields", () => {
  assert.throws(
    () =>
      pingSchema.parse({
        lat: 37.7749,
        lng: -122.4194,
        hackedField: "injected"
      }),
    /Unrecognized key/
  );
});

test("geo calculation: distance between known points is accurate", () => {
  const cityHall = { lat: 37.7793, lng: -122.4193 };
  const ferryBuilding = { lat: 37.7955, lng: -122.3937 };

  const dist = calcDistance(cityHall.lat, cityHall.lng, ferryBuilding.lat, ferryBuilding.lng);
  assert.ok(dist > 2800 && dist < 3200, `Expected ~3000m, got ${dist}`);
});

test("speed jump: accepts normal driving speed (50 km/h = 13.8 m/s)", () => {
  const now = Date.now();
  const prev = { lat: 37.7749, lng: -122.4194, timestamp: now };
  const curr = { lat: 37.7776, lng: -122.4194, timestamp: now + 30000 };

  const result = checkSpeed(prev, curr, MAX_SPEED);
  assert.strictEqual(result.valid, true);
  assert.ok(result.speed < MAX_SPEED);
});

test("speed jump: rejects impossible jump (> 50 m/s / 180 km/h)", () => {
  const now = Date.now();
  const prev = { lat: 37.7749, lng: -122.4194, timestamp: now };
  const curr = { lat: 37.8199, lng: -122.4194, timestamp: now + 5000 };

  const result = checkSpeed(prev, curr, MAX_SPEED);
  assert.strictEqual(result.valid, false);
  assert.match(result.reason, /Impossible speed jump detected/);
});

test("speed jump: rejects non-chronological / backward timestamps", () => {
  const now = Date.now();
  const prev = { lat: 37.7749, lng: -122.4194, timestamp: now };
  const curr = { lat: 37.7750, lng: -122.4194, timestamp: now - 1000 };

  const result = checkSpeed(prev, curr, MAX_SPEED);
  assert.strictEqual(result.valid, false);
  assert.match(result.reason, /Invalid timestamp/);
});
