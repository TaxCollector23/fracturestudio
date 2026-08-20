export function parseJsonBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body !== "string" || !body.trim()) return {};

  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    const error = new Error("Invalid JSON body.");
    error.statusCode = 400;
    throw error;
  }
}

export function ensureParsedBody(req) {
  req.body = parseJsonBody(req.body);
  return req;
}

export function sendOptions(res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(204).end();
}
