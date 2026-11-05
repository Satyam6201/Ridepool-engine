import { NotFoundError, ForbiddenError, BadRequestError } from "shared";
import { Trip } from "../models/trip.js";
import { redis } from "../config/redis.js";
import { publishTripEvent } from "../config/kafka.js";
import { estimateFare } from "./pricing.js";
import { validateTransition } from "../utils/stateMachine.js";

export async function createTrip(riderId, data, idempotencyKey = null) {
  if (idempotencyKey) {
    const cachedId = await redis.get(`idempotency:trip:${riderId}:${idempotencyKey}`);
    if (cachedId) {
      const existing = await Trip.findById(cachedId).lean();
      if (existing) return { trip: existing, isReplay: true };
    }
  }

  const fare = estimateFare(data.pickup, data.drop);

  const trip = await Trip.create({
    riderId,
    pickup: {
      address: data.pickup.address || "",
      location: { type: "Point", coordinates: [data.pickup.lng, data.pickup.lat] }
    },
    drop: {
      address: data.drop.address || "",
      location: { type: "Point", coordinates: [data.drop.lng, data.drop.lat] }
    },
    fare,
    status: "requested",
    idempotencyKey: idempotencyKey || null,
    timeline: [{ status: "requested", actorId: riderId, timestamp: new Date() }]
  });

  if (idempotencyKey) {
    await redis.set(`idempotency:trip:${riderId}:${idempotencyKey}`, trip._id.toString(), "EX", 86400);
  }

  await publishTripEvent("trip.requested", {
    tripId: trip._id.toString(),
    riderId,
    pickup: trip.pickup,
    drop: trip.drop,
    fare: trip.fare,
    status: "requested",
    timestamp: new Date().toISOString()
  }, trip._id.toString());

  return { trip, isReplay: false };
}

export async function getTripById(tripId, user) {
  const trip = await Trip.findById(tripId).lean();
  if (!trip) throw new NotFoundError("Trip not found");

  if (trip.riderId !== user.id && trip.driverId !== user.id && user.role !== "admin") {
    throw new ForbiddenError("Not authorized to view this trip");
  }

  return trip;
}

export async function updateTripStatus(tripId, nextStatus, user, extra = {}) {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError("Trip not found");

  // Only rider, assigned driver, or admin can update trip
  if (user.role === "rider") {
    if (trip.riderId !== user.id) throw new ForbiddenError("Not authorized for this trip");
    if (nextStatus !== "cancelled") throw new ForbiddenError("Riders can only cancel trips");
  } else if (user.role === "driver") {
    if (trip.driverId && trip.driverId !== user.id) {
      throw new ForbiddenError("You are not the assigned driver for this trip");
    }
  }

  validateTransition(trip.status, nextStatus);

  trip.status = nextStatus;

  if (nextStatus === "matched") {
    trip.driverId = extra.driverId || user.id;
  }

  if (nextStatus === "cancelled") {
    trip.cancelReason = extra.cancelReason || "Cancelled by user";
    trip.cancelledBy = user.role || "user";
  }

  trip.timeline.push({ status: nextStatus, actorId: user.id, timestamp: new Date() });
  await trip.save();

  await publishTripEvent(`trip.${nextStatus}`, {
    tripId: trip._id.toString(),
    riderId: trip.riderId,
    driverId: trip.driverId,
    status: nextStatus,
    timestamp: new Date().toISOString()
  }, trip._id.toString());

  return trip;
}

export async function getTripHistory(user, { page = 1, limit = 10, status = null } = {}) {
  const filter = user.role === "driver" ? { driverId: user.id } : { riderId: user.id };
  if (status) filter.status = status;

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [trips, total] = await Promise.all([
    Trip.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Trip.countDocuments(filter)
  ]);

  return {
    trips,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}
