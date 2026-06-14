import {
  DEFAULT_MODEL,
  buildServiceFallbackAudit,
  buildTooThinAudit,
  isTooThinForAudit,
  prepareAuditFromModelText
} from "./audit-utils.js";
import { buildAuditMessages } from "./prompts.js";
import { verifySources } from "./source-verify.js";
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
  "Finding the load-bearing point",
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
  if (score >= 11) return "Argument breaks under pressure";
  return "Not enough argument to evaluate";
}

function compact(value, max = 520) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}


function normalizeMode(value) {
  const cleaned = String(value || "argument").toLowerCase();
  if (cleaned === "speech" || cleaned === "presentation") return "speech";
  if (cleaned === "essay" || cleaned === "paragraph") return "essay";
  if (cleaned === "rubric" || cleaned === "rubric-grading") return "rubric";
  if (cleaned === "argument" || cleaned === "debate" || cleaned === "debate-case" || cleaned === "policy" || cleaned === "source-review" || cleaned === "not-chosen") return "argument";
  return "argument";
}


function normalizeDepth(value) {
  const cleaned = String(value || "").toLowerCase();
  if (cleaned === "concise" || cleaned === "basic" || cleaned === "surface") return "surface";
  if (cleaned === "balanced" || cleaned === "medium") return "medium";
  if (cleaned === "intensive" || cleaned === "deep" || cleaned === "extreme") return "extreme";
  return "medium";
}

