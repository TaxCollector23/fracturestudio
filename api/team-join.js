import { joinTeamByCode } from "../src/team-join.js";
import { parseJsonBody, sendOptions } from "../src/request-utils.js";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  let body;
  try {
    body = parseJsonBody(req.body);
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ error: err?.message || "Invalid request." });
  }

  const result = await joinTeamByCode({ headers: req.headers, body });
  return res.status(result.status).json(result.body);
}
