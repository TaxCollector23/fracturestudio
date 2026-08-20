import { useState } from "react";
import { Swords, Loader2 } from "lucide-react";
import { streamText } from "../lib/api.js";

export default function Rebuttals() {
  const [draft, setDraft] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function build() {
    if (!draft.trim() || busy) return;
    setBusy(true); setErr(null); setOut("");
    try {
      await streamText("rebuttal", { draft, message: "Prepare the strongest rebuttal plan." }, {
        onDelta: (d) => setOut((o) => o + d)
      });
    } catch (e) { setErr(e?.message || "Could not build rebuttals."); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Studio / Opponent Prep</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-2">Rebuttal Builder</h1>
      <p className="muted mb-8 max-w-2xl">Paste your case or speech. Fracture prepares the strongest attacks an opponent will run, exact responses, crossfire questions, and weighing lines.</p>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5 flex flex-col">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your argument, case, or speech…" className="field flex-1 min-h-[320px] resize-y leading-relaxed" />
          <div className="flex justify-end mt-4">
            <button onClick={build} disabled={busy || !draft.trim()} className="btn-solid">
              {busy ? <><Loader2 size={15} className="animate-spin" /> Building…</> : <><Swords size={15} /> Build Rebuttals</>}
            </button>
          </div>
          {err && <p className="text-red-500 text-sm mt-3">{err}</p>}
        </section>

        <section className="card p-5 min-h-[360px]">
          {out
            ? <div className="muted text-sm leading-relaxed whitespace-pre-line">{out}</div>
            : <div className="h-full flex items-center justify-center"><p className="faint text-center max-w-xs">Your opponent-prep plan will stream here.</p></div>}
        </section>
      </div>
    </div>
  );
}
