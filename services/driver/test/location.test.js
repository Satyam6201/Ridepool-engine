process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secret_jwt_access_token_min_32_chars";
process.env.MONGO_URI = "mongodb://localhost:27017/driver_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { locationPingSchema } from "../src/controllers/location.js";
import {
  calculateDistanceMeters,
  checkSpeedJump,
  MAX_SPEED_MPS
} from "../src/utils/geo.js";

test("location validation: accepts valid coordinates and heading", () => {
  const validPing = {
    lat: 37.7749,
    lng: -122.4194,
    heading: 90,
    speed: 15,
    timestamp: new Date().toISOString()
  };

  const parsed = locationPingSchema.parse(validPing);
  assert.strictEqual(parsed.lat, 37.7749);
  assert.strictEqual(parsed.lng, -122.4194);
  assert.strictEqual(parsed.heading, 90);
});

test("location validation: rejects invalid latitude (> 90 or < -90)", () => {
  assert.throws(
    () => locationPingSchema.parse({ lat: 95.0, lng: -122.4194 }),
    /lat must be <= 90/
  );
  assert.throws(
    () => locationPingSchema.parse({ lat: -95.0, lng: -122.4194 }),
    /lat must be >= -90/
  );
});

test("location validation: rejects invalid longitude (> 180 or < -180)", () => {
  assert.throws(
    () => locationPingSchema.parse({ lat: 37.7749, lng: 185.0 }),
    /lng must be <= 180/
  );
  assert.throws(
    () => locationPingSchema.parse({ lat: 37.7749, lng: -185.0 }),
    /lng must be >= -180/
  );
});

test("location validation: rejects invalid heading (> 360 or < 0)", () => {
  assert.throws(
    () => locationPingSchema.parse({ lat: 37.7749, lng: -122.4194, heading: 400 }),
    /heading must be <= 360/
  );
  assert.throws(
    () => locationPingSchema.parse({ lat: 37.7749, lng: -122.4194, heading: -10 }),
    /heading must be >= 0/
  );
});

test("location validation: strictly rejects unknown fields", () => {
  assert.throws(
    () =>
      locationPingSchema.parse({
        lat: 37.7749,
        lng: -122.4194,
        hackedField: "injected"
      }),
    /Unrecognized key/
  );
});

test("geo calculation: distance between known points is accurate", () => {
  // San Francisco City Hall to Ferry Building (~2.8 - 3.2 km)
  const sfCityHall = { lat: 37.7793, lng: -122.4193 };
  const sfFerryBuilding = { lat: 37.7955, lng: -122.3937 };

  const distMeters = calculateDistanceMeters(
    sfCityHall.lat,
    sfCityHall.lng,
    sfFerryBuilding.lat,
    sfFerryBuilding.lng
  );

  assert.ok(distMeters > 2800 && distMeters < 3200, `Expected ~3000m, got ${distMeters}`);
});

test("speed jump: accepts normal driving speed (50 km/h = 13.8 m/s)", () => {
  const baseTime = Date.now();
  const prevPing = {
    lat: 37.7749,
    lng: -122.4194,
    timestamp: baseTime
  };
  // 300 meters away after 30 seconds (~36 km/h)
  const currentPing = {
    lat: 37.7776,
    lng: -122.4194,
    timestamp: baseTime + 30000
  };

  const result = checkSpeedJump(prevPing, currentPing, MAX_SPEED_MPS);
  assert.strictEqual(result.valid, true);
  assert.ok(result.speedMps < MAX_SPEED_MPS);
});

test("speed jump: rejects impossible jump (> 50 m/s / 180 km/h)", () => {
  const baseTime = Date.now();
  const prevPing = {
    lat: 37.7749,
    lng: -122.4194,
    timestamp: baseTime
  };
  // Jump 5 km in 5 seconds (1000 m/s = 3600 km/h)
  const currentPing = {
    lat: 37.8199,
    lng: -122.4194,
    timestamp: baseTime + 5000
  };

  const result = checkSpeedJump(prevPing, currentPing, MAX_SPEED_MPS);
  assert.strictEqual(result.valid, false);
  assert.match(result.reason, /Impossible speed jump detected/);
});

test("speed jump: rejects non-chronological / backward timestamps", () => {
  const baseTime = Date.now();
  const prevPing = {
    lat: 37.7749,
    lng: -122.4194,
    timestamp: baseTime
  };
  const currentPing = {
    lat: 37.7750,
    lng: -122.4194,
    timestamp: baseTime - 1000 // In the past!
  };

  const result = checkSpeedJump(prevPing, currentPing, MAX_SPEED_MPS);
  assert.strictEqual(result.valid, false);
  assert.match(result.reason, /Invalid timestamp/);
});
