import { z } from "zod";
import {
  createTrip,
  getTripById,
  updateTripStatus,
  getTripHistory
} from "../services/trip.js";

const coordinateSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().trim().optional().default("")
  })
  .strict();

export const createTripSchema = z
  .object({
    pickup: coordinateSchema,
    drop: coordinateSchema
  })
  .strict();

const statusUpdateSchema = z
  .object({
    status: z.enum([
      "requested",
      "matching",
      "matched",
      "driver_arrived",
      "started",
      "completed",
      "cancelled"
    ]),
    driverId: z.string().optional(),
    cancelReason: z.string().trim().optional()
  })
  .strict();

const historyQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
    status: z
      .enum([
        "requested",
        "matching",
        "matched",
        "driver_arrived",
        "started",
        "completed",
        "cancelled"
      ])
      .optional()
  })
  .strict();

export async function postTrip(req, res, next) {
  try {
    const data = createTripSchema.parse(req.body);
    const idempotencyKey =
      req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || null;

    const { trip, isReplay } = await createTrip(req.user.id, data, idempotencyKey);
    const statusCode = isReplay ? 200 : 201;

    res.status(statusCode).json({ status: "success", data: trip, isReplay });
  } catch (err) {
    next(err);
  }
}

export async function getTrip(req, res, next) {
  try {
    const trip = await getTripById(req.params.id, req.user);
    res.json({ status: "success", data: trip });
  } catch (err) {
    next(err);
  }
}

export async function patchStatus(req, res, next) {
  try {
    const body = statusUpdateSchema.parse(req.body);
    const trip = await updateTripStatus(req.params.id, body.status, req.user, body);
    res.json({ status: "success", data: trip });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const query = historyQuerySchema.parse(req.query);
    const result = await getTripHistory(req.user, query);
    res.json({ status: "success", data: result });
  } catch (err) {
    next(err);
  }
}
