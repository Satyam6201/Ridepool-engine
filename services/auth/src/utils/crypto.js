import crypto from "node:crypto";

export function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 40) {
  return crypto.randomBytes(bytes).toString("hex");
}
