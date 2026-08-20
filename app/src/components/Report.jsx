import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, X, Link2, Flag } from "lucide-react";
import { cx, prettyLabel } from "../lib/ui.js";
import { useAuth } from "../lib/useAuth.jsx";
import { saveReportRating } from "../lib/firebase.js";
import { RATING_OPTIONS, rateReportLocally, getLocalRating } from "../lib/feedback.js";
import { openFeedbackModal } from "./FeedbackModal.jsx";

/* ────────────────────────────────────────────────────────────────────────────
   Small shared UI atoms
──────────────────────────────────────────────────────────────────────────── */

export function CopyBtn({ text, label = "Copy", small = true }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (_e) {}
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1400);
  }
  return (
    <button onClick={copy} className={cx(
      "inline-flex items-center gap-1.5 rounded-sm border hair px-2 py-1 text-xs font-medium",
      "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors",
      small ? "" : "px-3 py-1.5"
    )}>
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "Copied" : label}
    </button>
  );
}

/* A clickable quote that jumps back to the source text. */
function Quote({ text, onQuote, className }) {
  if (!text) return null;
  return (
    <button
      onClick={() => onQuote && onQuote(text)}
      title="Show in your draft"
      className={cx(
        "text-left rounded-sm px-2 py-1 -mx-2 border-l-2 border-zinc-300 dark:border-zinc-700",
        "bg-zinc-100/70 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 italic font-serif",
        "hover:border-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-[15px] leading-relaxed",
        className
      )}
    >
      “{text}”
    </button>
  );
}

function RatingBadge({ value }) {
  const v = String(value || "").toUpperCase();
  const styles = {
    STRONG: "bg-green-500/15 text-green-600 dark:text-green-400",
    MODERATE: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    WEAK: "bg-red-500/15 text-red-600 dark:text-red-400",
    HIGH: "bg-red-500/15 text-red-600 dark:text-red-400",
    MEDIUM: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    LOW: "bg-green-500/15 text-green-600 dark:text-green-400",
    FATAL: "bg-red-500/20 text-red-600 dark:text-red-400",
    CRITICAL: "bg-red-500/20 text-red-600 dark:text-red-400",
    MAJOR: "bg-red-500/15 text-red-600 dark:text-red-400",
    MINOR: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400"
  };
  const label = v === "FATAL" ? "Fatal" : v.charAt(0) + v.slice(1).toLowerCase();
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide", styles[v] || styles.MODERATE)}>
      {label}
    </span>
  );
}

