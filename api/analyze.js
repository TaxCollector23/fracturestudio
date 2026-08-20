import { handleAnalyze } from "../src/analyze-handler.js";
import { ensureParsedBody, sendOptions } from "../src/request-utils.js";

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  try {
    return handleAnalyze(ensureParsedBody(req), res);
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ error: err?.message || "Invalid request." });
  }
}
