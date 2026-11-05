import { logger } from "shared";
import { ZodError } from "zod";

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: "error",
      message: err.errors[0]?.message || "Validation error"
    });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : "Internal server error";

  if (status >= 500) {
    logger.error("Internal server error", { message: err.message, path: req.originalUrl });
  }

  res.status(status).json({
    status: "error",
    message
  });
}
