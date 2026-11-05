import mongoose from "mongoose";
import { logger } from "shared";
import { env } from "./env.js";

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error("MongoDB connection failed", { error: err.message });
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
