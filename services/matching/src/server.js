import express from "express";
import helmet from "helmet";
import cors from "cors";
import { logger } from "shared";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { closeRedis } from "./config/redis.js";
import { initKafka, closeKafka, startMatchingConsumer } from "./config/kafka.js";
import { processTripRequest } from "./services/matching.js";
import healthRoutes from "./routes/health.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

app.use(healthRoutes);
app.use(errorHandler);

let server;

async function start() {
  try {
    await connectDB();
    try {
      await initKafka();
      await startMatchingConsumer(async ({ data }) => {
        if (data) {
          await processTripRequest(data);
        }
      });
      logger.info("Matching Kafka consumer started");
    } catch (err) {
      logger.warn("Kafka not available on startup", { error: err.message });
    }

    server = app.listen(env.PORT, () => {
      logger.info("matching-service started", { port: env.PORT, env: env.NODE_ENV });
    });
  } catch (err) {
    logger.error("Startup failed", { error: err.message });
    process.exit(1);
  }
}

async function stop(signal) {
  logger.info(`${signal} received, stopping matching-service`);
  if (server) {
    server.close(async () => {
      await closeKafka();
      await closeRedis();
      await disconnectDB();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));

start();

export { app, server };
