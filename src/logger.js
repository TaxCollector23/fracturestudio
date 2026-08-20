// Minimal structured logging for the Fracture backend.
//
// Logs are single-line JSON so they are easy to grep and index in production.
// Never log request bodies, tokens, passwords, or other sensitive content —
// these helpers only ever receive already-redacted values.

function emit(level, event, fields = {}) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    event,
    ...fields
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** One line per HTTP request: method, path, status, duration, client hint. */
export function logRequest(req, res, next) {
  const startedAt = Date.now();
  res.on("finish", () => {
    emit("info", "http.request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - startedAt
    });
  });
  next();
}

export function logInfo(event, fields = {}) {
  emit("info", event, fields);
}

export function logWarn(event, fields = {}) {
  emit("warn", event, fields);
}

export function logError(event, error, fields = {}) {
  emit("error", event, {
    message: error?.message || String(error || "unknown error"),
    stack: error?.stack ? String(error.stack).split("\n").slice(0, 4).join(" | ") : undefined,
    ...fields
  });
}
