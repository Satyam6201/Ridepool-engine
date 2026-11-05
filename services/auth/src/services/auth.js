import crypto from "node:crypto";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError
} from "shared";
import { User } from "../models/user.js";
import { RefreshToken } from "../models/token.js";
import { hashPassword, comparePassword, hashToken, generateRandomToken } from "../utils/hash.js";
import { signAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";

function buildTokenExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + env.JWT_REFRESH_EXPIRES_DAYS);
  return expiry;
}

async function createRefreshTokenRecord(userId, family) {
  const rawToken = generateRandomToken(40);
  const tokenHash = hashToken(rawToken);

  await RefreshToken.create({
    userId,
    tokenHash,
    family: family || crypto.randomUUID(),
    expiresAt: buildTokenExpiry()
  });

  return rawToken;
}

export async function register({ name, email, password, role = "rider", phone = "" }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new ConflictError("Email already registered");
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role,
    phone: phone.trim()
  });

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = await createRefreshTokenRecord(user._id);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken
  };
}

export async function login({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = await createRefreshTokenRecord(user._id);

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken
  };
}

export async function rotateRefreshToken(rawToken) {
  const incomingHash = hashToken(rawToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash: incomingHash });

  if (!tokenRecord) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  // If a revoked token is used, someone replayed an old token. Invalidate the whole family.
  if (tokenRecord.revokedAt) {
    await RefreshToken.updateMany(
      { family: tokenRecord.family, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    throw new ForbiddenError("Refresh token reuse detected, access revoked");
  }

  if (tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token expired");
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw new UnauthorizedError("User no longer exists");
  }

  const newRawToken = generateRandomToken(40);
  const newHash = hashToken(newRawToken);

  tokenRecord.revokedAt = new Date();
  tokenRecord.replacedBy = newHash;
  await tokenRecord.save();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: newHash,
    family: tokenRecord.family,
    expiresAt: buildTokenExpiry()
  });

  const newAccessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawToken
  };
}

export async function logout(rawToken) {
  if (!rawToken) return;

  const incomingHash = hashToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash: incomingHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user.toJSON();
}
