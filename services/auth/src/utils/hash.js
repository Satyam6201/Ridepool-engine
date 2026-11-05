import bcrypt from "bcrypt";
import crypto from "node:crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateRandomToken(bytes = 40) {
  return crypto.randomBytes(bytes).toString("hex");
}
