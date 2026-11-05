import { Router } from "express";
import { z } from "zod";
import { authenticate } from "shared";
import * as authController from "../controllers/auth.js";
import { validate } from "../middleware/validate.js";
import { rateLimiter } from "../middleware/rateLimit.js";
import { env } from "../config/env.js";

const router = Router();
const requireAuth = authenticate(env.JWT_ACCESS_SECRET);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must not exceed 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, "Password must contain at least one special character");

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: passwordSchema,
    role: z.enum(["rider", "driver"], {
      errorMap: () => ({ message: "Role must be either rider or driver" })
    }),
    phone: z.string().trim().optional().default("")
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
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
router.post("/logout-all", requireAuth, authController.logoutAll);
router.get("/me", requireAuth, authController.me);

export default router;
