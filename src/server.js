import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  DEFAULT_MODEL,
  OPENROUTER_ENDPOINT,
  SYSTEM_PROMPT,
  buildServiceFallbackAudit,
  buildTooThinAudit,
  collectOpenRouterContent,
  isTooThinForAudit,
  prepareAuditFromModelText
} from "./audit-utils.js";
import { listAdminUsers } from "./admin-users.js";
import { verifySources } from "./source-verify.js";
import { getPublicAuthConfig } from "./public-config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(__dirname, "../public");

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

const PROGRESS_MESSAGES = [
  "Preparing the audit",
  "Checking your claims",
  "Finding the thesis",
  "Mapping evidence to claims",
  "Testing warrant strength",
  "Scanning for unsupported facts",
  "Cross-checking source language",
  "Looking for hidden assumptions",
  "Checking causation links",
  "Finding the collapse point",
  "Building counterarguments",
  "Stress-testing the logic",
  "Reviewing academic tone",
  "Scoring argument strength",
  "Scoring evidence quality",
  "Scoring rhetorical control",
  "Prioritizing revision moves",
  "Writing concrete fixes",
  "Validating the report",
  "Preparing your Fracture report"
];

function sseHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}

function writeDelta(res, content) {
  if (!content) return;
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
}

function writeProgress(res, progress, message) {
  res.write(`data: ${JSON.stringify({ fracture_progress: { progress, message } })}\n\n`);
}

function writeAuditObject(res, audit) {
  res.write(`data: ${JSON.stringify({ fracture_audit: audit })}\n\n`);
}

function streamAuditJson(res, audit) {
  const text = JSON.stringify(audit, null, 2);
  for (let i = 0; i < text.length; i += 700) {
    writeDelta(res, text.slice(i, i + 700));
  }
}

function finish(res, audit) {
  writeProgress(res, 96, "Formatting the report");
  writeAuditObject(res, audit);
  streamAuditJson(res, audit);
  writeProgress(res, 100, "Report ready");
  res.write("data: [DONE]\n\n");
  res.end();
}

function nextProgressFromLength(length) {
  const step = Math.min(PROGRESS_MESSAGES.length - 1, Math.floor(length / 500));
  const progress = Math.min(74, 22 + step * 3);
  return {
    progress,
    message: PROGRESS_MESSAGES[step + 2] || "Reading the model report"
  };
}

function buildPreferenceMessage(preferences) {
  if (!preferences || typeof preferences !== "object") return null;
  const depth = String(preferences.feedbackDepth || "balanced").slice(0, 30);
  const tone = String(preferences.feedbackTone || "direct").slice(0, 30);
  const citationStyle = String(preferences.citationStyle || "mla").slice(0, 30);
  return [
    "Use these user preferences while preserving the required JSON schema.",
    `Feedback depth: ${depth}.`,
    `Feedback tone: ${tone}.`,
    `Citation style preference for citation-related guidance: ${citationStyle}.`
  ].join(" ");
}

app.use(express.json({ limit: "256kb" }));

// Serve static files from public/. The /studio alias keeps relative CSS/JS
// working when studio.html is served from /studio/case.
app.use(express.static(PUBLIC_DIR));
app.use("/studio", express.static(PUBLIC_DIR));

app.post("/api/analyze", async (req, res) => {
  const { essay } = req.body;
  const preferenceMessage = buildPreferenceMessage(req.body?.preferences);
  if (!essay || typeof essay !== "string" || essay.trim().length === 0) {
    return res.status(400).json({ error: "No essay provided." });
  }

  const trimmedEssay = essay.trim();
  if (trimmedEssay.length > 40000) {
    return res.status(400).json({ error: "Essay exceeds maximum length (40,000 characters)." });
  }

  sseHeaders(res);
  writeProgress(res, 4, PROGRESS_MESSAGES[0]);

  if (isTooThinForAudit(trimmedEssay)) {
    writeProgress(res, 38, "Checking for a complete argument");
    return finish(res, buildTooThinAudit(trimmedEssay));
  }

  if (!OPENROUTER_API_KEY) {
    return finish(res, buildServiceFallbackAudit(trimmedEssay, "OPENROUTER_API_KEY is not configured"));
  }

  let upstreamRes;
  try {
    writeProgress(res, 10, "Connecting to Fracture AI");
    upstreamRes = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "http://localhost:3000",
        "X-Title": "Fracture Studio",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(preferenceMessage ? [{ role: "system", content: preferenceMessage }] : []),
          { role: "user", content: trimmedEssay }
        ]
      })
    });
  } catch (err) {
    return finish(res, buildServiceFallbackAudit(trimmedEssay, `Failed to reach OpenRouter: ${err?.message || String(err)}`));
  }

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return finish(res, buildServiceFallbackAudit(trimmedEssay, `OpenRouter returned ${upstreamRes.status}: ${text.slice(0, 240)}`));
  }

  writeProgress(res, 18, "Reading the model report");
  let lastProgress = 18;
  let rawText = "";
  try {
    rawText = await collectOpenRouterContent(upstreamRes, (_delta, length) => {
      const next = nextProgressFromLength(length);
      if (next.progress > lastProgress + 4) {
        lastProgress = next.progress;
        writeProgress(res, next.progress, next.message);
      }
    });
  } catch (err) {
    return finish(res, buildServiceFallbackAudit(trimmedEssay, `The model stream ended unexpectedly: ${err?.message || String(err)}`));
  }

  writeProgress(res, 82, "Validating the report structure");
  const { audit, recovered } = prepareAuditFromModelText(rawText, trimmedEssay);
  writeProgress(res, recovered ? 90 : 88, recovered ? "Repairing a malformed model response" : "Report structure verified");
  return finish(res, audit);
});

app.post("/api/verify-sources", async (req, res) => {
  const essay = typeof req.body?.essay === "string" ? req.body.essay.trim() : "";
  const audit = req.body?.audit && typeof req.body.audit === "object" ? req.body.audit : null;

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
});

app.post("/api/admin-users", async (req, res) => {
  const result = await listAdminUsers(req.body?.password);
  return res.status(result.status).json(result.body);
});

app.get("/api/public-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(getPublicAuthConfig());
});

app.get(["/studio", "/studio/case", "/analyze"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "studio.html"));
});

app.get(["/mission"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "mission.html"));
});

app.get(["/blog"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "blog.html"));
});

app.get(["/settings", "/login"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "settings.html"));
});

app.get(["/auth/callback"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "auth-callback.html"));
});

app.get(["/admin"], (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, "admin.html"));
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`\nFracture Studio running at http://localhost:${PORT}\n`);
});
