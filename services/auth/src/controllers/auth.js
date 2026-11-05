import * as authService from "../services/auth.js";

function getClientIp(req) {
  return req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
}

export async function register(req, res, next) {
  try {
    const ip = getClientIp(req);
    const result = await authService.register(req.body, ip);
    return res.status(201).json({
      status: "success",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const ip = getClientIp(req);
    const result = await authService.login(req.body, ip);
    return res.status(200).json({
      status: "success",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const ip = getClientIp(req);
    const { refreshToken } = req.body;
    const tokens = await authService.refresh(refreshToken, ip);
    return res.status(200).json({
      status: "success",
      data: tokens
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const ip = getClientIp(req);
    const { refreshToken } = req.body;
    await authService.logout(refreshToken, ip);
    return res.status(200).json({
      status: "success",
      message: "Logged out successfully"
    });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req, res, next) {
  try {
    const ip = getClientIp(req);
    await authService.logoutAll(req.user.id, ip);
    return res.status(200).json({
      status: "success",
      message: "Logged out of all devices successfully"
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    const profile = await authService.getProfile(req.user.id);
    return res.status(200).json({
      status: "success",
      data: { user: profile }
    });
  } catch (err) {
    next(err);
  }
}
