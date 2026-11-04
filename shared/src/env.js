import { log } from "./logger.js";

export function loadEnv(schema, source = process.env) {
  const res = schema.safeParse(source);
  if (!res.success) {
    const issues = res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    log.error(`Invalid env: ${issues.join(", ")}`);
    process.exit(1);
  }
  return res.data;
}
