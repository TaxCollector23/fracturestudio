import { verifySources } from "../src/source-verify.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
  }

  const essay = typeof body?.essay === "string" ? body.essay.trim() : "";
  const audit = body?.audit && typeof body.audit === "object" ? body.audit : null;

  if (!essay && !audit) {
    return res.status(400).json({ error: "Provide essay text or an audit object to verify." });
  }
  if (essay.length > 40000) {
    return res.status(400).json({ error: "Essay exceeds maximum length (40,000 characters)." });
  }

  try {
    const verification = await verifySources({ essay, audit });
    return res.status(200).json(verification);
  } catch (err) {
    return res.status(200).json({
      claims: [],
      works_cited: [],
      summary: {
        total_claims: 0,
        supported: 0,
        partially_supported: 0,
        unsupported: 0,
        contradicted: 0,
        source_not_found: 0,
        source_too_vague: 0,
        needs_review: 1,
        note: `Source verification failed gracefully: ${err?.message || String(err)}`
      }
    });
  }
}
