// sse-utils.js — Fracture Studio v6.0

export function startSse(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function writeSse(res, data) {
  try {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  } catch (_) {}
}

export function writeDone(res) {
  try {
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (_) {}
}
