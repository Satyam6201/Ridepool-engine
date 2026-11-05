import dotenv from "dotenv";
import { z } from "zod";
import { validateEnv } from "shared";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().default(3002),
  CORS_ORIGIN: z.string().default("http://localhost"),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  KAFKA_BROKERS: z.string().min(1, "KAFKA_BROKERS is required"),
  JWT_ACCESS_SECRET: z.string().min(8, "JWT_ACCESS_SECRET must be at least 8 characters")
});

export const env = validateEnv(envSchema);
