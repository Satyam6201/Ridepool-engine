import test from "node:test";
import assert from "node:assert";
import {
  validatePasswordRules,
  hashPassword,
  comparePassword
} from "../src/services/password.js";

test("password rule validation rejects weak passwords", () => {
  // Too short
  assert.throws(() => validatePasswordRules("Short1!"), /at least 8 characters/);

  // Missing uppercase
  assert.throws(() => validatePasswordRules("lowercase1!"), /uppercase/);

  // Missing lowercase
  assert.throws(() => validatePasswordRules("UPPERCASE1!"), /lowercase/);

  // Missing number
  assert.throws(() => validatePasswordRules("NoNumbers!"), /number/);

  // Missing special char
  assert.throws(() => validatePasswordRules("NoSpecialChar1"), /special character/);
});

test("password rule validation accepts strong password", () => {
  const valid = validatePasswordRules("P@ssw0rdSecure!");
  assert.strictEqual(valid, true);
});

test("password hashing uses bcrypt cost 12", async () => {
  const plain = "Str0ngP@ssword!";
  const hash = await hashPassword(plain);

  assert.ok(hash.startsWith("$2b$12$"), "Hash should start with bcrypt cost 12 prefix");

  const isMatch = await comparePassword(plain, hash);
  assert.strictEqual(isMatch, true);

  const isWrong = await comparePassword("WrongP@ssword1!", hash);
  assert.strictEqual(isWrong, false);
});
