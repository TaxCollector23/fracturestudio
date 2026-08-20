import {
  Sparkles, Download, Save, MessageSquare, Send, Loader2, Swords,
  FileText, RotateCcw
} from "lucide-react";
import { exportPdf } from "../lib/api.js";
import { FORMATS, DEPTHS, formatById, depthById } from "../lib/prefs.js";
import { useAudit } from "../lib/useAudit.js";
import { useChat } from "../lib/useChat.js";
import { breakdownBars, scoreLabel } from "../lib/ui.js";
import Report from "../components/Report.jsx";
import OnboardingModal from "../components/OnboardingModal.jsx";

const SAMPLE = `Resolved: High schools should start no earlier than 9:00 a.m.

Schools must delay start times to 9:00 a.m. because sleep deprivation harms students. The CDC reports that most teenagers get less than seven hours of sleep on school nights, and the American Academy of Pediatrics recommends 8.5 to 9.5 hours for adolescents. Because early bells force students to wake before their natural circadian rhythm, they arrive at first period too tired to learn, which means their grades suffer and their health declines. Therefore, delaying the bell would improve both academic outcomes and student well-being.`;

export default function Studio() {
  const auditFlow = useAudit();
  const {
    essay, setEssay, rubric, setRubric, prefs, setPref,
    running, progress, sections, audit, error, saved, saving,
    essayRef, run, jumpToQuote, clear, save, copyReport, buildRebuttals
  } = auditFlow;
  const chat = useChat({ draft: essay, audit });

  const score = audit?.overall_score;
  const dims = breakdownBars(audit?.score_breakdown);
  const mode = formatById(prefs.analysisFormat);
  const depth = depthById(prefs.depthLevel);

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <header className="mb-8">
        <div className="label-mono mb-2">Studio / Argument Audit</div>
        <h1 className="font-serif text-4xl md:text-5xl">Fracture the draft. <span className="italic muted">Plan the repair.</span></h1>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
        {/* ── Input ─────────────────────────────────────────────────────── */}
        <section className="card p-5 flex flex-col lg:sticky lg:top-20">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="label-mono mb-1.5">Analysis mode</label>
              <select value={prefs.analysisFormat} onChange={(e) => setPref("analysisFormat", e.target.value)} className="field">
                {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <p className="faint text-xs mt-1.5 leading-relaxed">{mode.hint}</p>
            </div>
            <div>
              <label className="label-mono mb-1.5">Citation style</label>
              <select value={prefs.citationStyle} onChange={(e) => setPref("citationStyle", e.target.value)} className="field">
                <option value="mla">MLA</option>
                <option value="apa">APA</option>
              </select>
            </div>
            <div>
              <label className="label-mono mb-1.5">Depth</label>
              <select value={prefs.depthLevel} onChange={(e) => setPref("depthLevel", e.target.value)} className="field">
                {DEPTHS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <div className="rounded-sm bg-zinc-50 dark:bg-zinc-900/50 border hair px-3 py-2 text-xs muted leading-relaxed">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{depth.label}:</span> {depth.blurb}
              </div>
            </div>
          </div>

          {prefs.analysisFormat === "rubric" && (
            <div className="mb-3">
              <label className="label-mono mb-1.5">Rubric (optional)</label>
              <textarea value={rubric} onChange={(e) => setRubric(e.target.value)}
                placeholder="Paste your rubric here. Fracture grades your draft against each criterion."
                className="field min-h-[110px] resize-y leading-relaxed font-sans" />
              <p className="faint text-xs mt-1.5">Leave blank to paste the rubric below your draft instead.</p>
            </div>
          )}

          <textarea ref={essayRef} value={essay} onChange={(e) => setEssay(e.target.value)}
            placeholder="Paste your speech, essay, debate case, position paper, or research paper here…"
            className="field flex-1 min-h-[300px] resize-y leading-relaxed font-sans" />

          <div className="flex items-center justify-between mt-3">
            <span className="faint text-xs font-mono">{essay.trim() ? essay.trim().length.toLocaleString() : 0} chars</span>
            <div className="flex gap-2">
              <button onClick={clear} className="btn-ghost py-2 px-3.5 text-xs">Clear</button>
              <button onClick={run} disabled={running || !auditFlow.payload().trim()} className="btn-solid py-2 px-5 text-sm">
                {running ? <><Loader2 size={15} className="animate-spin" /> Fracturing…</> : <><Sparkles size={15} /> Fracture It</>}
              </button>
            </div>
          </div>

          {running && (
            <div className="mt-4">
              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-950 dark:bg-zinc-100 rounded-full transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.max(progress.progress, 4)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="faint text-xs font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-zinc-100 animate-pulse" />
                  {progress.message || "Working…"}
                </p>
                <span className="faint text-xs font-mono">{Math.round(progress.progress)}%</span>
              </div>
            </div>
          )}
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </section>

        {/* ── Report ────────────────────────────────────────────────────── */}
        <section className="min-h-[460px]">
          {!audit && !running && (
            <div className="card h-full flex flex-col items-center justify-center text-center py-20 px-8">
              <Sparkles size={28} className="faint mb-4" />
              <p className="muted max-w-sm mb-5">Your Fracture report appears here — score, collapse point, claim map, hidden assumptions, opponent attacks, evidence checks, and a revision plan.</p>
              <button onClick={() => { setEssay(SAMPLE); }} className="btn-ghost text-xs py-2 px-4">Load a sample debate case</button>
            </div>
          )}

          {running && !audit && (
            <div className="card p-5">
              <div className="label-mono mb-3">Live report</div>
              <div className="space-y-4">
                {sections.map((s, i) => (
                  <div key={i} className="animate-fadeUp">
                    <h3 className="font-serif text-lg mb-1.5">{s.title}</h3>
                    <p className="muted text-sm leading-relaxed whitespace-pre-line">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {audit && (
            <div className="card p-6">
              {/* Score hero */}
              <div className="flex items-start justify-between pb-5 border-b hair mb-5">
                <div>
                  <div className="label-mono mb-1">Overall score</div>
                  <div className="font-serif text-6xl leading-none">{score}<span className="text-2xl muted">/100</span></div>
                  <div className="font-serif text-xl italic mt-1.5">{scoreLabel(score)}</div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={save} disabled={saving} className="btn-ghost py-2 px-3 text-xs"><Save size={13} /> {saving ? "Saving…" : saved ? "Saved" : "Save"}</button>
                  <button onClick={() => exportPdf({ audit, sources: audit?.source_verification_report, draft: essay, citation_style: prefs.citationStyle })} className="btn-ghost py-2 px-3 text-xs"><Download size={13} /> PDF</button>
                  <button onClick={copyReport} className="btn-ghost py-2 px-3 text-xs"><FileText size={13} /> Copy report</button>
                </div>
              </div>

              {/* Score breakdown */}
              {dims.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 pb-5 border-b hair mb-5">
                  {dims.map((d) => (
                    <div key={d.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="muted">{d.label}</span>
                        <span className="font-mono">{d.value}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-950 dark:bg-zinc-100 rounded-full" style={{ width: `${d.width}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Report
                audit={audit}
                essay={essay}
                mode={prefs.analysisFormat}
                onQuote={jumpToQuote}
                onAskAbout={chat.askAbout}
              />

              {/* Next steps */}
              <div className="flex flex-wrap gap-2 pt-5 border-t hair mt-5">
                <button onClick={buildRebuttals} className="btn-ghost py-2 px-3.5 text-xs"><Swords size={13} /> Build rebuttal plan</button>
                {audit?.source_verification_report && (
                  <a href="#sources" className="btn-ghost py-2 px-3.5 text-xs"><Sparkles size={13} /> Verify sources</a>
                )}
                <button onClick={() => { chat.setOpen(true); }} className="btn-ghost py-2 px-3.5 text-xs"><MessageSquare size={13} /> Ask in chat</button>
                <button onClick={run} className="btn-ghost py-2 px-3.5 text-xs"><RotateCcw size={13} /> Re-run</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* First-time setup: ask what they're here for after their first audit. */}
      {audit && !prefs.onboardingDone && (
        <OnboardingModal
          onDone={(next) => {
            setPref("role", next.role);
            setPref("event", next.event);
            setPref("focus", next.focus);
            setPref("onboardingDone", true);
          }}
        />
      )}

      {/* Chat */}
      {audit && (
        <section className="card mt-6 overflow-hidden">
          <button onClick={() => chat.setOpen((o) => !o)} className="w-full flex items-center gap-2 px-5 py-4 text-left">
            <MessageSquare size={16} /> <span className="font-serif text-lg">Fracture Chat</span>
            <span className="faint text-xs ml-auto">{chat.open ? "Hide" : "Ask about this draft"}</span>
          </button>
          {chat.open && (
            <div className="px-5 pb-5">
              {chat.selectedPoint && (
                <div className="mb-3 flex items-center gap-2 text-xs bg-zinc-50 dark:bg-zinc-900/50 border hair rounded-sm px-3 py-2">
                  <span className="label-mono">Asking about</span>
                  <span className="truncate muted italic">“{chat.selectedPoint}”</span>
                  <button onClick={() => chat.setSelectedPoint(null)} className="ml-auto text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50">✕</button>
                </div>
              )}
              <div className="max-h-72 overflow-y-auto space-y-3 mb-3">
                {chat.msgs.length === 0 && (
                  <p className="faint text-xs">Ask Fracture to rewrite a line, explain a diagnosis, or draft the missing warrant.</p>
                )}
                {chat.msgs.map((m, i) => (
                  <div key={i} className={`text-sm leading-relaxed ${m.role === "user" ? "text-zinc-950 dark:text-zinc-50 font-medium" : "muted whitespace-pre-line"}`}>
                    <span className="label-mono mr-2 align-middle">{m.role === "user" ? "You" : "Fracture"}</span>{m.content || (chat.busy && i === chat.msgs.length - 1 ? "…" : "")}
                  </div>
                ))}
                <div ref={chat.endRef} />
              </div>
              <div className="flex gap-2">
                <input value={chat.input} onChange={(e) => chat.setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && chat.send()}
                  placeholder="e.g. rewrite my intro to be punchier" className="field flex-1" />
                <button onClick={chat.send} disabled={chat.busy} className="btn-solid px-4">{chat.busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
