import {
  DEFAULT_MODEL,
  OPENROUTER_ENDPOINT,
  SYSTEM_PROMPT,
  buildServiceFallbackAudit,
  buildTooThinAudit,
  collectOpenRouterContent,
  isTooThinForAudit,
  prepareAuditFromModelText
} from "../src/audit-utils.js";

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

export const config = { maxDuration: 300 };

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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const essay = typeof req.body?.essay === "string" ? req.body.essay.trim() : "";
  const preferenceMessage = buildPreferenceMessage(req.body?.preferences);
  if (!essay) return res.status(400).json({ error: "No essay provided." });
  if (essay.length > 40000) return res.status(400).json({ error: "Essay exceeds maximum length (40,000 characters)." });

  sseHeaders(res);
  writeProgress(res, 4, PROGRESS_MESSAGES[0]);

  if (isTooThinForAudit(essay)) {
    writeProgress(res, 38, "Checking for a complete argument");
    return finish(res, buildTooThinAudit(essay));
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return finish(res, buildServiceFallbackAudit(essay, "OPENROUTER_API_KEY is not configured"));
  }

  let upstreamRes;
  try {
    writeProgress(res, 10, "Connecting to Fracture AI");
    upstreamRes = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.SITE_URL || "https://fracturestudio.vercel.app",
        "X-Title": "Fracture Studio",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(preferenceMessage ? [{ role: "system", content: preferenceMessage }] : []),
          { role: "user", content: essay }
        ]
      })
    });
  } catch (err) {
    return finish(res, buildServiceFallbackAudit(essay, `Failed to reach OpenRouter: ${err?.message || String(err)}`));
  }

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return finish(res, buildServiceFallbackAudit(essay, `OpenRouter returned ${upstreamRes.status}: ${text.slice(0, 240)}`));
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
    return finish(res, buildServiceFallbackAudit(essay, `The model stream ended unexpectedly: ${err?.message || String(err)}`));
  }

  writeProgress(res, 82, "Validating the report structure");
  const { audit, recovered } = prepareAuditFromModelText(rawText, essay);
  writeProgress(res, recovered ? 90 : 88, recovered ? "Repairing a malformed model response" : "Report structure verified");
  return finish(res, audit);
}
