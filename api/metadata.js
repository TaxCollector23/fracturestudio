import { extractSourceMetadata } from "../src/metadata.js";
import { parseJsonBody, sendOptions } from "../src/request-utils.js";

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  let body;
  try {
    body = parseJsonBody(req.body);
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ error: err?.message || "Invalid request." });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return res.status(400).json({ error: "Provide a URL to extract metadata from." });

  const result = await extractSourceMetadata(url);
  return res.status(result.status === "ok" ? 200 : 422).json(result);
}
