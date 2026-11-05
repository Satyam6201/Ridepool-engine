import { Router } from "express";
import { authenticate, authorize, createTokenBucketLimiter } from "shared";
import { env } from "../config/env.js";
import { redis } from "../config/redis.js";
import { postLocation } from "../controllers/location.js";
import {
  getProfile,
  putProfile,
  patchStatus,
  getNearby
} from "../controllers/driver.js";

const router = Router();
const auth = authenticate(env.JWT_ACCESS_SECRET);
const rateLimit = createTokenBucketLimiter({ redis, preset: "location" });

router.post("/location", auth, authorize("driver"), rateLimit, postLocation);
router.get("/profile", auth, authorize("driver", "admin"), getProfile);
router.put("/profile", auth, authorize("driver"), putProfile);
router.patch("/status", auth, authorize("driver"), patchStatus);
router.get("/nearby", auth, getNearby);

export default router;
