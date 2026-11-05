import express from "express";
import helmet from "helmet";
import cors from "cors";
import { logger } from "shared";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

app.use(healthRoutes);
app.use(authRoutes);
app.use("/api/auth", authRoutes);

app.use(errorHandler);

await connectDB();

const server = app.listen(env.PORT, () => {
  logger.info("auth service started", { port: env.PORT, env: env.NODE_ENV });
});

async function shutdown() {
  logger.info("Closing auth service");
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app, server };
