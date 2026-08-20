import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Loader2, Trash2, Layers, Sparkles, RefreshCw } from "lucide-react";
import {
  newFlashcard, createItem, updateItem, removeItem, cardDue, scheduleReview,
  fmtSeconds, timeAgo
} from "../lib/prep.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Field, Tabs, Pill } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

export default function PrepFlashcards() {
  const { items, err, setItems } = useCollection("flashcards");
  const evidence = useCollection("evidence");
  const responses = useCollection("responses");
  const cases = useCollection("cases");
  const [tab, setTab] = useState("due");
  const [study, setStudy] = useState(null); // card being studied
  const [revealed, setRevealed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genNote, setGenNote] = useState("");

  const now = new Date();
  const due = useMemo(() => (items || []).filter((c) => cardDue(c, now)).sort((a, b) => (a.due || "").localeCompare(b.due || "")), [items]);
  const all = useMemo(() => (items || []).slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")), [items]);

  async function rate(card, quality) {
    const next = scheduleReview(card, quality, new Date());
    await updateItem("flashcards", card.id, next).catch(() => {});
    setItems((prev) => (prev || []).map((c) => (c.id === card.id ? { ...c, ...next } : c)));
    const queue = due.filter((c) => c.id !== card.id);
    if (queue.length) { setStudy(queue[0]); setRevealed(false); } else { setStudy(null); setRevealed(false); }
  }

  async function generateFromLibrary() {
    if (generating) return;
    setGenerating(true); setGenNote("");
    const made = [];
    const nowIso = new Date().toISOString();
    for (const e of evidence.items || []) {
      if (!e.text) continue;
      const card = newFlashcard({
        front: e.source ? `What does this source support? (${e.source})` : "What does this evidence card say?",
        back: e.text, kind: "evidence", sourceType: "evidence", sourceId: e.id, due: nowIso
      });
      made.push(card);
    }
    for (const r of responses.items || []) {
      if (!r.trigger) continue;
      const card = newFlashcard({
        front: `They say: "${r.trigger}". What's your best response?`,
        back: (r.branches || []).map((b) => b.explanation || b.label).filter(Boolean).join(" — ") || "See the response tree.",
        kind: "response", sourceType: "responses", sourceId: r.id, due: nowIso
      });
      made.push(card);
    }
    for (const c of cases.items || []) {
      for (const s of c.sections || []) {
        if (!s.claim) continue;
        made.push(newFlashcard({
          front: `What is the main warrant for "${s.title || "this contention"}"?`,
          back: s.warrant || "Missing warrant.", kind: "argument", sourceType: "cases", sourceId: c.id, due: nowIso
        }));
      }
    }
    for (const card of made.slice(0, 40)) {
      const id = await createItem("flashcards", card);
      setItems((prev) => [{ ...card, id }, ...(prev || [])]);
    }
    setGenerating(false);
    setGenNote(made.length ? `Generated ${made.length} cards from your library.` : "Nothing to generate — add evidence, response trees, or case sections first.");
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Flashcards</div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl">Remember the round.</h1>
          <p className="muted text-sm mt-2 max-w-lg">Turn arguments, evidence, and responses into spaced-repetition cards — or generate a deck straight from your library.</p>
        </div>
        <button onClick={generateFromLibrary} disabled={generating} className="btn-ghost !py-2 !px-3 text-xs">
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate from library
        </button>
      </div>
      {genNote && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{genNote}</p>}
      {err && <ErrorNote msg={err} />}

      <Tabs tabs={[
        { id: "due", label: "Due now", count: due.length },
        { id: "all", label: "All cards", count: (items || []).length }
      ]} active={tab} onChange={setTab} />

      {!items && <LoadingBlock />}
      {items && items.length === 0 && (
        <EmptyState icon={Layers} title="No cards yet"
          body="Create cards manually, or hit 'Generate from library' to turn your evidence, response trees, and case warrants into a spaced-repetition deck."
          action={<button onClick={() => setCreating(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> New card</button>} />
      )}

      {items && items.length > 0 && tab === "due" && due.length === 0 && (
        <div className="card p-8 text-center">
          <RefreshCw size={22} className="faint mx-auto mb-3" />
          <p className="muted text-sm">All caught up — no cards due. Cards come back on their own schedule.</p>
        </div>
      )}

      {items && tab === "due" && due.length > 0 && !study && (
        <button onClick={() => { setStudy(due[0]); setRevealed(false); }} className="btn-solid w-full !py-4 text-base">
          Study {due.length} card{due.length === 1 ? "" : "s"} <span className="opacity-70">· ~{fmtSeconds(due.length * 30)}</span>
        </button>
      )}

      {/* Study card */}
      {study && (
        <div className="card p-8 text-center">
          <div className="label-mono mb-2">{study.kind} card · {study.sourceType || "manual"}</div>
          <div className="min-h-[120px] flex items-center justify-center">
            <p className="font-serif text-2xl leading-snug max-w-lg">{revealed ? study.back || "No answer saved." : study.front}</p>
          </div>
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="btn-ghost mt-6 !py-2 !px-6 text-sm">Reveal answer</button>
          ) : (
            <div className="mt-6">
              <div className="label-mono mb-2">How well did you recall it?</div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((q) => (
                  <button key={q} onClick={() => rate(study, q)}
                    className={cx("w-10 h-10 rounded-sm border text-sm transition-colors", q < 3 ? "border-red-400/40 hover:bg-red-500/10" : q < 5 ? "border-amber-400/40 hover:bg-amber-500/10" : "border-green-400/40 hover:bg-green-500/10")}>
                    {q}
                  </button>
                ))}
              </div>
              <p className="faint text-xs mt-2">0–2 again soon · 3–4 normal · 5 mastered</p>
            </div>
          )}
          <button onClick={() => { setStudy(null); setRevealed(false); }} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 mt-6">End session</button>
        </div>
      )}

      {/* All cards */}
      {items && tab === "all" && (
        <div className="space-y-2">
          {all.map((c) => (
            <div key={c.id} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{c.front}</p>
                <p className="faint text-xs line-clamp-1 mt-0.5">{c.back}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] faint">
                  <Pill>{c.kind}</Pill>
                  <span>interval {c.intervalDays}d · {c.reviews} reviews</span>
                  <span>due {timeAgo(c.due)}</span>
                </div>
              </div>
              <button onClick={async () => { await removeItem("flashcards", c.id); setItems((prev) => (prev || []).filter((x) => x.id !== c.id)); }} className="faint hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {creating && <CardEditor onClose={() => setCreating(false)} setItems={setItems} />}
    </div>
  );
}

function CardEditor({ onClose, setItems }) {
  const [form, setForm] = useState(() => newFlashcard());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.front.trim() || !form.back.trim()) { setErr("Both sides are required."); return; }
    setBusy(true); setErr(null);
    try {
      const id = await createItem("flashcards", form);
      setItems((prev) => [{ ...form, id }, ...(prev || [])]);
      onClose();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl mb-4">New flashcard</h3>
        <div className="space-y-3">
          <Field label="Front"><textarea value={form.front} onChange={(e) => set("front", e.target.value)} className="field text-sm" rows={2} autoFocus /></Field>
          <Field label="Back"><textarea value={form.back} onChange={(e) => set("back", e.target.value)} className="field text-sm" rows={3} /></Field>
          <Field label="Kind"><select value={form.kind} onChange={(e) => set("kind", e.target.value)} className="field !py-2">
            <option value="qa">Question / answer</option>
            <option value="argument">Argument recall</option>
            <option value="evidence">Evidence recall</option>
            <option value="response">Response recall</option>
          </select></Field>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
            <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save card"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
