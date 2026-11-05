process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secret_jwt_access_token_min_32_chars";
process.env.MONGO_URI = "mongodb://localhost:27017/trip_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { createTripSchema } from "../src/controllers/trip.js";

test("trip validation: accepts valid pickup and drop coordinates", () => {
  const valid = {
    pickup: { lat: 37.7749, lng: -122.4194, address: "Market St, SF" },
    drop: { lat: 37.7955, lng: -122.3937, address: "Ferry Building, SF" }
  };

  const parsed = createTripSchema.parse(valid);
  assert.strictEqual(parsed.pickup.lat, 37.7749);
  assert.strictEqual(parsed.drop.lat, 37.7955);
});

test("trip validation: strictly rejects unknown fields and invalid coordinates", () => {
  assert.throws(
    () =>
      createTripSchema.parse({
        pickup: { lat: 37.7749, lng: -122.4194 },
        drop: { lat: 37.7955, lng: -122.3937 },
        clientSentFare: 10 // Client must NEVER be allowed to inject fare!
      }),
    /Unrecognized key/
  );

  assert.throws(
    () =>
      createTripSchema.parse({
        pickup: { lat: 95.0, lng: -122.4194 },
        drop: { lat: 37.7955, lng: -122.3937 }
      }),
    /Number must be less than or equal to 90/
  );
});

test("ownership logic: allows rider and assigned driver, blocks third party", () => {
  const trip = {
    _id: "trip_999",
    riderId: "rider_1",
    driverId: "driver_2",
    status: "matched"
  };

  function checkAccess(user) {
    if (trip.riderId !== user.id && trip.driverId !== user.id && user.role !== "admin") {
      throw new Error("Forbidden: Not authorized");
    }
    return true;
  }

  // Rider has access
  assert.strictEqual(checkAccess({ id: "rider_1", role: "rider" }), true);

  // Assigned driver has access
  assert.strictEqual(checkAccess({ id: "driver_2", role: "driver" }), true);

  // Admin has access
  assert.strictEqual(checkAccess({ id: "admin_1", role: "admin" }), true);

  // Other driver is blocked
  assert.throws(() => checkAccess({ id: "driver_99", role: "driver" }), /Forbidden/);

  // Other rider is blocked
  assert.throws(() => checkAccess({ id: "rider_88", role: "rider" }), /Forbidden/);
});

test("idempotency logic: prevents duplicate trip creation on double tap", async () => {
  const mockCache = new Map();

  async function mockCreateTripWithIdempotency(riderId, idempotencyKey, tripFactory) {
    const key = `idempotency:trip:${riderId}:${idempotencyKey}`;
    if (mockCache.has(key)) {
      return { tripId: mockCache.get(key), isReplay: true };
    }
    const newTrip = tripFactory();
    mockCache.set(key, newTrip.id);
    return { tripId: newTrip.id, isReplay: false };
  }

  let counter = 0;
  const factory = () => ({ id: `trip_${++counter}` });

  // First tap creates trip_1
  const firstTap = await mockCreateTripWithIdempotency("rider_1", "tap_key_abc", factory);
  assert.strictEqual(firstTap.isReplay, false);
  assert.strictEqual(firstTap.tripId, "trip_1");

  // Second tap (network retry / double-tap) returns existing trip_1 without creating trip_2
  const secondTap = await mockCreateTripWithIdempotency("rider_1", "tap_key_abc", factory);
  assert.strictEqual(secondTap.isReplay, true);
  assert.strictEqual(secondTap.tripId, "trip_1");
  assert.strictEqual(counter, 1, "Only one trip should have been created in database");
});
