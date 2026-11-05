import { z } from "zod";
import {
  getProfile as fetchProfile,
  saveProfile,
  updateStatus,
  findNearby
} from "../services/driver.js";

const profileSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    phone: z.string().trim().min(8, "Phone must be at least 8 characters"),
    licenseNumber: z.string().trim().min(5, "License number must be at least 5 characters"),
    vehicle: z
      .object({
        make: z.string().trim().min(1),
        model: z.string().trim().min(1),
        year: z.number().int().min(2000).max(new Date().getFullYear() + 1),
        color: z.string().trim().min(1),
        plate: z.string().trim().min(2),
        capacity: z.number().int().min(1).max(8).default(4)
      })
      .strict()
  })
  .strict();

const statusSchema = z
  .object({
    status: z.enum(["offline", "available", "on_trip"], {
      errorMap: () => ({ message: "Status must be offline, available, or on_trip" })
    })
  })
  .strict();

const nearbySchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
    radiusKm: z.coerce.number().positive().max(50).default(5),
    limit: z.coerce.number().int().positive().max(50).default(10)
  })
  .strict();

export async function getProfile(req, res, next) {
  try {
    const profile = await fetchProfile(req.user.id);
    res.json({ status: "success", data: profile });
  } catch (err) {
    next(err);
  }
}

export async function putProfile(req, res, next) {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await saveProfile(req.user.id, data);
    res.json({ status: "success", data: profile });
  } catch (err) {
    next(err);
  }
}

export async function patchStatus(req, res, next) {
  try {
    const { status } = statusSchema.parse(req.body);
    const updated = await updateStatus(req.user.id, status);
    res.json({ status: "success", data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getNearby(req, res, next) {
  try {
    const { lng, lat, radiusKm, limit } = nearbySchema.parse(req.query);
    const drivers = await findNearby(lng, lat, radiusKm, limit);
    res.json({ status: "success", data: drivers });
  } catch (err) {
    next(err);
  }
}
