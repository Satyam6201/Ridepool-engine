import { z } from "zod";
import { saveLocation } from "../services/location.js";

export const pingSchema = z
  .object({
    lat: z.number().min(-90, "lat must be >= -90").max(90, "lat must be <= 90"),
    lng: z.number().min(-180, "lng must be >= -180").max(180, "lng must be <= 180"),
    heading: z.number().min(0, "heading must be >= 0").max(360, "heading must be <= 360").optional().default(0),
    speed: z.number().min(0).optional().default(0),
    timestamp: z.union([z.string().datetime(), z.number().int().positive()]).optional()
  })
  .strict();

export async function postLocation(req, res, next) {
  try {
    const data = pingSchema.parse(req.body);
    await saveLocation(req.user.id, data);
    res.status(202).json({ status: "accepted", message: "Location ping accepted" });
  } catch (err) {
    next(err);
  }
}
