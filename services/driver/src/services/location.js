import { BadRequestError, logger } from "shared";
import { redis } from "../config/redis.js";
import { publishDriverLocation } from "../config/kafka.js";
import { checkSpeedJump } from "../utils/geo.js";

/**
 * Validates GPS ping, checks for impossible speed jumps against cached previous ping,
 * stores the latest ping in Redis, and publishes to Kafka partitioned by driverId.
 */
export async function validateAndPublishLocation(driverId, pingData) {
  const currentTimestamp = pingData.timestamp
    ? new Date(pingData.timestamp).getTime()
    : Date.now();

  const currentPing = {
    lat: pingData.lat,
    lng: pingData.lng,
    heading: pingData.heading ?? 0,
    speed: pingData.speed ?? 0,
    timestamp: currentTimestamp
  };

  // Check against previous ping stored in Redis
  const prevPingKey = `driver:ping:${driverId}`;
  const prevPingRaw = await redis.hgetall(prevPingKey);

  if (prevPingRaw && prevPingRaw.lat && prevPingRaw.lng && prevPingRaw.timestamp) {
    const prevPing = {
      lat: Number(prevPingRaw.lat),
      lng: Number(prevPingRaw.lng),
      timestamp: Number(prevPingRaw.timestamp)
    };

    const speedCheck = checkSpeedJump(prevPing, currentPing);
    if (!speedCheck.valid) {
      logger.warn("Location ping rejected", { driverId, reason: speedCheck.reason });
      throw new BadRequestError(speedCheck.reason);
    }

    if (speedCheck.speedMps && !pingData.speed) {
      currentPing.speed = Math.round(speedCheck.speedMps * 3.6);
    }
  }

  // Update cached latest ping in Redis (1 hour TTL)
  await redis
    .multi()
    .hset(prevPingKey, {
      lat: currentPing.lat,
      lng: currentPing.lng,
      heading: currentPing.heading,
      speed: currentPing.speed,
      timestamp: currentPing.timestamp
    })
    .expire(prevPingKey, 3600)
    .exec();

  // Fast publish to Kafka partitioned by driverId
  const payload = {
    driverId,
    lat: currentPing.lat,
    lng: currentPing.lng,
    heading: currentPing.heading,
    speed: currentPing.speed,
    timestamp: new Date(currentPing.timestamp).toISOString()
  };

  await publishDriverLocation(driverId, payload);
}