function SourceStatusBadge({ status }) {
  const s = String(status || "needs_review").toLowerCase();
  const map = {
    likely_supported: { label: "Likely supported", cls: "bg-green-500/15 text-green-600 dark:text-green-400" },
    partial_match: { label: "Partial match", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    possible_conflict: { label: "Possible conflict", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    source_not_found: { label: "Source not found", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    quote_not_supported: { label: "Quote not found", cls: "bg-red-500/15 text-red-600 dark:text-red-400" },
    citation_incomplete: { label: "Incomplete citation", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    source_too_vague: { label: "Too vague to match", cls: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400" }
  };
  const m = map[s] || { label: "Needs review", cls: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400" };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-mono", m.cls)}>{m.label}</span>;
}

function Chip({ on = true, yes = "Yes", no = "No" }) {
  return on
    ? <span className="inline-flex items-center gap-1 text-[11px] font-mono text-green-600 dark:text-green-400"><Check size={12} /> {yes}</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-mono text-red-500 dark:text-red-400"><X size={12} /> {no}</span>;
}

function Field({ label, children }) {
  if (!children) return null;
  return (
    <div>
      {label && <div className="label-mono mb-1">{label}</div>}
      <div className="muted text-sm leading-relaxed whitespace-pre-line">{children}</div>
    </div>
  );
}

function Section({ id, kicker, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-b hair pb-7 pt-2">
      {kicker && <div className="label-mono mb-1">{kicker}</div>}
      <h3 className="font-serif text-xl mb-3">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────────────────── */

function arr(v) { return Array.isArray(v) ? v : []; }
function str(...vals) { for (const v of vals) { if (typeof v === "string" && v.trim()) return v.trim(); } return ""; }

const QUOTE_KEYS = new Set([
  "quote", "claim", "text", "sentence", "passage", "original_text", "current_hook",
  "evidence_from_text", "topic_sentence", "current", "original", "example", "question",
  "operative_clause", "solution", "central_idea", "detected_question", "assumption",
  "attack", "steelman", "problem", "reason", "gap", "criterion"
]);

function isQuoteKey(key) {
  return QUOTE_KEYS.has(String(key).toLowerCase());
}

/* ────────────────────────────────────────────────────────────────────────────
   Generic renderer for mode-specific data (handles any lean schema shape)
──────────────────────────────────────────────────────────────────────────── */

function renderObjectCard(obj, onQuote, depth = 0) {
  if (!obj || typeof obj !== "object") return null;
  const keys = Object.keys(obj).filter((k) => {
    const v = obj[k];
    if (v == null || v === "" || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
  if (!keys.length) return null;

  return (
    <div className="space-y-2">
      {keys.map((k) => {
        const v = obj[k];
        if (Array.isArray(v)) {
          return (
            <div key={k}>
              <div className="label-mono mb-1">{prettyLabel(k)}</div>
              <div className="space-y-2">
                {v.map((item, i) => (
                  <div key={i} className="pl-3 border-l hair">
                    {typeof item === "object" && item !== null
                      ? renderObjectCard(item, onQuote, depth + 1)
                      : <span className="muted text-sm whitespace-pre-line">{String(item)}</span>}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (typeof v === "boolean") {
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="label-mono">{prettyLabel(k)}</span><Chip on={v} />
            </div>
          );
        }
        if (isQuoteKey(k) && onQuote && typeof v === "string" && v.length > 6 && v.length < 600) {
          return (
            <div key={k}>
              <div className="label-mono mb-1">{prettyLabel(k)}</div>
              <Quote text={v} onQuote={onQuote} />
            </div>
          );
        }
        return <Field key={k} label={prettyLabel(k)}>{String(v)}</Field>;
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Report
──────────────────────────────────────────────────────────────────────────── */

export default function Report({ audit, essay, mode, onQuote, onAskAbout }) {
  if (!audit || typeof audit !== "object") return null;

  const a = audit;
  const score = typeof a.overall_score === "number" ? a.overall_score : null;
  const fixes = arr(a.priority_fixes);
  const claims = (arr(a.claims).length ? arr(a.claims) : arr(a.argument_strength?.claims));
  const assumptions = arr(a.assumption_audit);
  const fallacies = arr(a.logical_fallacies);
  const attacks = arr(a.attack_tree);
  const strengths = arr(a.strengths);
  const sources = a.source_verification_report;
  const graph = a.argument_dependency_graph || {};
  const graphLinks = arr(graph.links);

  // Rebuttal prep lives in mode_analysis for argument mode.
  const rebuttalPrep = a.mode_analysis?.rebuttal_prep || {};
  const attackSources = attacks.length ? attacks : [
    ...(rebuttalPrep.strongest_rebuttal ? [{ ...rebuttalPrep.strongest_rebuttal, _label: "Strongest attack" }] : []),
    ...(rebuttalPrep.easiest_rebuttal ? [{ ...rebuttalPrep.easiest_rebuttal, _label: "Easiest attack" }] : []),
    ...(rebuttalPrep.sneakiest_rebuttal ? [{ ...rebuttalPrep.sneakiest_rebuttal, _label: "Sneakiest attack" }] : [])
  ];

  const sections = [];
  const push = (id, kicker, title, body) => body && sections.push({ id, kicker, title, body });

  // 1. Verdict / coaching note
  push("at-a-glance", "Fracture Engine", "Verdict", (a.verdict || a.coaching_note) && (
    <div className="space-y-3">
      {a.verdict && <p className="text-[15px] leading-relaxed">{a.verdict}</p>}
      {a.coaching_note && (
        <div className="card bg-zinc-50 dark:bg-zinc-900/40 p-4">
          <div className="label-mono mb-1">Where to start</div>
          <p className="muted text-sm leading-relaxed">{a.coaching_note}</p>
        </div>
      )}
    </div>
  ));

  // 2. Priority fixes
  push("priorities", "Fix in this order", `${fixes.length} priority ${fixes.length === 1 ? "repair" : "repairs"}`, fixes.length > 0 && (
    <div className="space-y-3">
      {fixes.map((f, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs faint">#{i + 1}</span>
            <RatingBadge value={f.fatality || "major"} />
            {f.quote && <Quote text={f.quote} onQuote={onQuote} className="ml-auto" />}
          </div>
          <p className="text-sm font-medium mb-2">{f.problem || "Repair this pressure point."}</p>
          {f.why_it_matters && <Field label="Why it matters">{f.why_it_matters}</Field>}
          {f.exact_fix && <Field label="The fix">{f.exact_fix}</Field>}
          {f.rewrite && (
            <div className="mt-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-sm p-3 border hair">
              <div className="flex items-center justify-between mb-1">
                <span className="label-mono">Rewrite</span>
                <CopyBtn text={f.rewrite} />
              </div>
              <p className="text-sm leading-relaxed font-serif italic">“{f.rewrite}”</p>
            </div>
          )}
          {onAskAbout && (
            <button onClick={() => onAskAbout(f.quote || f.problem)}
              className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50">
              Ask Fracture about this
            </button>
          )}
        </div>
      ))}
    </div>
  ));

  // 3. Collapse point
  const cp = a.collapse_point;
  push("collapse-point", "Load-bearing claim", "Collapse point", cp && (cp.quote || cp.why_it_collapses) && (
    <div className="card p-4 border-red-200 dark:border-red-900/60">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          {cp.quote && <Quote text={cp.quote} onQuote={onQuote} />}
          {cp.why_it_collapses && <p className="muted text-sm leading-relaxed">{cp.why_it_collapses}</p>}
          {typeof cp.survival_probability === "number" && (
            <div className="flex items-center gap-2 text-xs font-mono faint">
              <span>Survival under attack</span>
              <span className="text-zinc-950 dark:text-zinc-50">{cp.survival_probability}%</span>
            </div>
          )}
          {cp.strongest_attack && <Field label="Strongest attack">{cp.strongest_attack}</Field>}
          {cp.strongest_defense && <Field label="Best defense">{cp.strongest_defense}</Field>}
        </div>
      </div>
    </div>
  ));

  // 4. Argument map
  push("argument-map", "How it connects", "Argument map", graphLinks.length > 0 && (
    <div className="space-y-3">
      {graph.explanation && <p className="muted text-sm leading-relaxed">{graph.explanation}</p>}
      <div className="space-y-2">
        {graphLinks.slice(0, 12).map((l, i) => (
          <div key={i} className="card p-3">
            <div className="flex flex-col gap-1.5">
              <Quote text={l.from} onQuote={onQuote} />
              <div className="flex items-center gap-2 px-1 text-[11px] font-mono faint">
                <Link2 size={12} className="shrink-0" />
                <span className="capitalize">{l.relationship || "supports"}</span>
                <RatingBadge value={l.strength || "moderate"} />
              </div>
              <Quote text={l.to} onQuote={onQuote} />
            </div>
            {l.risk && <p className="muted text-xs leading-relaxed mt-2">{l.risk}</p>}
          </div>
        ))}
      </div>
    </div>
  ));

  // 5. Claims
  push("claims", "Claim-by-claim", "Key claims", claims.length > 0 && (
    <div className="space-y-2">
      {claims.map((c, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-start gap-2 mb-2">
            <RatingBadge value={c.rating} />
            <Quote text={c.quote} onQuote={onQuote} className="flex-1" />
          </div>
          <div className="space-y-2">
            {c.warrant && <Field label="Warrant">{c.warrant}</Field>}
            {c.missing_warrant && <Field label="Missing step">{c.missing_warrant}</Field>}
            {c.diagnosis && <Field label="Diagnosis">{c.diagnosis}</Field>}
            {c.fix && <Field label="Repair">{c.fix}</Field>}
          </div>
        </div>
      ))}
    </div>
  ));

  // 6. Assumptions
  push("assumptions", "Unstated premises", "Hidden assumptions", assumptions.length > 0 && (
    <div className="space-y-2">
      {assumptions.map((s, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <RatingBadge value={s.load_bearing || "medium"} />
            <p className="text-sm font-medium">{s.assumption}</p>
          </div>
          <div className="space-y-2">
            {s.if_rejected && <Field label="If rejected">{s.if_rejected}</Field>}
            {s.how_to_defend && <Field label="How to defend">{s.how_to_defend}</Field>}
          </div>
        </div>
      ))}
    </div>
  ));

  // 7. Attacks / rebuttal prep
  push("attacks", "Opponent prep", "Attacks & rebuttals", attackSources.length > 0 && (
    <div className="space-y-2">
      {attackSources.map((t, i) => (
        <div key={i} className="card p-4">
          <div className="label-mono mb-1">{t._label || (t.rank ? `Attack ${t.rank}` : `Attack ${i + 1}`)}</div>
          <p className="text-sm font-medium mb-2">{t.attack}</p>
          <div className="space-y-2">
            {t.targets && <Field label="Targets">{t.targets}</Field>}
            {t.why_dangerous && <Field label="Why it's dangerous">{t.why_dangerous}</Field>}
            {t.response && <Field label="Your response">{t.response}</Field>}
            {t.how_to_answer && <Field label="Your response">{t.how_to_answer}</Field>}
            {t.crossfire_question && <Field label="Crossfire question">{t.crossfire_question}</Field>}
          </div>
        </div>
      ))}
    </div>
  ));

  // 8. Counterargument
  const ca = a.counterargument || {};
  push("counterargument", "Steelmanned", "Counterargument", (ca.strongest_objection || ca.how_to_answer) && (
    <div className="card p-4">
      {ca.strongest_objection && <Field label="Strongest objection">{ca.strongest_objection}</Field>}
      {ca.how_to_answer && <Field label="How to answer">{ca.how_to_answer}</Field>}
    </div>
  ));

  // 9. Fallacies
  push("fallacies", "Reasoning errors", "Logical fallacies", fallacies.length > 0 && (
    <div className="space-y-2">
      {fallacies.map((f, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs uppercase tracking-wide text-red-500">{f.name}</span>
            {f.quote && <Quote text={f.quote} onQuote={onQuote} className="ml-auto" />}
          </div>
          <div className="space-y-2">
            {f.explanation && <Field label="Why">{f.explanation}</Field>}
            {f.fix && <Field label="Fix">{f.fix}</Field>}
          </div>
        </div>
      ))}
    </div>
  ));

  // 10. Rhetoric
  const ra = a.rhetorical_analysis || {};
  push("rhetoric", "Best & weakest", "Rhetorical analysis", (ra.strongest_sentence?.quote || ra.weakest_sentence?.quote) && (
    <div className="space-y-2">
      {ra.strongest_sentence?.quote && (
        <div className="card p-4">
          <div className="label-mono mb-1">Strongest sentence</div>
          <Quote text={ra.strongest_sentence.quote} onQuote={onQuote} />
          {ra.strongest_sentence.why && <p className="muted text-sm mt-2 leading-relaxed">{ra.strongest_sentence.why}</p>}
        </div>
      )}
      {ra.weakest_sentence?.quote && (
        <div className="card p-4">
          <div className="label-mono mb-1">Weakest sentence</div>
          <Quote text={ra.weakest_sentence.quote} onQuote={onQuote} />
          {ra.weakest_sentence.why && <p className="muted text-sm mt-2 leading-relaxed">{ra.weakest_sentence.why}</p>}
          {ra.weakest_sentence.fix && (
            <div className="mt-2 bg-zinc-50 dark:bg-zinc-900/50 rounded-sm p-3 border hair">
              <div className="flex items-center justify-between mb-1">
                <span className="label-mono">Rewrite</span>
                <CopyBtn text={ra.weakest_sentence.fix} />
              </div>
              <p className="text-sm leading-relaxed font-serif italic">“{ra.weakest_sentence.fix}”</p>
            </div>
          )}
        </div>
      )}
    </div>
  ));

  // 11. Strengths
  push("strengths", "What works", "Strengths", strengths.length > 0 && (
    <div className="space-y-2">
      {strengths.map((s, i) => (
        <div key={i} className="card p-4">
          <Quote text={s.quote} onQuote={onQuote} />
          {s.why && <p className="muted text-sm mt-2 leading-relaxed">{s.why}</p>}
        </div>
      ))}
    </div>
  ));

  // 12. Thesis
  const thesis = a.thesis || a.argument_strength?.thesis;
  push("thesis", "Central claim", "Thesis", thesis && (thesis.quote || thesis.assessment) && (
    <div className="card p-4">
      {thesis.quote && <Quote text={thesis.quote} onQuote={onQuote} />}
      {thesis.assessment && <p className="muted text-sm mt-2 leading-relaxed">{thesis.assessment}</p>}
    </div>
  ));

  // 13. Rubric scores
  const criteria = arr(a.criterion_scores);
  push("rubric-scores", "Criterion by criterion", "Rubric scores", criteria.length > 0 && (
    <div className="space-y-2">
      <div className="card p-4 flex items-center justify-between">
        <span className="font-serif text-2xl">{a.score_earned ?? "?"}/{a.rubric_total_possible ?? "?"}</span>
        <span className="text-sm muted">{str(a.percentage)} {str(a.letter_grade) && `· ${a.letter_grade}`}</span>
      </div>
      {criteria.map((c, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{c.criterion}</span>
            <span className="font-mono text-sm">{c.score_earned ?? "?"}/{c.score_possible ?? "?"}</span>
          </div>
          <div className="space-y-2">
            {c.reason && <Field label="Why">{c.reason}</Field>}
            {c.evidence_from_text && <Field label="Evidence"><Quote text={c.evidence_from_text} onQuote={onQuote} /></Field>}
            {c.how_to_improve && <Field label="To earn more">{c.how_to_improve}</Field>}
          </div>
        </div>
      ))}
      {a.teacher_comment && (
        <div className="card p-4">
          <div className="label-mono mb-1">Teacher comment</div>
          <p className="muted text-sm leading-relaxed">{a.teacher_comment}</p>
        </div>
      )}
      {arr(a.point_recovery_plan).length > 0 && (
        <div className="card p-4">
          <div className="label-mono mb-2">Point recovery plan</div>
          {arr(a.point_recovery_plan).map((p, i) => (
            <div key={i} className="py-1.5 border-t hair first:border-0 first:pt-0">
              <p className="text-sm">{p.action} <span className="font-mono text-green-600 dark:text-green-400">+{p.points_possible ?? "?"}</span></p>
              {p.how_to_do_it && <p className="muted text-xs mt-0.5">{p.how_to_do_it}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  ));

  // 14. Mode-specific sections (generic renderer for everything else)
  const modeSections = renderModeSections(a, mode, onQuote);
  modeSections.forEach((ms) => push(ms.id, ms.kicker, ms.title, ms.body));

  // 15. Sources
  push("sources", "Live web check", "Sources & citations", sources && (
    <SourcePanel sources={sources} onQuote={onQuote} />
  ));

  const projectKey = [
    String(essay || "").length,
    (essay || "").trim().slice(0, 32),
    score ?? "",
    mode
  ].join("|");

  return (
    <div>
      {sections.length > 1 && (
        <nav aria-label="Report sections" className="flex flex-wrap gap-1.5 mb-5">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}
              className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-mono border hair text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              {s.title}
            </a>
          ))}
        </nav>
      )}
      <div className="space-y-0">
        {sections.map((s) => (
          <Section key={s.id} id={s.id} kicker={s.kicker} title={s.title}>
            {s.body}
          </Section>
        ))}
      </div>

      <ReportRating projectKey={projectKey} mode={mode} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Feedback correction: rate this report, report a problem
──────────────────────────────────────────────────────────────────────────── */

function ReportRating({ projectKey, mode }) {
  const { user } = useAuth();
  const [value, setValue] = useState(() => getLocalRating(projectKey)?.value || null);
  const [busy, setBusy] = useState(false);

  async function rate(v) {
    setValue(v);
    setBusy(true);
    rateReportLocally(projectKey, v);
    if (user) {
      try { await saveReportRating(user.id, { projectKey, value: v, mode }); } catch (_) {}
    }
    setBusy(false);
  }

  return (
    <div className="border-t hair pt-5 mt-5">
      <div className="label-mono mb-2">Was this report accurate?</div>
      <div className="flex flex-wrap gap-2">
        {RATING_OPTIONS.map((opt) => (
          <button key={opt.id} onClick={() => rate(opt.id)} disabled={busy}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              value === opt.id ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900 " + opt.cls : "hair muted hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => openFeedbackModal({ type: "incorrect-feedback", context: `mode: ${mode || "argument"} · report key: ${projectKey.slice(0, 40)}` })}
        className="mt-2 inline-flex items-center gap-1 text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">
        <Flag size={12} /> Something specific was wrong — tell us what
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Source verification panel
──────────────────────────────────────────────────────────────────────────── */

function SourcePanel({ sources, onQuote }) {
  const summary = sources.summary || {};
  const claims = arr(sources.claims);
  const leads = arr(sources.research_suggestions);
  const works = arr(sources.works_cited);

  const totals = {
    "Likely supported": summary.likely_supported,
    "Needs review": (Number(summary.needs_source_review) || 0) + (Number(summary.citation_incomplete) || 0) + (Number(summary.source_not_found) || 0) + (Number(summary.partial_match) || 0)
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {Object.entries(totals).map(([label, v]) => (
          <div key={label} className="card px-4 py-3">
            <div className="font-serif text-2xl">{Number(v) || 0}</div>
            <div className="label-mono">{label}</div>
          </div>
        ))}
      </div>
      {summary.note && <p className="muted text-sm leading-relaxed">{summary.note}</p>}

      {claims.length > 0 && (
        <div className="space-y-2">
          <div className="label-mono">Claims checked</div>
          {claims.map((c, i) => (
            <div key={i} className="card p-4">
              <div className="flex items-start gap-2 mb-2">
                <SourceStatusBadge status={c.support_status} />
                <Quote text={str(c.claim, c.text)} onQuote={onQuote} className="flex-1" />
              </div>
              {c.verification_note && <p className="muted text-sm leading-relaxed">{c.verification_note}</p>}
              {arr(c.sources).length > 0 && (
                <div className="mt-2 space-y-1">
                  {arr(c.sources).slice(0, 3).map((s, j) => (
                    <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50">
                      <ExternalLink size={12} /> {str(s.title, s.site_name, "Source")}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {leads.length > 0 && (
        <div className="space-y-2">
          <div className="label-mono">Research leads</div>
          {leads.map((l, i) => (
            <div key={i} className="card p-4">
              <p className="text-sm font-medium">{str(l.title, l.label)}</p>
              {l.explanation && <p className="muted text-sm leading-relaxed mt-1">{l.explanation}</p>}
              {arr(l.links).length > 0 && (
                <div className="mt-2 space-y-1">
                  {arr(l.links).slice(0, 3).map((s, j) => (
                    <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50">
                      <ExternalLink size={12} /> {str(s.title, s.site_name, "Link")}
                    </a>
                  ))}
                </div>
              )}
              {l.search_query && !arr(l.links).length && <p className="muted text-xs mt-1">Search: {l.search_query}</p>}
            </div>
          ))}
        </div>
      )}

      {works.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="label-mono">{str(sources.bibliography_title, "Works cited")}</div>
            <CopyBtn text={works.map((w) => str(w.entry, w.citation, w.mla, w.apa, w.url)).join("\n")} label="Copy all" />
          </div>
          <ol className="space-y-1.5 list-decimal list-inside text-sm muted">
            {works.map((w, i) => (
              <li key={i}>{str(w.entry, w.citation, w.mla, w.apa, w.url)}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Mode-specific sections — declarative list of {key, title, kicker}
──────────────────────────────────────────────────────────────────────────── */

function renderModeSections(a, mode, onQuote) {
  const m = String(mode || "argument").toLowerCase();
  const configs = {
    speech: [
      ["hook_analysis", "Hook analysis", "Opening"],
      ["audience_clarity", "Audience clarity", "Will they follow it?"],
      ["delivery_markup", "Delivery markup", "How to say it"],
      ["delivery_risks", "Delivery risks", "Where you'll stumble"],
      ["memorability_check", "Memorability", "What sticks"],
      ["call_to_action", "Call to action", "The ending"],
      ["audience_questions", "Audience questions", "What they'll ask"],
      ["structure_analysis", "Structure", "Shape of the speech"],
      ["persuasion_check", "Persuasion", "Why it convinces"],
      ["visual_aid_suggestions", "Visual aids", "Slides that help"]
    ],
    essay: [
      ["main_point_check", "Main point", "The central idea"],
      ["paragraph_map", "Paragraph map", "Section by section"],
      ["evidence_integration", "Evidence integration", "Is it explained?"],
      ["flow_and_transitions", "Flow & transitions", "How it moves"],
      ["redundancy_check", "Redundancy", "What to cut"],
      ["grammar_style", "Grammar & style", "Polish"],
      ["conclusion_strength", "Conclusion", "The ending"],
      ["quote_analysis", "Quote analysis", "How evidence lands"]
    ],
    "college-essay": [
      ["thesis_pressure_test", "Thesis pressure test", "Does it hold?"],
      ["paragraph_architecture", "Paragraph architecture", "Section by section"],
      ["evidence_analysis_balance", "Evidence vs. analysis", "Summary or argument?"],
      ["close_reading_audit", "Close reading", "Reading the words"],
      ["counterargument_quality", "Counterargument", "Does it engage?"],
      ["academic_voice_coach", "Academic voice", "Tone"],
      ["professor_lens", "Professor's lens", "Margin comments"],
      ["conclusion_check", "Conclusion", "The ending"]
    ],
    "research-paper": [
      ["research_question_audit", "Research question", "What it answers"],
      ["research_alignment_map", "Alignment", "Does it stay on track?"],
      ["section_architecture", "Sections", "What's present"],
      ["citation_coverage_map", "Citation coverage", "What's cited"],
      ["missing_citation_flags", "Missing citations", "What needs a source"],
      ["source_quality_ladder", "Source quality", "Trust the sources?"],
      ["evidence_fit_test", "Evidence fit", "Right evidence for the claim"],
      ["literature_review_audit", "Literature review", "Synthesis vs. summary"],
      ["conclusion_overclaim_check", "Conclusion integrity", "Does it overclaim?"]
    ],
    "model-un": [
      ["delegate_brief", "Delegate brief", "Country & stance"],
      ["writing_audit", "Writing audit", "Position paper quality"],
      ["strategy_map", "Strategy map", "Blocs & caucuses"],
      ["resolution_clauses", "Resolution clauses", "Operative language"],
      ["speech_coach", "Speech coach", "Delivery"],
      ["source_pack", "Source pack", "What to cite"],
      ["policy_accuracy_check", "Policy accuracy", "Would the country say this?"]
    ]
  };

  const list = configs[m] || [];
  const out = [];

  list.forEach(([key, title, kicker]) => {
    const val = a[key];
    if (val == null) return;
    if (Array.isArray(val) && val.length === 0) return;
    if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return;
    out.push({
      id: "mode-" + key,
      kicker,
      title,
      body: (
        <div className="card p-4">
          {Array.isArray(val)
            ? <div className="space-y-3">{val.map((item, i) => <div key={i} className="border-t hair first:border-0 first:pt-0 pt-3">{renderObjectCard(item, onQuote)}</div>)}</div>
            : renderObjectCard(val, onQuote)}
        </div>
      )
    });
  });

  // Argument mode's mode_analysis (impact weighing, stock issues, burden, extra args)
  if (m === "argument") {
    const ma = a.mode_analysis || {};
    const argSections = [
      ["impact_weighing", "Impact analysis", "Magnitude & probability"],
      ["stock_issues", "Stock issues", "Policy structure"],
      ["burden_analysis", "Burden of proof", "What must be proven"],
      ["extra_arguments", "Missing arguments", "What to add"]
    ];
    argSections.forEach(([key, title, kicker]) => {
      const val = ma[key];
      if (val == null) return;
      if (Array.isArray(val) && val.length === 0) return;
      if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return;
      out.push({
        id: "mode-" + key,
        kicker,
        title,
        body: (
          <div className="card p-4">
            {Array.isArray(val)
              ? <div className="space-y-3">{val.map((item, i) => <div key={i} className="border-t hair first:border-0 first:pt-0 pt-3">{renderObjectCard(item, onQuote)}</div>)}</div>
              : renderObjectCard(val, onQuote)}
          </div>
        )
      });
    });

    // Truth audit + alternative solutions test (legacy top-level)
    if (arr(a.truth_audit).length) {
      out.push({
        id: "mode-truth-audit", kicker: "Fact check", title: "Claims to verify",
        body: <div className="card p-4 space-y-3">{arr(a.truth_audit).map((t, i) => <div key={i} className="border-t hair first:border-0 first:pt-0 pt-3">{renderObjectCard(t, onQuote)}</div>)}</div>
      });
    }
    if (arr(a.alternative_solutions_test).length) {
      out.push({
        id: "mode-alternatives", kicker: "Alternatives", title: "Competing approaches",
        body: <div className="card p-4 space-y-3">{arr(a.alternative_solutions_test).map((t, i) => <div key={i} className="border-t hair first:border-0 first:pt-0 pt-3">{renderObjectCard(t, onQuote)}</div>)}</div>
      });
    }
  }

  return out;
}
