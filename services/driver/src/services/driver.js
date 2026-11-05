import { NotFoundError, BadRequestError } from "shared";
import { Driver } from "../models/driver.js";
import { redis } from "../config/redis.js";
import { REDIS_GEO_KEY, REDIS_LAST_PING_KEY } from "./consumer.js";

/**
 * Retrieves driver profile by authenticated user ID.
 */
export async function getDriverProfile(userId) {
  const driver = await Driver.findOne({ userId }).lean();
  if (!driver) {
    throw new NotFoundError("Driver profile not found");
  }
  return driver;
}

/**
 * Creates or updates a driver profile with vehicle details.
 */
export async function upsertDriverProfile(userId, data) {
  const existing = await Driver.findOne({ userId });

  if (existing) {
    existing.name = data.name || existing.name;
    existing.phone = data.phone || existing.phone;
    existing.licenseNumber = data.licenseNumber || existing.licenseNumber;
    if (data.vehicle) {
      existing.vehicle = { ...existing.vehicle.toObject(), ...data.vehicle };
    }
    await existing.save();
    return existing;
  }

  const driver = await Driver.create({
    userId,
    name: data.name,
    phone: data.phone,
    licenseNumber: data.licenseNumber,
    vehicle: data.vehicle,
    status: "offline"
  });

  await redis.set(`driver:status:${userId}`, "offline", "EX", 86400);
  return driver;
}

/**
 * Updates driver status (offline, available, on_trip).
 * Syncs with Redis cache and removes driver from Redis GEO if not available.
 */
export async function updateDriverStatus(userId, status) {
  const validStatuses = ["offline", "available", "on_trip"];
  if (!validStatuses.includes(status)) {
    throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const driver = await Driver.findOneAndUpdate(
    { userId },
    { status },
    { new: true }
  );

  if (!driver) {
    throw new NotFoundError("Driver profile not found");
  }

  // Update Redis status cache
  await redis.set(`driver:status:${userId}`, status, "EX", 86400);

  // If driver goes offline or is on_trip, immediately purge from available GEO index
  if (status !== "available") {
    await redis
      .multi()
      .zrem(REDIS_GEO_KEY, userId)
      .hdel(REDIS_LAST_PING_KEY, userId)
      .exec();
  }

  return driver;
}

/**
 * Finds nearby available drivers using Redis GEO.
 */
export async function findNearbyDrivers(lng, lat, radiusKm = 5, limit = 10) {
  // Use GEORADIUS or GEOSEARCH on Redis GEO index
  const results = await redis.georadius(
    REDIS_GEO_KEY,
    lng,
    lat,
    radiusKm,
    "km",
    "WITHDIST",
    "WITHCOORD",
    "ASC",
    "COUNT",
    limit
  );

  if (!results || results.length === 0) {
    return [];
  }

  const driverIds = results.map((r) => r[0]);
  const profiles = await Driver.find({ userId: { $in: driverIds } })
    .select("userId name phone vehicle rating currentLocation")
    .lean();

  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  return results.map(([id, distance, coords]) => ({
    driverId: id,
    distanceKm: parseFloat(distance),
    location: {
      lng: parseFloat(coords[0]),
      lat: parseFloat(coords[1])
    },
    driver: profileMap.get(id) || null
  }));
}
