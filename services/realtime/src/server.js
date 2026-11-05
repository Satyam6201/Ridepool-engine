import http from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.js";
import { errorHandler } from "./middleware/error.js";
import { logger } from "shared";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

app.use(healthRoutes);
app.use(errorHandler);

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  logger.info("Realtime client connected", { socketId: socket.id });

  socket.on("disconnect", () => {
    logger.info("Realtime client disconnected", { socketId: socket.id });
  });
});

httpServer.listen(env.PORT, () => {
  logger.info("realtime-service started", { port: env.PORT, env: env.NODE_ENV });
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing server");
  httpServer.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, closing server");
  httpServer.close(() => {
    process.exit(0);
  });
});

