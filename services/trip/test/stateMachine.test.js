process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test_super_secret_jwt_access_token_min_32_chars";
process.env.MONGO_URI = "mongodb://localhost:27017/trip_test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.KAFKA_BROKERS = "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import {
  TRIP_STATES,
  canTransition,
  validateTransition
} from "../src/utils/stateMachine.js";
import { estimateFare } from "../src/services/pricing.js";

const EXPECTED_ALLOWED = {
  requested: ["matching", "cancelled"],
  matching: ["matched", "cancelled"],
  matched: ["driver_arrived", "cancelled"],
  driver_arrived: ["started", "cancelled"],
  started: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

test("state machine: allows every valid transition and blocks all others", () => {
  for (const from of TRIP_STATES) {
    const validNextStates = EXPECTED_ALLOWED[from];

    for (const to of TRIP_STATES) {
      const allowed = canTransition(from, to);

      if (validNextStates.includes(to)) {
        assert.strictEqual(
          allowed,
          true,
          `Transition from '${from}' to '${to}' should be ALLOWED`
        );
        assert.strictEqual(validateTransition(from, to), true);
      } else {
        assert.strictEqual(
          allowed,
          false,
          `Transition from '${from}' to '${to}' should be BLOCKED`
        );
        assert.throws(
          () => validateTransition(from, to),
          /Invalid trip state transition/
        );
      }
    }
  }
});

test("state machine: terminal states cannot transition to anything", () => {
  for (const to of TRIP_STATES) {
    assert.strictEqual(canTransition("completed", to), false);
    assert.throws(() => validateTransition("completed", to));

    assert.strictEqual(canTransition("cancelled", to), false);
    assert.throws(() => validateTransition("cancelled", to));
  }
});

test("pricing service: calculates fare deterministically from distance and duration", () => {
  const pickup = { lat: 37.7749, lng: -122.4194 };
  const drop = { lat: 37.7955, lng: -122.3937 }; // ~3 km away

  const fare = estimateFare(pickup, drop);

  assert.ok(fare.amount >= 60, "Fare should be at least minimum fare (60 INR)");
  assert.strictEqual(fare.currency, "INR");
  assert.ok(fare.distanceKm > 2.5 && fare.distanceKm < 3.5, `Distance was ${fare.distanceKm}`);
  assert.ok(fare.durationMin >= 5, `Duration was ${fare.durationMin}`);
});
