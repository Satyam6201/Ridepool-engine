import { NotFoundError, BadRequestError } from "shared";
import { Driver } from "../models/driver.js";
import { redis } from "../config/redis.js";
import { GEO_KEY, PING_KEY } from "./consumer.js";

export async function getProfile(userId) {
  const driver = await Driver.findOne({ userId }).lean();
  if (!driver) throw new NotFoundError("Driver profile not found");
  return driver;
}

export async function saveProfile(userId, data) {
  const existing = await Driver.findOne({ userId });

  if (existing) {
    if (data.name) existing.name = data.name;
    if (data.phone) existing.phone = data.phone;
    if (data.licenseNumber) existing.licenseNumber = data.licenseNumber;
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

export async function updateStatus(userId, status) {
  const valid = ["offline", "available", "on_trip"];
  if (!valid.includes(status)) {
    throw new BadRequestError(`Invalid status. Must be one of: ${valid.join(", ")}`);
  }

  const driver = await Driver.findOneAndUpdate({ userId }, { status }, { new: true });
  if (!driver) throw new NotFoundError("Driver profile not found");

  await redis.set(`driver:status:${userId}`, status, "EX", 86400);

  if (status !== "available") {
    await redis.multi().zrem(GEO_KEY, userId).hdel(PING_KEY, userId).exec();
  }

  return driver;
}

export async function findNearby(lng, lat, radius = 5, limit = 10) {
  const raw = await redis.georadius(
    GEO_KEY,
    lng,
    lat,
    radius,
    "km",
    "WITHDIST",
    "WITHCOORD",
    "ASC",
    "COUNT",
    limit
  );

  if (!raw || raw.length === 0) return [];

  const ids = raw.map(([id]) => id);
  const drivers = await Driver.find({ userId: { $in: ids } })
    .select("userId name phone vehicle rating currentLocation")
    .lean();

  const map = new Map(drivers.map((d) => [d.userId, d]));

  return raw.map(([id, distance, coords]) => ({
    driverId: id,
    distanceKm: parseFloat(distance),
    location: {
      lng: parseFloat(coords[0]),
      lat: parseFloat(coords[1])
    },
    driver: map.get(id) || null
  }));
}
