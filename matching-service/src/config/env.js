import dotenv from "dotenv";
import { z } from "zod";
import { loadEnv } from "shared";

dotenv.config();

export const env = loadEnv(
  z.object({
    NODE_ENV: z.string().default("production"),
    PORT: z.coerce.number().default(3004),
    CORS_ORIGIN: z.string().default("http://localhost"),
    MONGO_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
    KAFKA_BROKERS: z.string().min(1)
  })
);