function looksLikeHeaderLine(line, index, lines) {
  const text = String(line || "").trim();
  if (!text) return true;
  if (text.length > 120) return false;
  if (/^(name|student|teacher|class|course|period|date|title|assignment|professor|instructor)\s*[:\-]/i.test(text)) return true;
  if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(text)) return true;
  if (/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(text)) return true;
  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(text)) return true;
  if (/\b(period|grade|english|history|speech|debate|language arts|ela)\b/i.test(text) && text.length < 70) return true;
  const hasSentenceEnd = /[.!?]["')\]]?$/.test(text);
  const hasArgumentSignal = /\b(because|therefore|should|must|proves?|shows?|argues?|claims?|however|although)\b/i.test(text);
  const next = String(lines[index + 1] || "").trim();
  const nextLooksBody = next.length > 80 || /[.!?]["')\]]?$/.test(next);
  if (!hasSentenceEnd && !hasArgumentSignal && text.length <= 80 && nextLooksBody) return true;
  return false;
}

function separateSubmission(rawEssay) {
  const originalLines = String(rawEssay || "").replace(/\r\n/g, "\n").split("\n");
  const lines = originalLines.map((line) => line.replace(/\s+$/g, ""));
  let start = 0;
  const ignoredHeader = [];
  while (start < Math.min(lines.length, 14) && looksLikeHeaderLine(lines[start], start, lines)) {
    if (String(lines[start] || "").trim()) ignoredHeader.push(lines[start].trim());
    start += 1;
  }
  let bodyLines = lines.slice(start);
  let sourceContext = "";
  const sourceIndex = bodyLines.findIndex((line) => /^\s*(works cited|references|bibliography|sources)\s*:?\s*$/i.test(line));
  if (sourceIndex >= 0) {
    sourceContext = bodyLines.slice(sourceIndex).join("\n").trim();
    bodyLines = bodyLines.slice(0, sourceIndex);
  }
  let body = bodyLines.join("\n").trim();
  if (!body || body.split(/\s+/).filter(Boolean).length < 15) {
    body = String(rawEssay || "").trim();
    return { body, ignoredHeader: [], sourceContext: "" };
  }
  return { body, ignoredHeader, sourceContext };
}

function applyDepthProfile(audit, depth, mode) {
  if (!audit || typeof audit !== "object") return audit;
  const profile = depth === "surface"
    ? { fixes: 3, claims: 3, assumptions: 2, fallacies: 2, counters: 2, attacks: 2, truth: 2, citations: 2, extras: 1, alternatives: 1, rewrites: 2, links: 3 }
    : depth === "extreme"
      ? { fixes: 8, claims: 8, assumptions: 6, fallacies: 5, counters: 6, attacks: 6, truth: 8, citations: 6, extras: 5, alternatives: 4, rewrites: 6, links: 5 }
      : { fixes: 5, claims: 5, assumptions: 4, fallacies: 3, counters: 4, attacks: 4, truth: 5, citations: 3, extras: 3, alternatives: 2, rewrites: 4, links: 5 };
  const slice = (key, limit) => { if (Array.isArray(audit[key])) audit[key] = audit[key].slice(0, limit); };
  slice("priority_fixes", profile.fixes);
  if (audit.argument_strength && Array.isArray(audit.argument_strength.claims)) audit.argument_strength.claims = audit.argument_strength.claims.slice(0, profile.claims);
  if (audit.argument_dependency_graph && Array.isArray(audit.argument_dependency_graph.links)) audit.argument_dependency_graph.links = audit.argument_dependency_graph.links.slice(0, depth === "surface" ? 3 : depth === "extreme" ? 12 : 7);
  slice("assumption_audit", profile.assumptions);
  slice("logical_fallacies", profile.fallacies);
  slice("counter_arguments", profile.counters);
  slice("attack_tree", profile.attacks);
  slice("truth_audit", profile.truth);
  slice("citation_opportunities", profile.citations);
  slice("extra_argument_ideas", profile.extras);
  slice("alternative_solutions_test", profile.alternatives);
  slice("rewrite_suggestions", profile.rewrites);
  audit.depth_profile = depth;
  audit.analysis_mode = mode;
  return audit;
}

function modeSafeText(value, mode) {
  const text = String(value || "");
  if (mode !== "speech") return text;
  return text
    .replace(/collapse point/gi, "audience friction point")
    .replace(/collapses/gi, "loses force")
    .replace(/collapse/gi, "lose force");
}

function reportLabels(mode) {
  if (mode === "speech") {
    return {
      pressureTitle: "Audience friction point",
      pressureMissing: "No single audience friction point was isolated.",
      whyLabel: "Why the audience may lose the thread",
      attackLabel: "Listener doubt",
      repairLabel: "Best delivery or clarity repair"
    };
  }
  if (mode === "essay") {
    return {
      pressureTitle: "Essay pressure point",
      pressureMissing: "No single essay pressure point was isolated.",
      whyLabel: "Why the writing weakens here",
      attackLabel: "Reader concern",
      repairLabel: "Best essay repair"
    };
  }
  if (mode === "rubric") {
    return {
      pressureTitle: "Rubric risk point",
      pressureMissing: "No single rubric risk point was isolated.",
      whyLabel: "Why this costs points",
      attackLabel: "Likely grader comment",
      repairLabel: "Best rubric-based repair"
    };
  }
  return {
    pressureTitle: "Collapse point",
    pressureMissing: "No single collapse point was isolated.",
    whyLabel: "Why it collapses",
    attackLabel: "Strongest challenge",
    repairLabel: "Best repair"
  };
}

function readableAuditSections(audit, mode = "not-chosen", depth = "medium") {
  const parsed = audit && typeof audit === "object" ? audit : {};
  const labels = reportLabels(mode);
  const scores = parsed.score_breakdown || {};
  const thesis = (parsed.argument_strength || {}).thesis || {};
  const collapse = parsed.collapse_point || {};
  const fixes = asArray(parsed.priority_fixes).slice(0, 5);
  const attacks = asArray(parsed.attack_tree).slice(0, depth === "surface" ? 2 : depth === "extreme" ? 6 : 4);
  const claims = asArray((parsed.argument_strength || {}).claims).slice(0, depth === "surface" ? 2 : depth === "extreme" ? 6 : 4);

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

  fixes.slice(0, depth === "surface" ? 3 : depth === "extreme" ? 7 : 5).forEach((fix, index) => {
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
    title: labels.pressureTitle,
    body: [
      modeSafeText(firstText(collapse.quote, labels.pressureMissing), mode),
      firstText(collapse.why_it_collapses) ? `${labels.whyLabel}: ${compact(modeSafeText(collapse.why_it_collapses, mode))}` : "",
      firstText(collapse.strongest_attack, collapse.opponent_attack) ? `${labels.attackLabel}: ${compact(modeSafeText(firstText(collapse.strongest_attack, collapse.opponent_attack), mode))}` : "",
      firstText(collapse.strongest_defense, collapse.reinforcement) ? `${labels.repairLabel}: ${compact(modeSafeText(firstText(collapse.strongest_defense, collapse.reinforcement), mode))}` : ""
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

function normalizeCitationStyle(value) {
  return String(value || "mla").toLowerCase() === "apa" ? "apa" : "mla";
}

function sourceStatusLabel(status) {
  const cleaned = String(status || "needs_review").toLowerCase();
  if (cleaned === "likely_supported") return "likely supported";
  if (cleaned === "partial_match") return "partial match";
  if (cleaned === "possible_conflict") return "possible conflict";
  if (cleaned === "source_not_found") return "source not found";
  if (cleaned === "citation_incomplete") return "citation incomplete";
  return "needs review";
}

function readableSourceSections(sourceData, depth = "medium") {
  if (!sourceData || typeof sourceData !== "object") {
    return [{
      title: "Citation and data check",
      body: "No source verification data was attached to this audit. Run the audit again after adding clearer factual claims or cited evidence."
    }];
  }

  const claimLimit = depth === "surface" ? 3 : depth === "extreme" ? 8 : 5;
  const leadLimit = depth === "surface" ? 2 : depth === "extreme" ? 5 : 3;
  const linkLimit = depth === "surface" ? 3 : 5;
  const summary = sourceData.summary || {};
  const claims = asArray(sourceData.claims).slice(0, claimLimit);
  const suggestions = asArray(sourceData.research_suggestions).slice(0, leadLimit);
  const works = asArray(sourceData.works_cited).slice(0, depth === "surface" ? 4 : 10);
  const sections = [];

  sections.push({
    title: "Citation and data check",
    body: [
      `Checked claims: ${summary.total_claims ?? claims.length}`,
      `Likely supported: ${summary.likely_supported ?? 0}`,
      `Needs review or incomplete: ${(Number(summary.needs_source_review) || 0) + (Number(summary.citation_incomplete) || 0) + (Number(summary.source_not_found) || 0) + (Number(summary.partial_match) || 0)}`,
      firstText(summary.note, "Open any linked source and confirm the exact passage before using it in a final paper or speech.")
    ].filter(Boolean).join("\n")
  });

  if (claims.length) {
    sections.push({
      title: "Data and citation claims to verify",
      body: claims.map((claim, index) => {
        const topSources = asArray(claim.sources).slice(0, linkLimit).map((source) => source.url ? `${firstText(source.title, source.site_name, "Source")}: ${source.url}` : "").filter(Boolean).join(" | ");
        return [
          `${index + 1}. ${compact(firstText(claim.claim, claim.text, "Claim to verify"), 360)}`,
          `Status: ${sourceStatusLabel(claim.support_status)}`,
          firstText(claim.verification_note, claim.note) ? `Note: ${compact(firstText(claim.verification_note, claim.note), 360)}` : "",
          topSources ? `Links: ${topSources}` : "Links: no dependable public link found yet"
        ].filter(Boolean).join(" — ");
      }).join("\n")
    });
  }

  if (suggestions.length) {
    sections.push({
      title: "Extra arguments and source links",
      body: suggestions.map((idea, index) => {
        const links = asArray(idea.links).slice(0, linkLimit).map((link) => link.url ? `${firstText(link.title, link.site_name, "Source link")}: ${link.url}` : "").filter(Boolean).join(" | ");
        return [
          `${index + 1}. ${compact(firstText(idea.title, idea.label, "Research lead"), 320)}`,
          firstText(idea.explanation) ? `Why it helps: ${compact(idea.explanation, 360)}` : "",
          links ? `Links: ${links}` : firstText(idea.search_query) ? `Search query: ${idea.search_query}` : ""
        ].filter(Boolean).join(" — ");
      }).join("\n")
    });
  }

  if (works.length) {
    sections.push({
      title: sourceData.bibliography_title || "Works Cited starter",
      body: works.map((entry, index) => `${index + 1}. ${firstText(entry.entry, entry.citation, entry.mla, entry.apa, entry.url)}`).join("\n")
    });
  }

  return sections;
}

async function attachSourceVerification(essay, audit, citationStyle, depth, res) {
  if (!essay || !audit || typeof audit !== "object") return audit;
  try {
    writeProgress(res, 93, "Finding source links, data checks, and citation entries");
    const sourceData = await verifySources({ essay, audit, citationStyle });
    return {
      ...audit,
      citation_style: normalizeCitationStyle(citationStyle),
      source_verification_report: sourceData
    };
  } catch (err) {
    return {
      ...audit,
      citation_style: normalizeCitationStyle(citationStyle),
      source_verification_report: {
        error: err?.message || String(err),
        citation_style: normalizeCitationStyle(citationStyle),
        claims: [],
        works_cited: [],
        research_suggestions: [],
        summary: {
          total_claims: 0,
          note: "Source verification could not complete during this audit. The argument audit is still usable; verify factual claims manually before final submission."
        }
      }
    };
  }
}

async function streamReadableAudit(res, audit, mode = "not-chosen", depth = "medium") {
  writeSse(res, { fracture_report_start: true });
  const sections = readableAuditSections(audit, mode, depth);
  for (const section of sections) {
    writeSse(res, { fracture_report_delta: { title: section.title, body: section.body } });
    await sleep(18);
  }
  writeSse(res, { fracture_report_done: true });
}

async function finish(res, audit, recovered = false, mode = "not-chosen", depth = "medium", options = {}) {
  writeProgress(res, recovered ? 91 : 90, recovered ? "Recovered a stable report" : "Turning JSON into the readable report");
  writeSse(res, { fracture_report_start: true });
  for (const section of readableAuditSections(audit, mode, depth)) {
    writeSse(res, { fracture_report_delta: { title: section.title, body: section.body } });
    await sleep(18);
  }

  const shouldAttachSources = Boolean(options.essay) && !isTooThinForAudit(options.essay);
  const finalAudit = shouldAttachSources
    ? await attachSourceVerification(options.essay, audit, options.citationStyle, depth, res)
    : audit;

  if (shouldAttachSources) {
    for (const section of readableSourceSections(finalAudit.source_verification_report, depth)) {
      writeSse(res, { fracture_report_delta: { title: section.title, body: section.body } });
      await sleep(18);
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
    progress: Math.min(88, 20 + step * 3),
    message: PROGRESS_MESSAGES[step + 2] || "Reading the model report"
  };
}

export async function handleAnalyze(req, res) {
  if (req.method && req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const originalEssay = typeof req.body?.essay === "string" ? req.body.essay.trim() : "";
  const mode = normalizeMode(req.body?.preferences?.analysisFormat);
  const depth = normalizeDepth(req.body?.preferences?.feedbackDepth);
  if (!originalEssay) return res.status(400).json({ error: "Paste writing before using Fracture." });
  if (originalEssay.length > 40000) return res.status(400).json({ error: "Draft exceeds the 40,000 character limit." });
  const separated = separateSubmission(originalEssay);
  const essay = separated.body;

  startSse(res);
  writeProgress(res, 4, PROGRESS_MESSAGES[0]);

  if (isTooThinForAudit(essay)) {
    writeProgress(res, 38, "Checking for a complete argument");
    return await finish(res, buildTooThinAudit(essay), false, mode, depth, { essay, citationStyle: req.body?.preferences?.citationStyle });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return await finish(res, buildServiceFallbackAudit(essay, "OPENROUTER_API_KEY is not configured"), true, mode, depth, { essay, citationStyle: req.body?.preferences?.citationStyle });
  }

  let upstream;
  try {
    writeProgress(res, 10, "Connecting to Fracture AI");
    upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: buildAuditMessages(essay, req.body?.preferences, separated),
      maxTokens: depth === "surface" ? 2800 : depth === "extreme" ? 8500 : 5200,
      referer: "https://fracturestudio.vercel.app"
    });
  } catch (err) {
    return await finish(res, buildServiceFallbackAudit(essay, `Failed to reach OpenRouter: ${err?.message || String(err)}`), true, mode, depth, { essay, citationStyle: req.body?.preferences?.citationStyle });
  }

  writeProgress(res, 18, "Reading the live model stream");
  let rawText = "";
  let lastProgress = 18;
  const activeMessage = depth === "extreme"
    ? "Writing the extreme-depth audit"
    : mode === "speech"
      ? "Writing speech, persuasion, and delivery feedback"
      : mode === "essay"
        ? "Writing essay structure, flow, and language feedback"
        : mode === "rubric"
          ? "Grading against the supplied rubric"
          : "Writing argument pressure tests";
  const heartbeat = setInterval(() => {
    if (lastProgress < 92) {
      lastProgress = Math.min(92, lastProgress + 1);
      writeProgress(res, lastProgress, activeMessage);
    } else {
      writeSse(res, { fracture_heartbeat: { message: activeMessage, at: Date.now() } });
    }
  }, 2200);
  try {
    rawText = await collectTextFromOpenRouter(upstream, (delta, length) => {
      writeSse(res, { fracture_model_delta: delta });
      const next = nextProgressFromLength(length);
      if (next.progress >= lastProgress + 2) {
        lastProgress = next.progress;
        writeProgress(res, next.progress, next.message);
      }
    });
  } catch (err) {
    clearInterval(heartbeat);
    return await finish(res, buildServiceFallbackAudit(essay, err?.message || String(err)), true, mode, depth, { essay, citationStyle: req.body?.preferences?.citationStyle });
  } finally {
    clearInterval(heartbeat);
  }

  writeProgress(res, 86, "Validating the report structure");
  const { audit, recovered } = prepareAuditFromModelText(rawText, essay);
  const profiledAudit = applyDepthProfile(audit, depth, mode);
  profiledAudit.document_cleanup = {
    ignored_heading_lines: separated.ignoredHeader,
    separated_source_context: Boolean(separated.sourceContext)
  };
  writeProgress(res, recovered ? 91 : 90, recovered ? "Repairing a malformed model response" : "Report structure verified");
  return await finish(res, profiledAudit, recovered, mode, depth, { essay, citationStyle: req.body?.preferences?.citationStyle });
}
