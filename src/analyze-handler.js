import {
  DEFAULT_MODEL,
  buildServiceFallbackAudit,
  buildTooThinAudit,
  isTooThinForAudit,
  prepareAuditFromModelText
} from "./audit-utils.js";
import { buildAuditMessages } from "./prompts.js";
import { collectTextFromOpenRouter, openRouterStream } from "./openrouter.js";
import { verifySources } from "./source-verify.js";
import { startSse, writeDone, writeSse } from "./sse-utils.js";

function asArr(value) { return Array.isArray(value) ? value : []; }
function firstNonEmpty(...values) {
  for (const v of values) { if (typeof v === "string" && v.trim()) return v.trim(); }
  return "";
}
function clip(value, max = 360) {
  const t = String(value || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function sourceStatusLabel(status) {
  const s = String(status || "needs_review").toLowerCase();
  return {
    likely_supported: "likely supported",
    partial_match: "partial match",
    possible_conflict: "possible conflict",
    source_not_found: "source not found",
    quote_not_supported: "quote not found on page",
    citation_incomplete: "citation incomplete",
    source_too_vague: "claim too vague to match"
  }[s] || "needs review";
}

// Turn the source-verification report into readable streamed sections.
function readableSourceSections(sourceData) {
  if (!sourceData || typeof sourceData !== "object") return [];
  const summary = sourceData.summary || {};
  const claims = asArr(sourceData.claims).slice(0, 6);
  const leads = asArr(sourceData.research_suggestions).slice(0, 3);
  const works = asArr(sourceData.works_cited).slice(0, 10);
  const sections = [];

  sections.push({
    title: "Citation & data check",
    body: [
      `Claims checked against public sources: ${summary.total_claims ?? claims.length}`,
      `Likely supported: ${summary.likely_supported ?? 0}`,
      `Needs review or incomplete: ${(Number(summary.needs_source_review) || 0) + (Number(summary.citation_incomplete) || 0) + (Number(summary.source_not_found) || 0) + (Number(summary.partial_match) || 0)}`,
      firstNonEmpty(summary.note, "Open every linked source and confirm the exact passage before relying on it.")
    ].filter(Boolean).join("\n")
  });

  if (claims.length) {
    sections.push({
      title: "Claims to verify (with sources)",
      body: claims.map((c, i) => {
        const links = asArr(c.sources).slice(0, 3)
          .map((s) => s.url ? `${firstNonEmpty(s.title, s.site_name, "Source")}: ${s.url}` : "")
          .filter(Boolean).join("\n   ");
        return [
          `${i + 1}. ${clip(firstNonEmpty(c.claim, c.text, "Claim"))}`,
          `   Status: ${sourceStatusLabel(c.support_status)}`,
          firstNonEmpty(c.verification_note) ? `   Note: ${clip(c.verification_note)}` : "",
          links ? `   ${links}` : "   No dependable public link found yet."
        ].filter(Boolean).join("\n");
      }).join("\n\n")
    });
  }

  if (leads.length) {
    sections.push({
      title: "Research leads & source links",
      body: leads.map((lead, i) => {
        const links = asArr(lead.links).slice(0, 3)
          .map((l) => l.url ? `${firstNonEmpty(l.title, l.site_name, "Link")}: ${l.url}` : "")
          .filter(Boolean).join("\n   ");
        return [
          `${i + 1}. ${clip(firstNonEmpty(lead.title, lead.label, "Research lead"))}`,
          firstNonEmpty(lead.explanation) ? `   ${clip(lead.explanation)}` : "",
          links ? `   ${links}` : (firstNonEmpty(lead.search_query) ? `   Search: ${lead.search_query}` : "")
        ].filter(Boolean).join("\n");
      }).join("\n\n")
    });
  }

  if (works.length) {
    sections.push({
      title: sourceData.bibliography_title || "Works Cited starter",
      body: works.map((w, i) => `${i + 1}. ${firstNonEmpty(w.entry, w.citation, w.mla, w.apa, w.url)}`).join("\n")
    });
  }

  return sections;
}

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

function prettyDimension(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\band\b/g, "&")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readableAuditSections(audit) {
  const parsed = audit && typeof audit === "object" ? audit : {};
  const scores = parsed.score_breakdown && typeof parsed.score_breakdown === "object" ? parsed.score_breakdown : {};
  const thesis = parsed.thesis || {};
  const collapse = parsed.collapse_point || {};
  const counter = parsed.counterargument || {};
  const fixes = asArray(parsed.priority_fixes);
  const claims = asArray(parsed.claims);
  const strengths = asArray(parsed.strengths);

  const sections = [
    {
      title: "Verdict",
      body: [
        typeof parsed.overall_score === "number" ? `Overall score: ${parsed.overall_score}/100 — ${scoreLabel(parsed.overall_score)}.` : scoreLabel(parsed.overall_score) + ".",
        firstText(parsed.verdict, "Fracture analyzed the writing and built a revision path."),
        firstText(parsed.coaching_note) ? `Where to start: ${compact(parsed.coaching_note, 600)}` : ""
      ].filter(Boolean).join("\n")
    }
  ];

  const scoreLines = Object.keys(scores).map((key) => `${prettyDimension(key)}: ${scores[key] ?? "—"}/25`);
  if (scoreLines.length) {
    sections.push({ title: "Score breakdown", body: scoreLines.join("\n") });
  }

  sections.push({
    title: "Thesis check",
    body: [
      firstText(thesis.quote, "No single thesis sentence was detected — the central claim may be implied rather than stated."),
      firstText(thesis.assessment)
    ].filter(Boolean).join("\n")
  });

  if (strengths.length) {
    sections.push({
      title: "What works",
      body: strengths.slice(0, 3).map((s, i) =>
        `${i + 1}. ${compact(firstText(s.quote, "Strength"), 320)}${firstText(s.why) ? ` — ${compact(s.why, 280)}` : ""}`
      ).join("\n")
    });
  }

  fixes.forEach((fix, index) => {
    sections.push({
      title: `Priority fix ${index + 1}`,
      body: [
        firstText(fix.problem, "Repair this pressure point."),
        fix.quote ? `Text: ${compact(fix.quote)}` : "",
        firstText(fix.why_it_matters) ? `Why it matters: ${compact(fix.why_it_matters)}` : "",
        firstText(fix.exact_fix) ? `Exact fix: ${compact(fix.exact_fix)}` : "",
        firstText(fix.rewrite) ? `Rewrite: ${compact(fix.rewrite)}` : ""
      ].filter(Boolean).join("\n")
    });
  });

  if (firstText(collapse.quote)) {
    sections.push({
      title: "Collapse point",
      body: [
        firstText(collapse.quote),
        firstText(collapse.why_it_collapses) ? `Why it matters most: ${compact(collapse.why_it_collapses)}` : "",
        firstText(collapse.strongest_attack) ? `Strongest attack: ${compact(collapse.strongest_attack)}` : "",
        firstText(collapse.strongest_defense) ? `Best defense: ${compact(collapse.strongest_defense)}` : ""
      ].filter(Boolean).join("\n")
    });
  }

  if (claims.length) {
    sections.push({
      title: "Key claims",
      body: claims.slice(0, 7).map((claim, index) => {
        return [
          `${index + 1}. ${compact(firstText(claim.quote, "Claim"), 360)}`,
          firstText(claim.rating) ? `Rating: ${claim.rating}` : "",
          firstText(claim.diagnosis) ? `Diagnosis: ${compact(claim.diagnosis)}` : "",
          firstText(claim.fix) ? `Repair: ${compact(claim.fix)}` : ""
        ].filter(Boolean).join(" — ");
      }).join("\n")
    });
  }

  if (firstText(counter.strongest_objection)) {
    sections.push({
      title: "Strongest counterargument",
      body: [
        compact(counter.strongest_objection, 480),
        firstText(counter.how_to_answer) ? `How to answer: ${compact(counter.how_to_answer)}` : ""
      ].filter(Boolean).join("\n")
    });
  }

  sections.push({
    title: "Revision path",
    body: fixes.length
      ? fixes.slice(0, 5).map((fix, index) => `${index + 1}. ${compact(firstText(fix.exact_fix, fix.problem, "Repair this issue."), 520)}`).join("\n")
      : "This draft is in strong shape — focus on the refinements noted above rather than structural repairs."
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
  // Note: fracture_report_done is emitted by finish() after optional source sections.
}

async function finish(res, audit, recovered = false, options = {}) {
  writeProgress(res, recovered ? 91 : 90, recovered ? "Recovered a stable report" : "Turning JSON into the readable report");
  await streamReadableAudit(res, audit);

  // Wire in the citation/source engine: search public pages for the draft's
  // factual claims, attach the report to the audit, and stream readable sections.
  let finalAudit = audit;
  if (options.essay && !isTooThinForAudit(options.essay)) {
    try {
      writeProgress(res, 93, "Finding sources, data checks, and citations");
      const citationStyle = String(options.citationStyle || "mla").toLowerCase() === "apa" ? "apa" : "mla";
      const sourceData = await verifySources({ essay: options.essay, audit, citationStyle });
      finalAudit = { ...audit, citation_style: citationStyle, source_verification_report: sourceData };
      const sourceSections = readableSourceSections(sourceData);
      for (const section of sourceSections) {
        writeSse(res, { fracture_report_delta: { title: section.title, body: section.body } });
        await sleep(18);
      }
    } catch (err) {
      finalAudit = {
        ...audit,
        source_verification_report: {
          error: err?.message || String(err),
          claims: [], works_cited: [], research_suggestions: [],
          summary: { total_claims: 0, note: "Source verification could not complete this time. The argument audit above is still usable; verify factual claims before final submission." }
        }
      };
      writeSse(res, { fracture_report_delta: { title: "Citation & data check", body: "Source verification could not complete this time. The argument audit above is still usable — verify any factual claims manually before final submission." } });
    }
  }

  writeSse(res, { fracture_report_done: true });
  writeProgress(res, recovered ? 94 : 96, recovered ? "Recovered a stable report" : "Formatting the final interface");
  writeSse(res, { fracture_audit: finalAudit });
  writeSse(res, { fracture_normalized_json: JSON.stringify(finalAudit, null, 2) });
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

  // Cap output so the audit reliably finishes within the function timeout.
  // The model is fast on bounded output but will run for minutes if left unbounded.
  const depth = String(req.body?.preferences?.depthLevel || "medium").toLowerCase();
  const maxTokens = depth === "surface" ? 2200 : depth === "extreme" ? 5000 : 3500;

  let upstream;
  try {
    writeProgress(res, 10, "Connecting to Fracture AI");
    upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: buildAuditMessages(essay, req.body?.preferences),
      maxTokens,
      temperature: 0.4,
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
  return await finish(res, audit, recovered, { essay, citationStyle: req.body?.preferences?.citationStyle });
}
