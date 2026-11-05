import { z } from "zod";
import {
  getDriverProfile,
  upsertDriverProfile,
  updateDriverStatus,
  findNearbyDrivers
} from "../services/driver.js";

const vehicleSchema = z
  .object({
    make: z.string().trim().min(1, "Vehicle make is required"),
    model: z.string().trim().min(1, "Vehicle model is required"),
    year: z.number().int().min(2000).max(new Date().getFullYear() + 1),
    color: z.string().trim().min(1, "Vehicle color is required"),
    plate: z.string().trim().min(2, "Plate number is required"),
    capacity: z.number().int().min(1).max(8).default(4)
  })
  .strict();

const profileSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    phone: z.string().trim().min(8, "Phone must be at least 8 characters"),
    licenseNumber: z.string().trim().min(5, "License number must be at least 5 characters"),
    vehicle: vehicleSchema
  })
  .strict();

const statusSchema = z
  .object({
    status: z.enum(["offline", "available", "on_trip"], {
      errorMap: () => ({ message: "Status must be offline, available, or on_trip" })
    })
  })
  .strict();

const nearbyQuerySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    radiusKm: z.coerce.number().positive().max(50).default(5),
    limit: z.coerce.number().int().positive().max(50).default(10)
  })
  .strict();

export async function getProfile(req, res, next) {
  try {
    const profile = await getDriverProfile(req.user.id);
    return res.json({ status: "success", data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const validated = profileSchema.parse(req.body);
    const profile = await upsertDriverProfile(req.user.id, validated);
    return res.json({ status: "success", data: profile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        status: "error",
        message: err.errors[0]?.message || "Validation failed"
      });
    }
    next(err);
  }
}

export async function patchStatus(req, res, next) {
  try {
    const { status } = statusSchema.parse(req.body);
    const updated = await updateDriverStatus(req.user.id, status);
    return res.json({ status: "success", data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        status: "error",
        message: err.errors[0]?.message || "Validation failed"
      });
    }
    next(err);
  }
}

export async function getNearby(req, res, next) {
  try {
    const { lng, lat, radiusKm, limit } = nearbyQuerySchema.parse(req.query);
    const drivers = await findNearbyDrivers(lng, lat, radiusKm, limit);
    return res.json({ status: "success", data: drivers });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        status: "error",
        message: err.errors[0]?.message || "Validation failed"
      });
    }
    next(err);
  }
}
