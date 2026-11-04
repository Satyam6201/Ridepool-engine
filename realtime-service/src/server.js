import http from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import healthRoute from "./routes/health.js";
import { errorHandler } from "./middleware/error.js";
import { log } from "shared";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "10kb" }));

app.use(healthRoute);
app.use(errorHandler);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.CORS_ORIGIN, methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  log.info(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => log.info(`Client disconnected: ${socket.id}`));
});

server.listen(env.PORT, () => {
  log.info(`realtime-service started on port ${env.PORT}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
