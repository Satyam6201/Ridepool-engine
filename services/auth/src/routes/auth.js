import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { rateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    role: z.enum(["rider", "driver"]).default("rider"),
    phone: z.string().trim().optional().default("")
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email("Invalid email address"),
    password: z.string().min(1, "Password is required")
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required")
  })
  .strict();

const logoutSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required")
  })
  .strict();

router.post("/register", rateLimiter({ prefix: "register", maxRequests: 10 }), validate(registerSchema), authController.register);
router.post("/login", rateLimiter({ prefix: "login", maxRequests: 10 }), validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(logoutSchema), authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
