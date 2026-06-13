import {
  DEFAULT_MODEL,
  buildServiceFallbackAudit,
  buildTooThinAudit,
  isTooThinForAudit,
  prepareAuditFromModelText
} from "./audit-utils.js";
import { buildAuditMessages } from "./prompts.js";
import { collectTextFromOpenRouter, openRouterStream } from "./openrouter.js";
import { startSse, writeDone, writeSse } from "./sse-utils.js";

const PROGRESS_MESSAGES = [
  "Preparing the audit",
  "Checking your claims",
  "Finding the thesis",
  "Mapping evidence to claims",
  "Testing warrant strength",
  "Separating logic from source verification",
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

function writeProgress(res, progress, message) {
  writeSse(res, { fracture_progress: { progress, message } });
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function scoreLabel(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "Not scored yet";
  if (score >= 90) return "Strong and resilient";
  if (score >= 75) return "Strong with fixable pressure points";
  if (score >= 60) return "Usable but vulnerable";
  if (score >= 40) return "Major revision needed";
  if (score >= 11) return "Argument collapses under pressure";
  return "Not enough argument to evaluate";
}

function compact(value, max = 520) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function readableAuditSections(audit) {
  const parsed = audit && typeof audit === "object" ? audit : {};
  const scores = parsed.score_breakdown || {};
  const thesis = (parsed.argument_strength || {}).thesis || {};
  const collapse = parsed.collapse_point || {};
  const fixes = asArray(parsed.priority_fixes).slice(0, 5);
  const attacks = asArray(parsed.attack_tree).slice(0, 4);
  const claims = asArray((parsed.argument_strength || {}).claims).slice(0, 4);

  const sections = [
    {
      title: "Verdict",
      body: [
        typeof parsed.overall_score === "number" ? `Overall score: ${parsed.overall_score}/100 — ${scoreLabel(parsed.overall_score)}.` : scoreLabel(parsed.overall_score) + ".",
        firstText(parsed.verdict, "Fracture found the main pressure points and built a revision path.")
      ].filter(Boolean).join("\n")
    },
    {
      title: "Score breakdown",
      body: [
        `Argument strength: ${scores.argument_strength ?? "—"}/25`,
        `Assumption safety: ${scores.assumption_audit ?? "—"}/25`,
        `Logic: ${scores.logic ?? "—"}/25`,
        `Rhetoric: ${scores.rhetoric ?? "—"}/25`
      ].join("\n")
    },
    {
      title: "Thesis check",
      body: [
        firstText(thesis.quote, "No clear thesis was detected."),
        firstText(thesis.assessment, "The thesis needs to make a clear claim that the rest of the argument can prove.")
      ].filter(Boolean).join("\n")
    }
  ];

  fixes.forEach((fix, index) => {
    sections.push({
      title: `Priority fix ${index + 1}`,
      body: [
        firstText(fix.problem, "Repair this pressure point."),
        fix.quote ? `Text: ${compact(fix.quote)}` : "",
        firstText(fix.why_it_matters) ? `Why it matters: ${compact(fix.why_it_matters)}` : "",
        firstText(fix.exact_fix) ? `Exact fix: ${compact(fix.exact_fix)}` : "",
        firstText(fix.rewrite) ? `Possible rewrite: ${compact(fix.rewrite)}` : ""
      ].filter(Boolean).join("\n")
    });
  });

  sections.push({
    title: "Collapse point",
    body: [
      firstText(collapse.quote, "No single collapse point was isolated."),
      firstText(collapse.why_it_collapses) ? `Why it collapses: ${compact(collapse.why_it_collapses)}` : "",
      firstText(collapse.strongest_attack, collapse.opponent_attack) ? `Opponent attack: ${compact(firstText(collapse.strongest_attack, collapse.opponent_attack))}` : "",
      firstText(collapse.strongest_defense, collapse.reinforcement) ? `Best repair: ${compact(firstText(collapse.strongest_defense, collapse.reinforcement))}` : ""
    ].filter(Boolean).join("\n")
  });

  if (claims.length) {
    sections.push({
      title: "Key claims",
      body: claims.map((claim, index) => {
        return [
          `${index + 1}. ${compact(firstText(claim.quote, "Claim"), 360)}`,
          firstText(claim.rating) ? `Rating: ${claim.rating}` : "",
          firstText(claim.diagnosis) ? `Diagnosis: ${compact(claim.diagnosis)}` : "",
          firstText(claim.fix) ? `Repair: ${compact(claim.fix)}` : ""
        ].filter(Boolean).join(" — ");
      }).join("\n")
    });
  }

  if (attacks.length) {
    sections.push({
      title: "Opponent pressure",
      body: attacks.map((attack, index) => {
        return [
          `${index + 1}. ${compact(firstText(attack.attack, attack.why_dangerous, "Opponent attack"), 360)}`,
          firstText(attack.response) ? `Response: ${compact(attack.response)}` : "",
          firstText(attack.crossfire_question) ? `Question: ${compact(attack.crossfire_question)}` : ""
        ].filter(Boolean).join(" — ");
      }).join("\n")
    });
  }

  sections.push({
    title: "Revision path",
    body: fixes.length
      ? fixes.slice(0, 4).map((fix, index) => `${index + 1}. ${compact(firstText(fix.exact_fix, fix.problem, "Repair this issue."), 520)}`).join("\n")
      : "Start by clarifying the thesis, then add one direct warrant and one credible source for the main claim."
  });

  return sections.filter((section) => firstText(section.body));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamReadableAudit(res, audit) {
  writeSse(res, { fracture_report_start: true });
  const sections = readableAuditSections(audit);
  for (const section of sections) {
    writeSse(res, { fracture_report_delta: { title: section.title, body: section.body } });
    await sleep(18);
  }
  writeSse(res, { fracture_report_done: true });
}

async function finish(res, audit, recovered = false) {
  writeProgress(res, recovered ? 91 : 90, recovered ? "Recovered a stable report" : "Turning JSON into the readable report");
  await streamReadableAudit(res, audit);
  writeProgress(res, recovered ? 94 : 96, recovered ? "Recovered a stable report" : "Formatting the final interface");
  writeSse(res, { fracture_audit: audit });
  writeSse(res, { fracture_normalized_json: JSON.stringify(audit, null, 2) });
  writeProgress(res, 100, "Report ready");
  writeDone(res);
}

function nextProgressFromLength(length) {
  const step = Math.min(PROGRESS_MESSAGES.length - 1, Math.floor(length / 450));
  return {
    progress: Math.min(80, 20 + step * 3),
    message: PROGRESS_MESSAGES[step + 2] || "Reading the model report"
  };
}

export async function handleAnalyze(req, res) {
  if (req.method && req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const essay = typeof req.body?.essay === "string" ? req.body.essay.trim() : "";
  if (!essay) return res.status(400).json({ error: "Paste an argument before using Fracture." });
  if (essay.length > 40000) return res.status(400).json({ error: "Draft exceeds the 40,000 character limit." });

  startSse(res);
  writeProgress(res, 4, PROGRESS_MESSAGES[0]);

  if (isTooThinForAudit(essay)) {
    writeProgress(res, 38, "Checking for a complete argument");
    return await finish(res, buildTooThinAudit(essay));
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return await finish(res, buildServiceFallbackAudit(essay, "OPENROUTER_API_KEY is not configured"), true);
  }

  let upstream;
  try {
    writeProgress(res, 10, "Connecting to Fracture AI");
    upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: buildAuditMessages(essay, req.body?.preferences),
      referer: "https://fracturestudio.vercel.app"
    });
  } catch (err) {
    return await finish(res, buildServiceFallbackAudit(essay, `Failed to reach OpenRouter: ${err?.message || String(err)}`), true);
  }

  writeProgress(res, 18, "Reading the live model stream");
  let rawText = "";
  let lastProgress = 18;
  try {
    rawText = await collectTextFromOpenRouter(upstream, (delta, length) => {
      writeSse(res, { fracture_model_delta: delta });
      const next = nextProgressFromLength(length);
      if (next.progress >= lastProgress + 4) {
        lastProgress = next.progress;
        writeProgress(res, next.progress, next.message);
      }
    });
  } catch (err) {
    return await finish(res, buildServiceFallbackAudit(essay, err?.message || String(err)), true);
  }

  writeProgress(res, 86, "Validating the report structure");
  const { audit, recovered } = prepareAuditFromModelText(rawText, essay);
  writeProgress(res, recovered ? 91 : 90, recovered ? "Repairing a malformed model response" : "Report structure verified");
  return await finish(res, audit, recovered);
}
