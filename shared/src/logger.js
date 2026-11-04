const SENSITIVE_FIELDS = ["password", "token", "refreshToken", "authorization", "secret"];

function sanitize(data) {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function formatOutput(level, message, meta = {}) {
  const sanitizedMeta = sanitize(meta);
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedMeta
  });
}

export const logger = {
  info: (message, meta) => {
    console.log(formatOutput("info", message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatOutput("warn", message, meta));
  },
  error: (message, meta) => {
    console.error(formatOutput("error", message, meta));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatOutput("debug", message, meta));
    }
  }
};
