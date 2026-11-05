import { logger } from "shared";
import { env } from "../config/env.js";

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = Boolean(err.isOperational);
  const message = isOperational ? err.message : "Internal server error";

  logger.error("Request error", {
    statusCode,
    message: err.message,
    path: req.originalUrl,
    method: req.method
  });

  const response = {
    status: "error",
    message
  };

  if (env.NODE_ENV !== "production" && !isOperational) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}
