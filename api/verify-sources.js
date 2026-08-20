import { verifySources } from "../src/source-verify.js";
import { LIMITS, parseJsonBody, sendOptions } from "../src/request-utils.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendOptions(res);
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  let body;
  try {
    body = parseJsonBody(req.body);
  } catch (err) {
    return res.status(err?.statusCode || 400).json({ error: err?.message || "Invalid request." });
  }

  const essay = typeof body?.essay === "string" ? body.essay.trim() : "";
  const audit = body?.audit && typeof body.audit === "object" ? body.audit : null;
  const citationStyle = body?.citation_style === "apa" ? "apa" : "mla";

  if (!essay && !audit) {
    return res.status(400).json({ error: "Provide draft text or a Fracture report to verify." });
  }
  if (essay.length > LIMITS.verifySourcesCharacters) {
    return res.status(400).json({ error: `Draft exceeds the ${LIMITS.verifySourcesCharacters.toLocaleString()} character limit.` });
  }

  try {
    const verification = await verifySources({ essay, audit, citationStyle });
    return res.status(200).json(verification);
  } catch (err) {
    return res.status(503).json({
      error: `Source verification could not complete: ${err?.message || String(err)}`
    });
  }
}
