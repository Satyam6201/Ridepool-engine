import mongoose from "mongoose";
import { logger } from "shared";
import { env } from "./env.js";

export async function connectDB() {
  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
  });
  logger.info("Connected to MongoDB for trip-service");
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
