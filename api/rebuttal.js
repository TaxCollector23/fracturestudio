import { handleTextStream } from "../src/text-stream-handler.js";
import { ensureParsedBody, sendOptions } from "../src/request-utils.js";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  try {
    return handleTextStream(ensureParsedBody(req), res, "rebuttal");
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ error: err?.message || "Invalid request." });
  }
}
