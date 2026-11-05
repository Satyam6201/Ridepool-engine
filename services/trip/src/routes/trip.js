import { Router } from "express";
import { authenticate, authorize, createTokenBucketLimiter } from "shared";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";
import {
  postTrip,
  getTrip,
  patchStatus,
  getHistory
} from "../controllers/trip.js";

const router = Router();
const auth = authenticate(env.JWT_ACCESS_SECRET);
const rateLimit = createTokenBucketLimiter({ redis, preset: "trip" });

// Create trip request (riders only, rate-limited)
router.post("/", auth, authorize("rider"), rateLimit, postTrip);

// Paginated trip history for current user (rider or driver)
router.get("/history", auth, getHistory);

// Get single trip details (ownership validated in controller/service)
router.get("/:id", auth, getTrip);

// Transition trip state (validated against central state machine and ownership)
router.patch("/:id/status", auth, patchStatus);

export default router;
