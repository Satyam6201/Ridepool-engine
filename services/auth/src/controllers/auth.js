import * as authService from "../services/auth.js";

export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
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
    const result = await authService.login(req.body);
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
    const { refreshToken } = req.body;
    const tokens = await authService.rotateRefreshToken(refreshToken);
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
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    return res.status(200).json({
      status: "success",
      message: "Logged out successfully"
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
