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
          firstText(claim.warrant) ? `Warrant: ${compact(claim.warrant, 240)}` : "",
          firstText(claim.missing_warrant) ? `Missing step: ${compact(claim.missing_warrant, 240)}` : "",
          firstText(claim.diagnosis) ? `Diagnosis: ${compact(claim.diagnosis)}` : "",
          firstText(claim.fix) ? `Repair: ${compact(claim.fix)}` : ""
        ].filter(Boolean).join(" — ");
      }).join("\n")
    });
  }

  const assumptions = asArray(parsed.assumption_audit);
  if (assumptions.length) {
    sections.push({
      title: "Hidden assumptions",
      body: assumptions.slice(0, 4).map((a, i) => [
        `${i + 1}. ${compact(firstText(a.assumption, "Assumption"), 320)}`,
        firstText(a.load_bearing) ? `Load-bearing: ${a.load_bearing}` : "",
        firstText(a.if_rejected) ? `If rejected: ${compact(a.if_rejected, 240)}` : "",
        firstText(a.how_to_defend) ? `Defend by: ${compact(a.how_to_defend, 240)}` : ""
      ].filter(Boolean).join(" — ")).join("\n")
    });
  }

  const fallacies = asArray(parsed.logical_fallacies);
  if (fallacies.length) {
    sections.push({
      title: "Logical fallacies",
      body: fallacies.slice(0, 5).map((f, i) => [
        `${i + 1}. ${firstText(f.name, "Reasoning error")}`,
        firstText(f.quote) ? `Text: ${compact(f.quote, 220)}` : "",
        firstText(f.explanation) ? `Why: ${compact(f.explanation, 260)}` : "",
        firstText(f.fix) ? `Fix: ${compact(f.fix, 240)}` : ""
      ].filter(Boolean).join(" — ")).join("\n")
    });
  }

  const attacks = asArray(parsed.attack_tree);
  if (attacks.length) {
    sections.push({
      title: "Opponent attacks",
      body: attacks.slice(0, 4).map((t, i) => [
        `${i + 1}. ${compact(firstText(t.attack, "Attack"), 300)}`,
        firstText(t.targets) ? `Targets: ${compact(t.targets, 180)}` : "",
        firstText(t.response) ? `Response: ${compact(t.response, 260)}` : ""
      ].filter(Boolean).join(" — ")).join("\n")
    });
  }

  const rhet = parsed.rhetorical_analysis || {};
  const strongSent = (rhet.strongest_sentence || {});
  const weakSent = (rhet.weakest_sentence || {});
  if (firstText(strongSent.quote) || firstText(weakSent.quote)) {
    sections.push({
      title: "Standout sentences",
      body: [
        firstText(strongSent.quote) ? `Strongest: ${compact(strongSent.quote, 260)}${firstText(strongSent.why) ? ` — ${compact(strongSent.why, 200)}` : ""}` : "",
        firstText(weakSent.quote) ? `Weakest: ${compact(weakSent.quote, 260)}${firstText(weakSent.why) ? ` — ${compact(weakSent.why, 200)}` : ""}` : "",
        firstText(weakSent.fix) ? `Rewrite: ${compact(weakSent.fix, 280)}` : ""
      ].filter(Boolean).join("\n")
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

  // Attach the citation/source report. The web search already ran BEFORE grading
  // (so the model graded against real evidence); reuse that result here instead of
  // searching again. Only search now as a fallback if it wasn't pre-computed.
  let finalAudit = audit;
  if (options.essay && !isTooThinForAudit(options.essay)) {
    try {
      const citationStyle = String(options.citationStyle || "mla").toLowerCase() === "apa" ? "apa" : "mla";
      let sourceData = options.sourceData;
      if (!sourceData) {
        writeProgress(res, 93, "Finding sources, data checks, and citations");
        sourceData = await verifySources({ essay: options.essay, audit, citationStyle });
      } else {
        writeProgress(res, 93, "Attaching the source and citation findings");
      }
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

// Compact summary of the live web check, injected into the grading prompt so the
// model scores evidence based on what is actually verifiable.
function buildEvidenceContext(sourceData) {
  const claims = asArr(sourceData && sourceData.claims).slice(0, 5);
  if (!claims.length) return "";
  return claims.map((c, i) => {
    const status = sourceStatusLabel(c.support_status);
    const supported = c.support_status === "likely_supported";
    const top = asArr(c.sources).find((s) => s.url);
    const src = supported && top ? ` Real source found: ${firstNonEmpty(top.site_name, top.title)} (${top.url}).` : "";
    const note = !supported && firstNonEmpty(c.verification_note) ? ` Note: ${clip(c.verification_note, 160)}` : "";
    return `${i + 1}. "${clip(firstNonEmpty(c.claim, c.text, "claim"), 150)}" — web check: ${status}.${src}${note}`;
  }).join("\n");
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
  // Tuned so a medium audit completes around ~85s on the free model while staying rich.
  const maxTokens = depth === "surface" ? 2200 : depth === "extreme" ? 5200 : 3400;
  const citationStyle = req.body?.preferences?.citationStyle;

  // STEP 1 — Check the draft's factual claims against the live web BEFORE grading,
  // so the model scores evidence based on what is actually real. The result is
  // reused for the citation sections so we never search twice.
  let sourceData = null;
  let evidenceContext = "";
  try {
    writeProgress(res, 12, "Checking the draft's claims against the live web");
    sourceData = await verifySources({ essay, citationStyle: String(citationStyle || "mla").toLowerCase() === "apa" ? "apa" : "mla" });
    evidenceContext = buildEvidenceContext(sourceData);
  } catch (_) {
    sourceData = null;
  }

  // STEP 2 — Grade, with the live evidence findings in the prompt.
  let upstream;
  try {
    writeProgress(res, 22, "Grading against the verified evidence");
    upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: buildAuditMessages(essay, req.body?.preferences, evidenceContext),
      maxTokens,
      temperature: 0.4,
      referer: "https://fracturestudio.vercel.app"
    });
  } catch (err) {
    return await finish(res, buildServiceFallbackAudit(essay, `Failed to reach OpenRouter: ${err?.message || String(err)}`), true, { essay, citationStyle, sourceData });
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
    return await finish(res, buildServiceFallbackAudit(essay, err?.message || String(err)), true, { essay, citationStyle, sourceData });
  }

  writeProgress(res, 86, "Validating the report structure");
  const { audit, recovered } = prepareAuditFromModelText(rawText, essay);
  writeProgress(res, recovered ? 91 : 90, recovered ? "Repairing a malformed model response" : "Report structure verified");
  return await finish(res, audit, recovered, { essay, citationStyle, sourceData });
}
