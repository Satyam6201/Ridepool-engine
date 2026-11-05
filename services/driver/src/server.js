import express from "express";
import helmet from "helmet";
import cors from "cors";
import { logger } from "shared";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { closeRedis } from "./config/redis.js";
import { initKafka, disconnectKafka } from "./config/kafka.js";
import { startLocationConsumer } from "./services/consumer.js";
import { startStaleDriverCleanup, stopStaleDriverCleanup } from "./services/cleanup.js";
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

async function bootstrap() {
  try {
    await connectDB();
    await initKafka();
    await startLocationConsumer();
    startStaleDriverCleanup();

    server = app.listen(env.PORT, () => {
      logger.info("driver-service started successfully", {
        port: env.PORT,
        env: env.NODE_ENV
      });
    });
  } catch (err) {
    logger.error("Failed to start driver-service", { error: err.message });
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} received, gracefully shutting down driver-service`);
  stopStaleDriverCleanup();

  if (server) {
    server.close(async () => {
      await disconnectKafka();
      await closeRedis();
      await disconnectDB();
      logger.info("driver-service terminated gracefully");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

bootstrap();
