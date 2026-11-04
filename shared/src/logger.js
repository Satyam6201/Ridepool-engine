const HIDE = ["password", "token", "refreshtoken", "authorization", "secret"];

function mask(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(mask);

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = HIDE.includes(k.toLowerCase()) ? "[HIDDEN]" : mask(v);
  }
  return clean;
}

function write(level, msg, extra) {
  const payload = {
    time: new Date().toISOString(),
    level,
    msg,
    ...(extra ? { extra: mask(extra) } : {})
  };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(JSON.stringify(payload));
}

export const log = {
  info: (msg, extra) => write("info", msg, extra),
  warn: (msg, extra) => write("warn", msg, extra),
  error: (msg, extra) => write("error", msg, extra),
  debug: (msg, extra) => {
    if (process.env.NODE_ENV !== "production") write("debug", msg, extra);
  }
};
