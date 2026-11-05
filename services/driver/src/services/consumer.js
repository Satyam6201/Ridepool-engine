import { logger } from "shared";
import { Driver } from "../models/driver.js";
import { LocationHistory } from "../models/locationHistory.js";
import { redis } from "../config/redis.js";
import { subscribeToDriverLocations } from "../config/kafka.js";

export const REDIS_GEO_KEY = "drivers:available";
export const REDIS_LAST_PING_KEY = "drivers:last_ping";

/**
 * Handles an incoming driver location event.
 * Updates Redis GEO only if driver is currently available.
 * Persists ping to LocationHistory and updates current location in Driver model.
 */
export async function handleDriverLocationMessage({ data }) {
  if (!data || !data.driverId) {
    return;
  }

  const { driverId, lat, lng, heading, speed, timestamp } = data;
  const pingDate = new Date(timestamp);

  // Check driver status (cached in Redis or retrieved from DB)
  let status = await redis.get(`driver:status:${driverId}`);

  if (!status) {
    const driver = await Driver.findOne({ userId: driverId }).select("status").lean();
    status = driver?.status || "offline";
    await redis.set(`driver:status:${driverId}`, status, "EX", 86400);
  }

  // Redis GEO sync: only 'available' drivers are added to the spatial index
  if (status === "available") {
    await redis
      .multi()
      .geoadd(REDIS_GEO_KEY, lng, lat, driverId)
      .hset(REDIS_LAST_PING_KEY, driverId, Date.now())
      .exec();
  } else {
    await redis
      .multi()
      .zrem(REDIS_GEO_KEY, driverId)
      .hdel(REDIS_LAST_PING_KEY, driverId)
      .exec();
  }

  // Store in MongoDB location history (subject to 24-hour TTL index)
  try {
    await Promise.all([
      LocationHistory.create({
        driverId,
        location: {
          type: "Point",
          coordinates: [lng, lat]
        },
        heading: heading || 0,
        speed: speed || 0,
        timestamp: pingDate
      }),
      Driver.findOneAndUpdate(
        { userId: driverId },
        {
          currentLocation: {
            type: "Point",
            coordinates: [lng, lat]
          },
          heading: heading || 0,
          lastPingAt: pingDate
        }
      )
    ]);
  } catch (err) {
    logger.error("Failed to persist driver location to MongoDB", {
      driverId,
      error: err.message
    });
  }
}

/**
 * Starts the Kafka consumer for driver locations.
 */
export async function startLocationConsumer() {
  await subscribeToDriverLocations(handleDriverLocationMessage);
  logger.info("Driver location Kafka consumer started");
}
