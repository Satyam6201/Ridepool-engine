import dotenv from "dotenv";
import { z } from "zod";
import { validateEnv } from "shared";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().default(3006),
  CORS_ORIGIN: z.string().default("http://localhost"),
  REDIS_URL: z.string().min(1),
  KAFKA_BROKERS: z.string().min(1)
});

export const env = validateEnv(envSchema);
