import { logger } from "shared";
import { Driver } from "../models/driver.js";
import { LocationHistory } from "../models/locationHistory.js";
import { redis } from "../config/redis.js";
import { startConsumer } from "../config/kafka.js";

export const GEO_KEY = "drivers:available";
export const PING_KEY = "drivers:last_ping";

export async function handleLocation({ data }) {
  if (!data?.driverId) return;

  const { driverId, lat, lng, heading, speed, timestamp } = data;
  const date = new Date(timestamp);

  let status = await redis.get(`driver:status:${driverId}`);
  if (!status) {
    const driver = await Driver.findOne({ userId: driverId }).select("status").lean();
    status = driver?.status || "offline";
    await redis.set(`driver:status:${driverId}`, status, "EX", 86400);
  }

  if (status === "available") {
    await redis
      .multi()
      .geoadd(GEO_KEY, lng, lat, driverId)
      .hset(PING_KEY, driverId, Date.now())
      .exec();
  } else {
    await redis
      .multi()
      .zrem(GEO_KEY, driverId)
      .hdel(PING_KEY, driverId)
      .exec();
  }

  try {
    await Promise.all([
      LocationHistory.create({
        driverId,
        location: { type: "Point", coordinates: [lng, lat] },
        heading: heading || 0,
        speed: speed || 0,
        timestamp: date
      }),
      Driver.findOneAndUpdate(
        { userId: driverId },
        {
          currentLocation: { type: "Point", coordinates: [lng, lat] },
          heading: heading || 0,
          lastPingAt: date
        }
      )
    ]);
  } catch (err) {
    logger.error("Failed to save location history", { driverId, error: err.message });
  }
}

export async function runLocationConsumer() {
  await startConsumer(handleLocation);
}
