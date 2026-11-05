import crypto from "node:crypto";
import { publishEvent } from "../config/kafka.js";

export async function publishUserRegistered(user) {
  const event = {
    eventId: crypto.randomUUID(),
    eventType: "user.registered",
    timestamp: new Date().toISOString(),
    data: {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone || ""
    }
  };

  await publishEvent("user.registered", event);
}
