import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Swords, Loader2, ArrowRight, Target } from "lucide-react";
import { streamText } from "../lib/api.js";

const DRAFT_KEY = "fracture_rebuttal_draft";

const MODES = [
  { id: "coach", label: "Coach", hint: "Supportive prep — the plan you can actually deliver." },
  { id: "aggressive", label: "Aggressive opponent", hint: "An attacker who hits every assertion — sharpen your answers." },
  { id: "technical", label: "Technical opponent", hint: "Evidence, definitions, dropped burdens — win on the flow." },
  { id: "judge", label: "Judge questioning", hint: "The judge interrupts your weakest step. Prepare clean answers." },
  { id: "beginner", label: "Beginner walkthrough", hint: "Simple, step-by-step opposition handling." }
];

export default function Rebuttals() {
  const [draft, setDraft] = useState("");
  const [report, setReport] = useState(null);
  const [style, setStyle] = useState("coach");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DRAFT_KEY);
      const data = JSON.parse(raw);
      if (data.draft) setDraft(data.draft);
      if (data.audit) setReport(data.audit);
      if (data.style) setStyle(data.style);
    } catch (_) {}
  }, []);

  async function build() {
    if (!draft.trim() || busy) return;
    setBusy(true); setErr(null); setOut("");
    try {
      await streamText("rebuttal", { draft, report, style, message: "Prepare the strongest rebuttal plan." }, {
        onDelta: (d) => setOut((o) => o + d)
      });
    } catch (e) { setErr(e?.message || "Could not build rebuttals."); }
    finally { setBusy(false); }
  }

  const mode = MODES.find((m) => m.id === style) || MODES[0];

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <header className="mb-8">
        <div className="label-mono mb-2">Practice / Opponent prep</div>
        <h1 className="font-serif text-4xl md:text-5xl">Build the rebuttal plan.</h1>
        <p className="muted mt-3 max-w-xl text-sm leading-relaxed">
          Pick a practice mode — coach, aggressive opponent, technical opponent, judge questioning — and Fracture
          prepares the plan against that specific pressure.
        </p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
        <section className="card p-5 flex flex-col">
          <label className="label-mono mb-1.5">Practice mode</label>
          <div className="space-y-1.5 mb-4">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setStyle(m.id)}
                className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${style === m.id ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900" : "hair hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-[11px] faint leading-snug mt-0.5">{m.hint}</div>
              </button>
            ))}
          </div>

          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your argument, case, or speech…" className="field flex-1 min-h-[280px] resize-y leading-relaxed" />
          <div className="flex items-center justify-between mt-4">
            <Link to="/studio" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">← Back to Studio</Link>
            <button onClick={build} disabled={busy || !draft.trim()} className="btn-solid">
              {busy ? <><Loader2 size={15} className="animate-spin" /> Building…</> : <><Swords size={15} /> Build Rebuttals</>}
            </button>
          </div>
          {err && <p className="text-red-500 text-sm mt-3">{err}</p>}
        </section>

        <section className="card p-5 min-h-[360px]">
          <div className="flex items-center justify-between mb-3">
            <div className="label-mono">{mode.label} plan</div>
            {busy && <span className="faint text-xs font-mono animate-pulse">streaming…</span>}
          </div>
          {out
            ? <div className="muted text-sm leading-relaxed whitespace-pre-line">{out}</div>
            : (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <Target size={26} className="faint mb-4" />
                <p className="faint max-w-sm text-sm">
                  {draft.trim()
                    ? `Your ${mode.label.toLowerCase()} prep plan will stream here.`
                    : "No draft yet. Paste one here, or run an audit in the Studio and open the rebuttal builder from your report."}
                </p>
                {!draft.trim() && (
                  <Link to="/studio" className="btn-ghost mt-4 text-xs py-2 px-4">Open the Studio <ArrowRight size={13} /></Link>
                )}
              </div>
            )}
        </section>
      </div>
    </div>
  );
}
