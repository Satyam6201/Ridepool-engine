import express from "express";
import helmet from "helmet";
import cors from "cors";
import { logger } from "shared";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { closeRedis } from "./config/redis.js";
import { initKafka, closeKafka } from "./config/kafka.js";
import { runLocationConsumer } from "./services/consumer.js";
import { startStaleCleanup, stopStaleCleanup } from "./services/cleanup.js";
import healthRoutes from "./routes/health.js";
import driverRoutes from "./routes/driver.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

app.use(healthRoutes);
app.use(driverRoutes);
app.use(errorHandler);

let server;

async function start() {
  try {
    await connectDB();
    await initKafka();
    await runLocationConsumer();
    startStaleCleanup();

    server = app.listen(env.PORT, () => {
      logger.info("driver-service started", { port: env.PORT, env: env.NODE_ENV });
    });
  } catch (err) {
    logger.error("Startup failed", { error: err.message });
    process.exit(1);
  }
}

async function stop(signal) {
  logger.info(`${signal} received, stopping`);
  stopStaleCleanup();

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
