import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { UnauthorizedError, ForbiddenError, logger } from "shared";
import { RefreshToken } from "../models/token.js";
import { User } from "../models/user.js";
import { hashToken, randomToken, safeCompare } from "../utils/crypto.js";
import { env } from "../config/env.js";

function getRefreshTokenExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);
  return expiry;
}

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export async function createRefreshToken(userId, family) {
  const rawToken = randomToken(40);
  const tokenHash = hashToken(rawToken);

  await RefreshToken.create({
    userId,
    tokenHash,
    family: family || crypto.randomUUID(),
    expiresAt: getRefreshTokenExpiry()
  });

  return rawToken;
}

export async function rotateRefreshToken(rawToken, ip = "unknown") {
  const incomingHash = hashToken(rawToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash: incomingHash });

  if (!tokenRecord || !safeCompare(incomingHash, tokenRecord.tokenHash)) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  // Token reuse detection: if a revoked token is presented, revoke the whole family
  if (tokenRecord.revokedAt) {
    await RefreshToken.updateMany(
      { family: tokenRecord.family, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    logger.warn("AUDIT: Refresh token reuse detected, family revoked", {
      family: tokenRecord.family,
      userId: tokenRecord.userId.toString(),
      ip
    });

    throw new ForbiddenError("Refresh token reuse detected, session revoked");
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token expired");
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw new UnauthorizedError("User no longer exists");
  }

  const newRawToken = randomToken(40);
  const newHash = hashToken(newRawToken);

  tokenRecord.revokedAt = new Date();
  tokenRecord.replacedBy = newHash;
  await tokenRecord.save();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: newHash,
    family: tokenRecord.family,
    expiresAt: getRefreshTokenExpiry()
  });

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return {
    accessToken,
    refreshToken: newRawToken
  };
}

export async function revokeRefreshToken(rawToken) {
  if (!rawToken) return;

  const incomingHash = hashToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash: incomingHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}
