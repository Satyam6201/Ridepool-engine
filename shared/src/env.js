import { logger } from "./logger.js";

export function validateEnv(schema, envData = process.env) {
  const result = schema.safeParse(envData);

  if (!result.success) {
    const errorDetails = result.error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message
    }));

    logger.error("Environment validation failed on startup", {
      errors: errorDetails
    });

    process.exit(1);
  }

  return result.data;
}
