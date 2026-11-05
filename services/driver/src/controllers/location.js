import { z } from "zod";
import { validateAndPublishLocation } from "../services/location.js";

export const locationPingSchema = z
  .object({
    lat: z
      .number({ required_error: "lat is required" })
      .min(-90, "lat must be >= -90")
      .max(90, "lat must be <= 90"),
    lng: z
      .number({ required_error: "lng is required" })
      .min(-180, "lng must be >= -180")
      .max(180, "lng must be <= 180"),
    heading: z
      .number()
      .min(0, "heading must be >= 0")
      .max(360, "heading must be <= 360")
      .optional()
      .default(0),
    speed: z
      .number()
      .min(0, "speed must be non-negative")
      .optional()
      .default(0),
    timestamp: z
      .union([
        z.string().datetime({ message: "timestamp must be valid ISO-8601 string" }),
        z.number().int().positive()
      ])
      .optional()
  })
  .strict();

export async function postLocation(req, res, next) {
  try {
    const validated = locationPingSchema.parse(req.body);
    const driverId = req.user.id;

    await validateAndPublishLocation(driverId, validated);

    return res.status(202).json({
      status: "accepted",
      message: "Location ping accepted"
    });
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
