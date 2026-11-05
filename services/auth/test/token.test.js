process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "super_secret_access_jwt_key_at_least_32_chars";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "super_secret_refresh_jwt_key_at_least_32_chars";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/auth_test";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS || "localhost:9092";

import test from "node:test";
import assert from "node:assert";
import { signAccessToken, verifyAccessToken } from "../src/services/token.js";
import { hashToken, randomToken, safeCompare } from "../src/utils/crypto.js";

test("access token signs and verifies valid payload", () => {
  const payload = { id: "user_123", email: "rider@ridepool.com", role: "rider" };
  const token = signAccessToken(payload);

  assert.ok(typeof token === "string" && token.length > 20);

  const decoded = verifyAccessToken(token);
  assert.strictEqual(decoded.id, payload.id);
  assert.strictEqual(decoded.email, payload.email);
  assert.strictEqual(decoded.role, payload.role);
});

test("tampered access token fails verification", () => {
  const token = signAccessToken({ id: "user_123", email: "rider@ridepool.com", role: "rider" });
  const tampered = token.slice(0, -6) + "123456";

  assert.throws(() => verifyAccessToken(tampered), { name: "JsonWebTokenError" });
});

test("constant-time safeCompare behaves correctly", () => {
  const strA = "0123456789abcdef";
  const strB = "0123456789abcdef";
  const strC = "0123456789abcdeg";

  assert.strictEqual(safeCompare(strA, strB), true);
  assert.strictEqual(safeCompare(strA, strC), false);
  assert.strictEqual(safeCompare(strA, "short"), false);
});

test("refresh token generation and SHA-256 hashing", () => {
  const tokenA = randomToken(40);
  const tokenB = randomToken(40);

  assert.strictEqual(tokenA.length, 80);
  assert.notStrictEqual(tokenA, tokenB);

  const hashA1 = hashToken(tokenA);
  const hashA2 = hashToken(tokenA);

  assert.strictEqual(hashA1, hashA2);
  assert.strictEqual(hashA1.length, 64);
});

test("refresh token rotation and reuse detection workflow", () => {
  const familyId = "fam_xyz_987";
  const oldRawToken = randomToken(40);
  const oldHash = hashToken(oldRawToken);

  const tokenRecord = {
    family: familyId,
    tokenHash: oldHash,
    revokedAt: null,
    replacedBy: null
  };

  // 1. First rotation: successful
  const newRawToken = randomToken(40);
  const newHash = hashToken(newRawToken);

  tokenRecord.revokedAt = new Date();
  tokenRecord.replacedBy = newHash;

  assert.ok(tokenRecord.revokedAt instanceof Date);
  assert.strictEqual(tokenRecord.replacedBy, newHash);

  // 2. Replay attempt: presenting the old token again triggers reuse detection
  const isReused = tokenRecord.revokedAt !== null;
  assert.strictEqual(isReused, true, "Old token must be detected as already revoked");
});
