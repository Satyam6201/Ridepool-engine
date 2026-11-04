import { log } from "shared";

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.isPublic ? err.message : "Internal error";

  log.error(`${req.method} ${req.originalUrl} failed: ${err.message}`);
  res.status(status).json({ status: "error", message });
}
