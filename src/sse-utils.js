export function startSse(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.socket && typeof res.socket.setTimeout === "function") res.socket.setTimeout(0);
  if (typeof res.flushHeaders === "function") res.flushHeaders();
}

export function writeSse(res, payload) {
  if (res.writableEnded || res.destroyed) return false;
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  return true;
}

export function writeDone(res) {
  if (res.writableEnded || res.destroyed) return;
  res.write("data: [DONE]\n\n");
  res.end();
}
