// Shared request handling helpers used by both the Express dev server and the
// Vercel serverless adapters (api/*.js). Keeps limits and error shapes in one
// place so every endpoint speaks the same API contract.

export const LIMITS = {
  analyzeCharacters: 40000,
  chatCharacters: 6000,
  rebuttalCharacters: 40000,
  verifySourcesCharacters: 40000
};

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

/** Consistent JSON error shape: `{ error: string }`. */
export function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}
