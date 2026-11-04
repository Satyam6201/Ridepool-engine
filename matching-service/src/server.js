import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "shared";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

app.use(healthRoutes);

app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  logger.info("matching-service started", { port: env.PORT, env: env.NODE_ENV });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing server");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, closing server");
  server.close(() => {
    process.exit(0);
  });
});
