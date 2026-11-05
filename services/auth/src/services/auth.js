import { ConflictError, NotFoundError, logger } from "shared";
import { User } from "../models/user.js";
import { hashPassword, comparePassword } from "./password.js";
import {
  signAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
} from "./token.js";
import { checkLockout, recordFailedLogin, resetFailedLogins } from "./lockout.js";
import { publishUserRegistered } from "./event.js";

export async function register({ name, email, password, role = "rider", phone = "" }, ip = "unknown") {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
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

  const refreshToken = await createRefreshToken(user._id);

  await publishUserRegistered(user);

  logger.info("AUDIT: User registered", {
    userId: user.id,
    email: user.email,
    role: user.role,
    ip
  });

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken
  };
}

export async function login({ email, password }, ip = "unknown") {
  const normalizedEmail = email.toLowerCase().trim();

  await checkLockout(normalizedEmail, ip);

  const user = await User.findOne({ email: normalizedEmail }).select("+password");

  if (!user) {
    await recordFailedLogin(normalizedEmail, ip);
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) {
    await recordFailedLogin(normalizedEmail, ip);
  }

  await resetFailedLogins(normalizedEmail);

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  const refreshToken = await createRefreshToken(user._id);

  logger.info("AUDIT: User logged in", {
    userId: user.id,
    email: user.email,
    role: user.role,
    ip
  });

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken
  };
}

export async function refresh(rawToken, ip = "unknown") {
  return rotateRefreshToken(rawToken, ip);
}

export async function logout(rawToken, ip = "unknown") {
  await revokeRefreshToken(rawToken);
  logger.info("AUDIT: User logged out", { ip });
}

export async function logoutAll(userId, ip = "unknown") {
  await revokeAllUserTokens(userId);
  logger.info("AUDIT: User logged out all devices", { userId, ip });
}

export async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }
  return user.toJSON();
}
