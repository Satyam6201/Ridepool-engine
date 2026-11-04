import { logger } from "shared";

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  logger.error("Request error occurred", {
    statusCode,
    message: err.message,
    path: req.originalUrl,
    method: req.method
  });

  return res.status(statusCode).json({
    status: "error",
    message
  });
}
