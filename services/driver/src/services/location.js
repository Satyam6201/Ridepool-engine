import { BadRequestError } from "shared";
import { redis } from "../config/redis.js";
import { sendLocation } from "../config/kafka.js";
import { checkSpeed } from "../utils/geo.js";

export async function saveLocation(driverId, ping) {
  const timestamp = ping.timestamp ? new Date(ping.timestamp).getTime() : Date.now();
  const current = {
    lat: ping.lat,
    lng: ping.lng,
    heading: ping.heading ?? 0,
    speed: ping.speed ?? 0,
    timestamp
  };

  const pingKey = `driver:ping:${driverId}`;
  const lastPing = await redis.hgetall(pingKey);

  if (lastPing?.lat && lastPing?.lng && lastPing?.timestamp) {
    const prev = {
      lat: Number(lastPing.lat),
      lng: Number(lastPing.lng),
      timestamp: Number(lastPing.timestamp)
    };

    const check = checkSpeed(prev, current);
    if (!check.valid) {
      throw new BadRequestError(check.reason);
    }

    if (check.speed && !ping.speed) {
      current.speed = Math.round(check.speed * 3.6);
    }
  }

  await redis
    .multi()
    .hset(pingKey, {
      lat: current.lat,
      lng: current.lng,
      heading: current.heading,
      speed: current.speed,
      timestamp: current.timestamp
    })
    .expire(pingKey, 3600)
    .exec();

  const payload = {
    driverId,
    lat: current.lat,
    lng: current.lng,
    heading: current.heading,
    speed: current.speed,
    timestamp: new Date(current.timestamp).toISOString()
  };

  await sendLocation(driverId, payload);
}
