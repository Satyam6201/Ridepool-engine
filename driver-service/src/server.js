import express from "express";
import helmet from "helmet";
import cors from "cors";
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

const server = app.listen(env.PORT, () => {
  log.info(`driver-service started on port ${env.PORT}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
