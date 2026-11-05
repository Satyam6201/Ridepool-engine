import { Router } from "express";
import { authenticate, authorize, createTokenBucketLimiter } from "shared";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";
import { postLocation } from "../controllers/location.js";
import {
  getProfile,
  updateProfile,
  patchStatus,
  getNearby
} from "../controllers/driver.js";

const router = Router();
const auth = authenticate(env.JWT_ACCESS_SECRET);
const locationLimiter = createTokenBucketLimiter({
  redis,
  preset: "location"
});

// GPS ping ingestion (strict, fast, returns 202)
router.post("/location", auth, authorize("driver"), locationLimiter, postLocation);

// Driver profile and vehicle details
router.get("/profile", auth, authorize("driver", "admin"), getProfile);
router.put("/profile", auth, authorize("driver"), updateProfile);

// Driver availability status
router.patch("/status", auth, authorize("driver"), patchStatus);

// Proximity search for available drivers
router.get("/nearby", auth, getNearby);

export default router;
