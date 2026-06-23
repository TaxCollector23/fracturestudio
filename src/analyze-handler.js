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

function readableAuditSections(audit, mode) {
  const parsed = audit && typeof audit === "object" ? audit : {};
  const m = String(mode || "argument").toLowerCase();
  const scores = parsed.score_breakdown && typeof parsed.score_breakdown === "object" ? parsed.score_breakdown : {};
  const fixes = asArray(parsed.priority_fixes);
  const strengths = asArray(parsed.strengths);

  // ── Shared opener ──────────────────────────────────────────────────────────
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

  const scoreLines = Object.keys(scores).map((key) => `${prettyDimension(key)}: ${scores[key] ?? "—"}`);
  if (scoreLines.length) {
    sections.push({ title: "Score breakdown", body: scoreLines.join("\n") });
  }

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

  // ── Mode-specific sections ─────────────────────────────────────────────────
  if (m === 'speech') {
    const hook = parsed.hook_analysis || {};
    if (firstText(hook.current_hook) || firstText(hook.assessment)) {
      sections.push({
        title: "Hook analysis",
        body: [
          firstText(hook.current_hook) ? `Current hook [${firstText(hook.rating, "?")}]: "${compact(hook.current_hook, 200)}"` : "",
          firstText(hook.assessment) ? compact(hook.assessment) : "",
          firstText(hook.stronger_hook) ? `Stronger hook: ${compact(hook.stronger_hook)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const ac = parsed.audience_clarity || {};
    if (typeof ac.main_message_obvious === "boolean" || firstText(ac.level_assessment)) {
      const confusing = asArray(ac.confusing_terms);
      const fixes_ac = asArray(ac.fixes);
      sections.push({
        title: "Audience clarity",
        body: [
          `Main message clear: ${ac.main_message_obvious ? "Yes" : "No"} — Audience knows why it matters: ${ac.audience_knows_why_it_matters ? "Yes" : "No"}`,
          firstText(ac.level_assessment) ? `Level: ${compact(ac.level_assessment)}` : "",
          confusing.length ? `Confusing terms: ${confusing.join(", ")}` : "",
          fixes_ac.length ? `Fix: ${fixes_ac.slice(0, 2).map(compact).join(" | ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const dm = asArray(parsed.delivery_markup);
    if (dm.length) {
      sections.push({
        title: "Delivery markup",
        body: dm.slice(0, 3).map((d, i) => {
          return [
            `${i + 1}. Original: "${compact(firstText(d.original_text), 160)}"`,
            firstText(d.annotated) ? `   Annotated: ${compact(d.annotated)}` : "",
            firstText(d.note) ? `   Note: ${compact(d.note, 200)}` : ""
          ].filter(Boolean).join("\n");
        }).join("\n\n")
      });
    }

    const dr = asArray(parsed.delivery_risks);
    if (dr.length) {
      sections.push({
        title: "Delivery risks",
        body: dr.slice(0, 3).map((d, i) => [
          `${i + 1}. "${compact(firstText(d.quote), 180)}"`,
          firstText(d.risk) ? `   Risk: ${compact(d.risk, 200)}` : "",
          firstText(d.fix) ? `   Fix: ${compact(d.fix)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const mc = parsed.memorability_check || {};
    if (firstText(mc.suggested_memorable_line) || asArray(mc.missing_elements).length) {
      sections.push({
        title: "Memorability check",
        body: [
          `Has memorable moment: ${mc.has_memorable_moment ? "Yes" : "No"}`,
          asArray(mc.memorable_elements_found).length ? `Found: ${asArray(mc.memorable_elements_found).join(", ")}` : "",
          asArray(mc.missing_elements).length ? `Missing: ${asArray(mc.missing_elements).join(", ")}` : "",
          firstText(mc.suggested_memorable_line) ? `Suggested line: ${compact(mc.suggested_memorable_line)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const cta = parsed.call_to_action || {};
    if (firstText(cta.current) || firstText(cta.stronger_ending)) {
      sections.push({
        title: "Call to action",
        body: [
          `Present: ${cta.present ? "Yes" : "No"} — Specific: ${cta.is_specific ? "Yes" : "No"} — Achievable: ${cta.is_achievable ? "Yes" : "No"}`,
          firstText(cta.current) ? `Current ending: "${compact(cta.current, 200)}"` : "",
          firstText(cta.assessment) ? compact(cta.assessment) : "",
          firstText(cta.stronger_ending) ? `Stronger: ${compact(cta.stronger_ending)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const aq = asArray(parsed.audience_questions);
    if (aq.length) {
      sections.push({
        title: "Audience questions to preempt",
        body: aq.slice(0, 4).map((q, i) => [
          `${i + 1}. [${firstText(q.type, "?")}] ${compact(firstText(q.question), 280)}`,
          firstText(q.how_to_preempt) ? `   Preempt: ${compact(q.how_to_preempt)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    // Monroe + Aristotle from mode_analysis
    const modeAnalysis = parsed.mode_analysis || {};
    const monroe = modeAnalysis.monroe_sequence || {};
    const monroeSteps = ["attention", "need", "satisfaction", "visualization", "action"];
    const monroeLabels = { attention: "Attention", need: "Need", satisfaction: "Satisfaction", visualization: "Visualization", action: "Action" };
    const monroeLines = monroeSteps.map((step) => {
      const s = monroe[step] || {};
      if (!s.note && !s.quote) return "";
      const grade = firstText(s.grade) ? ` [${s.grade}]` : "";
      const present = s.present === false ? " — MISSING" : "";
      const quote = firstText(s.quote) ? ` "${compact(s.quote, 120)}"` : "";
      const note = firstText(s.note) ? ` — ${compact(s.note, 200)}` : "";
      return `${monroeLabels[step]}${grade}${present}${quote}${note}`;
    }).filter(Boolean);
    if (monroeLines.length) {
      sections.push({ title: "Monroe's Motivated Sequence", body: monroeLines.join("\n") });
    }

    const appeals = modeAnalysis.rhetorical_appeals || {};
    const appealLines = ["ethos", "pathos", "logos"].map((proof) => {
      const a = appeals[proof] || {};
      if (!a.quote && !a.mechanism) return "";
      const grade = firstText(a.grade) ? ` [${a.grade}]` : "";
      const quote = firstText(a.quote) ? ` "${compact(a.quote, 120)}"` : "";
      const mech = firstText(a.mechanism) ? ` — ${compact(a.mechanism, 200)}` : "";
      return `${proof.charAt(0).toUpperCase() + proof.slice(1)}${grade}${quote}${mech}`;
    }).filter(Boolean);
    if (appealLines.length) {
      const addLine = firstText(appeals.one_sentence_to_add) ? `\nAdd: ${compact(appeals.one_sentence_to_add)}` : "";
      sections.push({ title: "Aristotle's three proofs", body: appealLines.join("\n") + addLine });
    }

    const devices = asArray(modeAnalysis.rhetorical_devices);
    if (devices.length) {
      sections.push({
        title: "Rhetorical devices",
        body: devices.slice(0, 5).map((d, i) => {
          const quote = firstText(d.quote) ? ` "${compact(d.quote, 120)}"` : "";
          const note = firstText(d.note) ? ` — ${compact(d.note, 200)}` : "";
          return `${i + 1}. ${firstText(d.device, "Device")}${quote}${note}`;
        }).join("\n")
      });
    }

  } else if (m === 'essay') {
    const mpc = parsed.main_point_check || {};
    if (firstText(mpc.central_idea) || firstText(mpc.assessment)) {
      sections.push({
        title: "Main point check",
        body: [
          firstText(mpc.central_idea) ? `Central idea: ${compact(mpc.central_idea)}` : "",
          `Clear early: ${mpc.is_clear_early ? "Yes" : "No"} — Every paragraph connects: ${mpc.every_paragraph_connects ? "Yes" : "No"}`,
          firstText(mpc.assessment) ? compact(mpc.assessment) : "",
          firstText(mpc.stronger_thesis) ? `Stronger thesis: ${compact(mpc.stronger_thesis)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const paragraphs = asArray(parsed.paragraph_map);
    if (paragraphs.length) {
      sections.push({
        title: "Paragraph map",
        body: paragraphs.slice(0, 8).map((p) => {
          const num = p.number || "?";
          const job = firstText(p.job, "?");
          const ts = firstText(p.topic_sentence);
          const assess = firstText(p.assessment);
          const fix = firstText(p.fix);
          const flags = [
            p.doing_too_much ? "doing two jobs" : "",
            p.should_move ? "should move" : ""
          ].filter(Boolean).join(", ");
          return [
            `¶${num} [${job}]${flags ? ` ⚠ ${flags}` : ""}`,
            ts ? `  Topic sentence: "${compact(ts, 160)}"` : "",
            firstText(p.topic_sentence_assessment) ? `  Assessment: ${p.topic_sentence_assessment}` : "",
            assess ? `  ${compact(assess, 200)}` : "",
            fix ? `  Fix: ${compact(fix)}` : ""
          ].filter(Boolean).join("\n");
        }).join("\n\n")
      });
    }

    const evInt = asArray(parsed.evidence_integration);
    const droppedEvidence = evInt.filter((e) => e.just_dropped_in || !e.is_explained);
    if (droppedEvidence.length) {
      sections.push({
        title: "Evidence integration problems",
        body: droppedEvidence.slice(0, 4).map((e, i) => [
          `${i + 1}. "${compact(firstText(e.quote), 200)}"`,
          `   Introduced: ${e.is_introduced ? "Yes" : "No"} — Explained: ${e.is_explained ? "Yes" : "No"} — Connected: ${e.is_connected_to_point ? "Yes" : "No"}`,
          firstText(e.fix) ? `   Fix: ${compact(e.fix)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const flow = parsed.flow_and_transitions || {};
    const jumps = asArray(flow.abrupt_jumps);
    if (firstText(flow.assessment) || jumps.length) {
      sections.push({
        title: "Flow & transitions",
        body: [
          firstText(flow.assessment) ? compact(flow.assessment) : "",
          jumps.length ? `Abrupt jumps: ${jumps.slice(0, 3).map(compact).join(" | ")}` : "",
          asArray(flow.fixes).length ? `Fixes: ${asArray(flow.fixes).slice(0, 2).map(compact).join(" | ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const red = parsed.redundancy_check || {};
    const repeated = asArray(red.repeated_ideas);
    const filler = asArray(red.filler_sentences);
    if (repeated.length || filler.length) {
      sections.push({
        title: "Redundancy",
        body: [
          repeated.length ? `Repeated ideas: ${repeated.slice(0, 2).map(compact).join(" | ")}` : "",
          filler.length ? `Filler: ${filler.slice(0, 2).map((f) => `"${compact(f, 120)}"`).join(" | ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const gs = parsed.grammar_style || {};
    const grammarIssues = [
      ...asArray(gs.grammar_errors).slice(0, 2),
      ...asArray(gs.passive_voice_issues).slice(0, 1),
      ...asArray(gs.casual_language).slice(0, 1)
    ].filter(Boolean);
    if (grammarIssues.length || firstText(gs.word_choice)) {
      sections.push({
        title: "Grammar & style",
        body: [
          grammarIssues.length ? grammarIssues.slice(0, 3).map((g, i) => `${i + 1}. ${compact(String(g), 200)}`).join("\n") : "",
          firstText(gs.word_choice) ? `Word choice: ${compact(gs.word_choice)}` : "",
          firstText(gs.sentence_variety) ? `Sentence variety: ${compact(gs.sentence_variety)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const conc = parsed.conclusion_strength || {};
    if (firstText(conc.assessment) || firstText(conc.stronger_conclusion)) {
      sections.push({
        title: "Conclusion",
        body: [
          firstText(conc.assessment) ? compact(conc.assessment) : "",
          firstText(conc.stronger_conclusion) ? `Stronger ending: ${compact(conc.stronger_conclusion)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    // Essay mode_analysis
    const ea = (parsed.mode_analysis || {});
    const evMap = asArray(ea.evidence_integration_map);
    if (evMap.length) {
      sections.push({
        title: "Evidence integration map",
        body: evMap.slice(0, 4).map((e, i) => [
          `${i + 1}. "${compact(firstText(e.quote), 160)}" — ${firstText(e.explanation_quality, "?")}`,
          firstText(e.fix) ? `   Fix: ${compact(e.fix)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

  } else if (m === 'college-essay') {
    const tpt = parsed.thesis_pressure_test || {};
    if (firstText(tpt.quote) || firstText(tpt.assessment)) {
      sections.push({
        title: "Thesis pressure test",
        body: [
          firstText(tpt.quote) ? `Thesis: "${compact(tpt.quote, 280)}"` : "",
          `Specific: ${tpt.is_specific ? "Yes" : "No"} — Arguable: ${tpt.is_arguable ? "Yes" : "No"} — Too obvious: ${tpt.is_too_obvious ? "Yes" : "No"} — Essay proves it: ${tpt.does_essay_prove_it ? "Yes" : "No"}`,
          firstText(tpt.assessment) ? compact(tpt.assessment) : "",
          firstText(tpt.stronger_thesis) ? `Stronger thesis: ${compact(tpt.stronger_thesis)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const pa = asArray(parsed.paragraph_architecture);
    if (pa.length) {
      sections.push({
        title: "Paragraph architecture",
        body: pa.slice(0, 6).map((p) => {
          const flags = [
            p.doing_two_jobs ? "doing two jobs" : "",
            !p.connected_to_thesis ? "not connected to thesis" : "",
            p.needs_more_analysis ? "needs more analysis" : ""
          ].filter(Boolean).join(", ");
          return [
            `¶${p.number} [${firstText(p.job, "?")}]${flags ? ` ⚠ ${flags}` : ""}`,
            firstText(p.topic_sentence) ? `  Topic: "${compact(p.topic_sentence, 140)}"` : "",
            firstText(p.fix) ? `  Fix: ${compact(p.fix)}` : ""
          ].filter(Boolean).join("\n");
        }).join("\n\n")
      });
    }

    const cra = asArray(parsed.close_reading_audit);
    if (cra.length) {
      sections.push({
        title: "Close reading audit",
        body: cra.slice(0, 3).map((c, i) => [
          `${i + 1}. "${compact(firstText(c.quote), 180)}"`,
          `   Analyzes specific words: ${c.analyzes_specific_words ? "Yes" : "No"} — Just summarizes: ${c.just_summarizes ? "Yes" : "No"}`,
          firstText(c.feedback) ? `   Professor: ${compact(c.feedback)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const cq = parsed.counterargument_quality || {};
    if (typeof cq.has_counterargument === "boolean" || firstText(cq.assessment)) {
      sections.push({
        title: "Counterargument quality",
        body: [
          `Has counterargument: ${cq.has_counterargument ? "Yes" : "No"} — Real & strong: ${cq.is_real_and_strong ? "Yes" : "No"} — Response convincing: ${cq.is_response_convincing ? "Yes" : "No"}`,
          firstText(cq.assessment) ? compact(cq.assessment) : "",
          firstText(cq.better_counterargument) ? `Stronger objection: ${compact(cq.better_counterargument)}` : "",
          firstText(cq.stronger_rebuttal) ? `Stronger rebuttal: ${compact(cq.stronger_rebuttal)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const avc = asArray(parsed.academic_voice_coach);
    if (avc.length) {
      sections.push({
        title: "Academic voice",
        body: avc.slice(0, 4).map((v, i) => [
          `${i + 1}. [${firstText(v.issue, "?")}] "${compact(firstText(v.quote), 160)}"`,
          firstText(v.problem) ? `   Why: ${compact(v.problem, 200)}` : "",
          firstText(v.suggestion) ? `   Fix: ${compact(v.suggestion)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const pl = parsed.professor_lens || {};
    const mc = asArray(pl.margin_comments);
    if (mc.length || firstText(pl.end_comment)) {
      sections.push({
        title: "Professor's lens",
        body: [
          mc.length ? mc.slice(0, 3).map((c, i) => `${i + 1}. ${compact(String(c), 260)}`).join("\n") : "",
          firstText(pl.end_comment) ? `\nEnd comment: ${compact(pl.end_comment)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const cc = parsed.conclusion_check || {};
    if (firstText(cc.assessment) || firstText(cc.stronger_closing)) {
      sections.push({
        title: "Conclusion",
        body: [
          firstText(cc.assessment) ? compact(cc.assessment) : "",
          firstText(cc.stronger_closing) ? `Stronger closing: ${compact(cc.stronger_closing)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    // College-essay mode_analysis
    const ceMA = (parsed.mode_analysis || {});
    const crq = asArray(ceMA.close_reading_quality);
    if (crq.length) {
      sections.push({
        title: "Close reading quality",
        body: crq.slice(0, 3).map((c, i) => [
          `${i + 1}. "${compact(firstText(c.quote), 160)}"`,
          `   Type: ${firstText(c.analysis_type, "?")}`,
          firstText(c.what_analysis_requires) ? `   What's needed: ${compact(c.what_analysis_requires)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

  } else if (m === 'research-paper') {
    const rqa = parsed.research_question_audit || {};
    if (firstText(rqa.detected_question) || firstText(rqa.assessment)) {
      sections.push({
        title: "Research question",
        body: [
          firstText(rqa.detected_question) ? `Question: ${compact(rqa.detected_question)}` : "",
          `Clear: ${rqa.is_clear ? "Yes" : "No"} — Answerable: ${rqa.is_answerable ? "Yes" : "No"} — Paper answers it: ${rqa.paper_answers_it ? "Yes" : "No"}`,
          firstText(rqa.assessment) ? compact(rqa.assessment) : "",
          firstText(rqa.narrower_question) ? `Narrower version: ${compact(rqa.narrower_question)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const sa = asArray(parsed.section_architecture);
    if (sa.length) {
      const missing = sa.filter((s) => !s.present);
      const present = sa.filter((s) => s.present && firstText(s.fix));
      sections.push({
        title: "Section architecture",
        body: [
          missing.length ? `Missing sections: ${missing.map((s) => s.section).join(", ")}` : "All major sections present.",
          ...present.slice(0, 3).map((s) => `${s.section}: ${compact(firstText(s.assessment, s.fix), 200)}`)
        ].filter(Boolean).join("\n")
      });
    }

    const ccm = asArray(parsed.citation_coverage_map);
    const uncited = ccm.filter((c) => !c.citation_present || c.source_strength === "WEAK");
    if (uncited.length) {
      sections.push({
        title: "Citation gaps",
        body: uncited.slice(0, 5).map((c, i) => [
          `${i + 1}. "${compact(firstText(c.claim), 180)}" — ${c.citation_present ? c.source_strength : "NOT CITED"}`,
          firstText(c.fix) ? `   Fix: ${compact(c.fix)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const mcf = asArray(parsed.missing_citation_flags);
    if (mcf.length) {
      sections.push({
        title: "Sentences needing citations",
        body: mcf.slice(0, 5).map((f, i) => [
          `${i + 1}. "${compact(firstText(f.sentence), 200)}"`,
          firstText(f.why) ? `   Why: ${compact(f.why, 160)}` : "",
          firstText(f.needed_source) ? `   Find: ${compact(f.needed_source)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const sql = asArray(parsed.source_quality_ladder);
    const weakSources = sql.filter((s) => s.rating === "WEAK" || s.rating === "NEEDS_REPLACEMENT");
    if (weakSources.length) {
      sections.push({
        title: "Weak sources",
        body: weakSources.slice(0, 4).map((s, i) => [
          `${i + 1}. ${compact(firstText(s.source), 160)} [${firstText(s.type, "?")}] — ${firstText(s.rating)}`,
          firstText(s.problem) ? `   Problem: ${compact(s.problem, 200)}` : "",
          firstText(s.replacement) ? `   Replace with: ${compact(s.replacement)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const coc = parsed.conclusion_overclaim_check || {};
    if (typeof coc.exaggerates === "boolean" || typeof coc.introduces_new_claims === "boolean") {
      sections.push({
        title: "Conclusion integrity",
        body: [
          `Matches evidence: ${coc.matches_evidence ? "Yes" : "No"} — New claims in conclusion: ${coc.introduces_new_claims ? "Yes" : "No"} — Exaggerates: ${coc.exaggerates ? "Yes" : "No"}`,
          firstText(coc.assessment) ? compact(coc.assessment) : ""
        ].filter(Boolean).join("\n")
      });
    }

  } else if (m === 'model-un') {
    const db = parsed.delegate_brief || {};
    if (firstText(db.country) || firstText(db.country_stance)) {
      sections.push({
        title: "Delegate brief",
        body: [
          firstText(db.country) ? `Country: ${compact(db.country, 80)}` : "",
          firstText(db.committee) ? `Committee: ${compact(db.committee, 80)}` : "",
          firstText(db.topic) ? `Topic: ${compact(db.topic, 120)}` : "",
          firstText(db.country_stance) ? `Actual stance: ${compact(db.country_stance)}` : "",
          asArray(db.national_interests).length ? `Interests: ${asArray(db.national_interests).slice(0, 2).join(" | ")}` : "",
          asArray(db.red_lines).length ? `Red lines: ${asArray(db.red_lines).slice(0, 2).join(" | ")}` : "",
          firstText(db.past_un_actions) ? `Past UN actions: ${compact(db.past_un_actions)}` : "",
          asArray(db.useful_facts).length ? `Useful facts: ${asArray(db.useful_facts).slice(0, 2).join(" | ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const sm = parsed.strategy_map || {};
    if (firstText(sm.bloc_strategy) || firstText(sm.negotiation_approach)) {
      sections.push({
        title: "Strategy map",
        body: [
          firstText(sm.bloc_strategy) ? `Bloc: ${compact(sm.bloc_strategy)}` : "",
          firstText(sm.negotiation_approach) ? `Negotiation: ${compact(sm.negotiation_approach)}` : "",
          asArray(sm.countries_to_talk_to_first).length ? `Talk to first: ${asArray(sm.countries_to_talk_to_first).slice(0, 2).join(" | ")}` : "",
          firstText(sm.compromise_to_offer) ? `Compromise: ${compact(sm.compromise_to_offer)}` : "",
          asArray(sm.what_to_avoid_saying).length ? `Avoid saying: ${asArray(sm.what_to_avoid_saying).slice(0, 2).join(" | ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const caucs = asArray(sm.best_caucus_topics);
    if (caucs.length) {
      sections.push({
        title: "Caucus topics",
        body: caucs.slice(0, 3).map((c, i) => [
          `${i + 1}. ${compact(firstText(c.topic), 140)}`,
          firstText(c.why_it_helps) ? `   Why: ${compact(c.why_it_helps, 180)}` : "",
          firstText(c.opening_line) ? `   Opening: "${compact(c.opening_line, 180)}"` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const rc = asArray(parsed.resolution_clauses);
    if (rc.length) {
      sections.push({
        title: "Resolution clauses",
        body: rc.slice(0, 4).map((c, i) => [
          `${i + 1}. ${compact(firstText(c.operative_clause, c.solution), 240)}`,
          `   Realistic: ${c.is_realistic ? "Yes" : "No"} — Too vague: ${c.too_vague ? "Yes" : "No"} — Sovereignty concern: ${c.sovereignty_concern ? "Yes" : "No"}`,
          firstText(c.assessment) ? `   ${compact(c.assessment, 200)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

    const sc = parsed.speech_coach || {};
    if (firstText(sc.delivery_notes) || asArray(sc.questions_delegates_will_ask).length) {
      sections.push({
        title: "Speech coaching",
        body: [
          firstText(sc.delivery_notes) ? `Delivery: ${compact(sc.delivery_notes)}` : "",
          asArray(sc.questions_delegates_will_ask).length ? `Expect: ${asArray(sc.questions_delegates_will_ask).slice(0, 2).join(" | ")}` : "",
          asArray(sc.responses_to_attacks).length ? `Responses: ${asArray(sc.responses_to_attacks).slice(0, 2).join(" | ")}` : ""
        ].filter(Boolean).join("\n")
      });
    }

  } else if (m === 'rubric') {
    const cs = asArray(parsed.criterion_scores);
    if (cs.length) {
      sections.push({
        title: "Rubric scores",
        body: [
          `Total: ${parsed.score_earned ?? "?"}/${parsed.rubric_total_possible ?? "?"} — ${firstText(parsed.percentage)} — ${firstText(parsed.letter_grade)}`,
          ...cs.slice(0, 8).map((c) => [
            `${firstText(c.criterion, "Criterion")}: ${c.score_earned ?? "?"}/${c.score_possible ?? "?"}`,
            firstText(c.reason) ? `  ${compact(c.reason, 200)}` : "",
            firstText(c.evidence_from_text) ? `  Evidence: "${compact(c.evidence_from_text, 120)}"` : "",
            firstText(c.how_to_improve) ? `  Fix: ${compact(c.how_to_improve)}` : ""
          ].filter(Boolean).join("\n"))
        ].filter(Boolean).join("\n\n")
      });
    }

    firstText(parsed.teacher_comment) && sections.push({
      title: "Teacher comment",
      body: compact(parsed.teacher_comment)
    });

    const prp = asArray(parsed.point_recovery_plan);
    if (prp.length) {
      sections.push({
        title: "Point recovery plan",
        body: prp.slice(0, 5).map((p, i) => [
          `${i + 1}. ${compact(firstText(p.action), 200)} (+${p.points_possible ?? "?"} pts)`,
          firstText(p.how_to_do_it) ? `   ${compact(p.how_to_do_it)}` : ""
        ].filter(Boolean).join("\n")).join("\n\n")
      });
    }

  } else {
    // ── Argument mode (default) ──────────────────────────────────────────────
    const thesis = parsed.thesis || {};
    sections.push({
      title: "Thesis check",
      body: [
        firstText(thesis.quote, "No single thesis sentence was detected — the central claim may be implied rather than stated."),
        firstText(thesis.assessment)
      ].filter(Boolean).join("\n")
    });

    const claims = asArray(parsed.claims);
    if (claims.length) {
      sections.push({
        title: "Key claims",
        body: claims.slice(0, 7).map((claim, index) => [
          `${index + 1}. ${compact(firstText(claim.quote, "Claim"), 360)}`,
          firstText(claim.rating) ? `Rating: ${claim.rating}` : "",
          firstText(claim.warrant) ? `Warrant: ${compact(claim.warrant, 240)}` : "",
          firstText(claim.missing_warrant) ? `Missing step: ${compact(claim.missing_warrant, 240)}` : "",
          firstText(claim.diagnosis) ? `Diagnosis: ${compact(claim.diagnosis)}` : "",
          firstText(claim.fix) ? `Repair: ${compact(claim.fix)}` : ""
        ].filter(Boolean).join(" — ")).join("\n")
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

    const collapse = parsed.collapse_point || {};
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
    const strongSent = rhet.strongest_sentence || {};
    const weakSent = rhet.weakest_sentence || {};
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

    const counter = parsed.counterargument || {};
    if (firstText(counter.strongest_objection)) {
      sections.push({
        title: "Strongest counterargument",
        body: [
          compact(counter.strongest_objection, 480),
          firstText(counter.how_to_answer) ? `How to answer: ${compact(counter.how_to_answer)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    // Argument mode_analysis sections
    const modeAnalysis = parsed.mode_analysis || {};

    const iw = modeAnalysis.impact_weighing || {};
    if (firstText(iw.magnitude) || firstText(iw.probability) || firstText(iw.verdict)) {
      sections.push({
        title: "Impact analysis",
        body: [
          firstText(iw.magnitude) ? `Magnitude: ${compact(iw.magnitude)}` : "",
          firstText(iw.probability) ? `Probability: ${compact(iw.probability)}` : "",
          firstText(iw.timeframe) ? `Timeframe: ${compact(iw.timeframe)}` : "",
          firstText(iw.reversibility) ? `Reversibility: ${compact(iw.reversibility)}` : "",
          firstText(iw.uniqueness) ? `Uniqueness: ${compact(iw.uniqueness)}` : "",
          firstText(iw.verdict) ? `Verdict: ${compact(iw.verdict)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const si = modeAnalysis.stock_issues || {};
    if (firstText(si.significance) || firstText(si.inherency) || firstText(si.solvency)) {
      sections.push({
        title: "Stock issues",
        body: [
          firstText(si.significance) ? `Significance: ${compact(si.significance)}` : "",
          firstText(si.inherency) ? `Inherency: ${compact(si.inherency)}` : "",
          firstText(si.solvency) ? `Solvency: ${compact(si.solvency)}` : "",
          firstText(si.weakest_issue) ? `Weakest issue: ${compact(si.weakest_issue)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const ba = modeAnalysis.burden_analysis || {};
    if (firstText(ba.burden_of_proof) || firstText(ba.dropped_burdens)) {
      sections.push({
        title: "Burden of proof",
        body: [
          firstText(ba.burden_of_proof) ? `Must prove: ${compact(ba.burden_of_proof)}` : "",
          typeof ba.burden_met === "boolean" ? `Burden met: ${ba.burden_met ? "Yes" : "Not yet"}` : "",
          firstText(ba.dropped_burdens) ? `Dropped burdens: ${compact(ba.dropped_burdens)}` : ""
        ].filter(Boolean).join("\n")
      });
    }

    const rp = modeAnalysis.rebuttal_prep || {};
    const rpLines = [];
    if (rp.strongest_rebuttal && firstText(rp.strongest_rebuttal.attack)) {
      const r = rp.strongest_rebuttal;
      rpLines.push(`STRONGEST ATTACK: ${compact(r.attack)}`);
      if (firstText(r.targets)) rpLines.push(`  Targets: ${compact(r.targets)}`);
      if (firstText(r.why_dangerous)) rpLines.push(`  Danger: ${compact(r.why_dangerous)}`);
      if (firstText(r.how_to_answer)) rpLines.push(`  Answer: ${compact(r.how_to_answer)}`);
      if (firstText(r.evidence_to_block)) rpLines.push(`  Block with: ${compact(r.evidence_to_block)}`);
    }
    if (rp.easiest_rebuttal && firstText(rp.easiest_rebuttal.attack)) {
      const r = rp.easiest_rebuttal;
      rpLines.push(`\nEASIEST ATTACK: ${compact(r.attack)}`);
      if (firstText(r.why_easy)) rpLines.push(`  Why easy: ${compact(r.why_easy)}`);
      if (firstText(r.how_to_answer)) rpLines.push(`  Answer: ${compact(r.how_to_answer)}`);
    }
    if (rp.sneakiest_rebuttal && firstText(rp.sneakiest_rebuttal.attack)) {
      const r = rp.sneakiest_rebuttal;
      rpLines.push(`\nSNEAKIEST ATTACK: ${compact(r.attack)}`);
      if (firstText(r.why_sneaky)) rpLines.push(`  Why sneaky: ${compact(r.why_sneaky)}`);
      if (firstText(r.how_to_answer)) rpLines.push(`  Answer: ${compact(r.how_to_answer)}`);
    }
    if (rpLines.length) {
      sections.push({ title: "Rebuttal prep", body: rpLines.join("\n") });
    }

    const extraArgs = asArray(modeAnalysis.extra_arguments);
    if (extraArgs.length) {
      sections.push({
        title: "Arguments you're missing",
        body: extraArgs.slice(0, 3).map((ea, i) => {
          const parts = [`${i + 1}. ${compact(firstText(ea.argument), "Make this argument")}`];
          if (firstText(ea.why_important)) parts.push(`   Why: ${compact(ea.why_important)}`);
          if (firstText(ea.how_to_add)) parts.push(`   Add: ${compact(ea.how_to_add)}`);
          if (firstText(ea.search_terms)) parts.push(`   Search: ${compact(ea.search_terms)}`);
          return parts.join("\n");
        }).join("\n\n")
      });
    }
  }

  // ── Shared footer: revision path ──────────────────────────────────────────
  if (m !== 'rubric') {
    sections.push({
      title: "Revision path",
      body: fixes.length
        ? fixes.slice(0, 5).map((fix, index) => `${index + 1}. ${compact(firstText(fix.exact_fix, fix.problem, "Repair this issue."), 520)}`).join("\n")
        : "This draft is in strong shape — focus on the refinements noted above rather than structural repairs."
    });
  }

  return sections.filter((section) => firstText(section.body));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamReadableAudit(res, audit, mode) {
  writeSse(res, { fracture_report_start: true });
  const sections = readableAuditSections(audit, mode);
  for (const section of sections) {
    writeSse(res, { fracture_report_delta: { title: section.title, body: section.body } });
    await sleep(18);
  }
  // Note: fracture_report_done is emitted by finish() after optional source sections.
}

async function finish(res, audit, recovered = false, options = {}) {
  writeProgress(res, recovered ? 91 : 90, recovered ? "Recovered a stable report" : "Turning JSON into the readable report");
  await streamReadableAudit(res, audit, options.mode);

  // Attach the citation/source report. The web search already ran BEFORE grading
  // (so the model graded against real evidence); reuse that result here instead of
  // searching again. Only search now as a fallback if it wasn't pre-computed.
  let finalAudit = audit;
  const skipSourceVerification = options.mode === 'speech';
  if (!skipSourceVerification && options.essay && !isTooThinForAudit(options.essay)) {
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
  const maxTokens = depth === "surface" ? 2600 : depth === "extreme" ? 6500 : 4800;
  const citationStyle = req.body?.preferences?.citationStyle;
  const mode = String(req.body?.preferences?.analysisFormat || "argument").toLowerCase();

  // STEP 1 — Check factual claims against the live web before grading.
  // Skip for speech mode: personal speeches rely on anecdote and named sources, not
  // page-verified URLs, so web check results add noise rather than signal.
  let sourceData = null;
  let evidenceContext = "";
  if (mode !== "speech") {
    try {
      writeProgress(res, 12, "Checking the draft's claims against the live web");
      sourceData = await verifySources({ essay, citationStyle: String(citationStyle || "mla").toLowerCase() === "apa" ? "apa" : "mla" });
      evidenceContext = buildEvidenceContext(sourceData);
    } catch (_) {
      sourceData = null;
    }
  }

  // STEP 2 — Grade, with the live evidence findings in the prompt.
  let upstream;
  try {
    writeProgress(res, 22, "Grading against the verified evidence");
    upstream = await openRouterStream({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: buildAuditMessages(essay, req.body?.preferences, evidenceContext),
      maxTokens,
      temperature: 0.55,
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
  return await finish(res, audit, recovered, { essay, citationStyle, sourceData, mode });
}
