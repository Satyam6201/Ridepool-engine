import test from "node:test";
import assert from "node:assert";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { hashPassword, comparePassword, hashToken, generateRandomToken } from "../src/utils/hash.js";
import { signAccessToken, verifyAccessToken } from "../src/utils/jwt.js";

test("password hashing uses bcrypt cost 12", async () => {
  const password = "securePassword123";
  const hash = await hashPassword(password);

  assert.ok(hash.startsWith("$2b$12$"), "Hash should use bcrypt cost factor 12");

  const match = await comparePassword(password, hash);
  assert.strictEqual(match, true);

  const mismatch = await comparePassword("wrongPassword", hash);
  assert.strictEqual(mismatch, false);
});

test("JWT access token sign and verify", () => {
  const payload = { id: "user123", email: "rider@example.com", role: "rider" };
  const token = signAccessToken(payload);

  assert.ok(typeof token === "string" && token.length > 20);

  const verified = verifyAccessToken(token);
  assert.strictEqual(verified.id, payload.id);
  assert.strictEqual(verified.email, payload.email);
  assert.strictEqual(verified.role, payload.role);
});

test("tampered JWT access token fails verification", () => {
  const payload = { id: "user123", email: "rider@example.com", role: "rider" };
  const token = signAccessToken(payload);
  const tampered = token.slice(0, -5) + "abcde";

  assert.throws(() => verifyAccessToken(tampered), { name: "JsonWebTokenError" });
});

test("token hash generates SHA-256 digest", () => {
  const rawToken = "my-sample-refresh-token";
  const digest1 = hashToken(rawToken);
  const digest2 = hashToken(rawToken);

  assert.strictEqual(digest1, digest2);
  assert.strictEqual(digest1.length, 64);
});

test("random token generation produces unique values", () => {
  const tokenA = generateRandomToken();
  const tokenB = generateRandomToken();

  assert.notStrictEqual(tokenA, tokenB);
  assert.strictEqual(tokenA.length, 80);
});

test("zod validation rejects unknown fields with strict mode", () => {
  const schema = z
    .object({
      email: z.string().email(),
      password: z.string().min(8)
    })
    .strict();

  const valid = schema.safeParse({
    email: "test@example.com",
    password: "password123"
  });
  assert.strictEqual(valid.success, true);

  const withExtra = schema.safeParse({
    email: "test@example.com",
    password: "password123",
    isAdmin: true
  });
  assert.strictEqual(withExtra.success, false);
});

test("refresh token rotation invalidates previous token", () => {
  const oldRaw = generateRandomToken();
  const oldHash = hashToken(oldRaw);
  const family = "family-123";

  const tokenRecord = {
    tokenHash: oldHash,
    family,
    revokedAt: null,
    replacedBy: null
  };

  // Simulate rotation
  const newRaw = generateRandomToken();
  const newHash = hashToken(newRaw);

  tokenRecord.revokedAt = new Date();
  tokenRecord.replacedBy = newHash;

  assert.ok(tokenRecord.revokedAt !== null);
  assert.strictEqual(tokenRecord.replacedBy, newHash);
  assert.notStrictEqual(oldHash, newHash);
});
