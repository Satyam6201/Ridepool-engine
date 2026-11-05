import { logger } from "shared";
import { redis } from "../config/redis.js";
import { publishEvent, TOPIC_MATCHED, TOPIC_NO_DRIVER } from "../config/kafka.js";
import { Match } from "../models/match.js";
import { acquireDriverLock, releaseDriverLock } from "./lock.js";
import { env } from "../config/env.js";

export async function findAndRankDrivers(lng, lat, client = redis) {
  // 1. Search within 2 km
  let raw = await client.georadius(
    "drivers:available",
    lng,
    lat,
    2,
    "km",
    "WITHDIST",
    "ASC",
    "COUNT",
    10
  );

  // 2. Expand to 5 km if no drivers in 2 km
  if (!raw || raw.length === 0) {
    raw = await client.georadius(
      "drivers:available",
      lng,
      lat,
      5,
      "km",
      "WITHDIST",
      "ASC",
      "COUNT",
      15
    );
  }

  if (!raw || raw.length === 0) return [];

  // Parse and rank by distance, then rating
  const candidates = [];
  for (const [driverId, dist] of raw) {
    const ratingStr = await client.get(`driver:rating:${driverId}`);
    const rating = ratingStr ? parseFloat(ratingStr) : 4.8;
    candidates.push({
      driverId,
      distanceKm: parseFloat(dist),
      rating
    });
  }

  // Primary: distance ascending, Secondary: rating descending
  candidates.sort((a, b) => {
    if (Math.abs(a.distanceKm - b.distanceKm) > 0.5) {
      return a.distanceKm - b.distanceKm;
    }
    return b.rating - a.rating;
  });

  return candidates;
}

export async function processTripRequest(tripData, client = redis, offerTimeout = env.OFFER_TIMEOUT_MS) {
  const { tripId, riderId, pickup } = tripData;
  if (!tripId) return null;

  // Idempotency: ensure trip.requested is only matched once
  const lockAcquired = await client.set(`match:idempotent:${tripId}`, "1", "NX", "EX", 86400);
  if (!lockAcquired) {
    logger.warn("Idempotent check blocked duplicate trip match attempt", { tripId });
    return null;
  }

  const existingMatch = await Match.findOne({ tripId }).lean();
  if (existingMatch) {
    return existingMatch;
  }

  const match = await Match.create({
    tripId,
    riderId,
    status: "matching"
  });

  const [lng, lat] = pickup.location.coordinates;
  const candidates = await findAndRankDrivers(lng, lat, client);

  if (candidates.length === 0) {
    match.status = "no_driver_found";
    await match.save();
    await publishEvent(TOPIC_NO_DRIVER, { tripId, riderId, reason: "No available drivers found in radius" }, tripId);
    return match;
  }

  let matchedDriverId = null;

  for (const candidate of candidates) {
    const { driverId } = candidate;
    const lockValue = `${tripId}:${Date.now()}`;

    // Acquire lock so driver never receives two offers at once
    const locked = await acquireDriverLock(driverId, lockValue, offerTimeout + 2000, client);
    if (!locked) {
      match.attempts.push({ driverId, result: "rejected" });
      continue;
    }

    // Offer trip to candidate
    await client.set(`offer:${tripId}`, driverId, "PX", offerTimeout);

    // In a production event-driven pipeline, realtime-service pushes an offer to the driver mobile app.
    // For automatic dispatch, the first available locked candidate accepts.
    const accepted = true;

    if (accepted) {
      matchedDriverId = driverId;
      match.attempts.push({ driverId, respondedAt: new Date(), result: "accepted" });
      break;
    } else {
      match.attempts.push({ driverId, respondedAt: new Date(), result: "timed_out" });
      await releaseDriverLock(driverId, lockValue, client);
    }
  }

  if (matchedDriverId) {
    match.status = "matched";
    match.driverId = matchedDriverId;
    match.matchedAt = new Date();
    await match.save();

    await publishEvent(TOPIC_MATCHED, {
      tripId,
      riderId,
      driverId: matchedDriverId,
      status: "matched",
      timestamp: new Date().toISOString()
    }, tripId);
  } else {
    match.status = "no_driver_found";
    await match.save();
    await publishEvent(TOPIC_NO_DRIVER, { tripId, riderId, reason: "All candidates timed out or rejected" }, tripId);
  }

  return match;
}
