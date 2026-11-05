import { logger } from "shared";

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  logger.error("Request error", {
    status,
    message: err.message,
    path: req.originalUrl,
    method: req.method
  });

  return res.status(status).json({
    status: "error",
    message
  });
}
