import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Play, Pause, RotateCcw, Trash2, Loader2, Timer, CheckCircle2 } from "lucide-react";
import {
  newOutline, newSegment, createItem, updateItem, removeItem, outlineTotal, fmtSeconds
} from "../lib/prep.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Field, Tabs } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

const TEMPLATES = [
  { label: "Intro", seconds: 30 },
  { label: "Point 1", seconds: 120 },
  { label: "Point 2", seconds: 120 },
  { label: "Point 3", seconds: 90 },
  { label: "Conclusion", seconds: 30 }
];

export default function PrepOutlines() {
  const { items, err, setItems } = useCollection("outlines");
  const [tab, setTab] = useState("list");
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState(null);

  async function createDefault() {
    setCreating(true);
    try {
      const outline = newOutline({
        title: "Untitled speech",
        segments: TEMPLATES.map((s) => newSegment(s.label, s.seconds))
      });
      const id = await createItem("outlines", outline);
      setItems((prev) => [{ ...outline, id }, ...(prev || [])]);
      setTab("edit");
      setRunningId(id);
    } finally { setCreating(false); }
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Speech Timer</div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-4xl md:text-5xl">Time the speech, not just the draft.</h1>
          <p className="muted text-sm mt-2 max-w-lg">Allocate time per section, run a timed rehearsal, and see over/under on every segment. Save templates per event.</p>
        </div>
        <button onClick={createDefault} disabled={creating} className="btn-solid !py-2 !px-3 text-xs">
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} New outline
        </button>
      </div>

      {err && <ErrorNote msg={err} />}
      {!items && <LoadingBlock />}
      {items && items.length === 0 && (
        <EmptyState icon={Timer} title="No outlines yet"
          body="Create a section-by-section timing plan — introduction, points, conclusion — then rehearse against it."
          action={<button onClick={createDefault} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create an outline</button>} />
      )}

      <Tabs tabs={[
        { id: "list", label: "Saved outlines", count: (items || []).length },
        { id: "edit", label: runningId ? "Editing" : "Editor" }
      ]} active={tab} onChange={setTab} />

      {tab === "list" && items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((o) => (
            <div key={o.id} className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg">{o.title || "Untitled"}</p>
                <p className="faint text-xs">{o.event || "Any event"} · {o.segments?.length || 0} segments · total {fmtSeconds(outlineTotal(o))}</p>
              </div>
              <button onClick={() => { setRunningId(o.id); setTab("edit"); }} className="btn-ghost !py-1.5 !px-3 text-xs">Edit / rehearse</button>
              <button onClick={async () => { await removeItem("outlines", o.id); setItems((prev) => (prev || []).filter((x) => x.id !== o.id)); }} className="faint hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "edit" && runningId && <OutlineEditor id={runningId} items={items} setItems={setItems} />}
    </div>
  );
}

function OutlineEditor({ id, items, setItems }) {
  const outline = (items || []).find((o) => o.id === id) || newOutline({ id });
  const [form, setForm] = useState(() => ({ ...outline }));
  const [run, setRun] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [segIdx, setSegIdx] = useState(0);

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [run]);

  const total = outlineTotal(form);
  const seg = form.segments?.[segIdx];
  const segEnd = seg ? (form.segments.slice(0, segIdx).reduce((a, s) => a + s.seconds, 0) + seg.seconds) : 0;
  const segStart = seg ? (form.segments.slice(0, segIdx).reduce((a, s) => a + s.seconds, 0)) : 0;

  // Auto-advance segments during a run.
  useEffect(() => {
    if (run && seg && elapsed >= segEnd) {
      if (segIdx < form.segments.length - 1) setSegIdx((i) => i + 1);
      else setRun(false);
    }
  }, [elapsed, run, seg, segEnd, segIdx, form.segments.length]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); };
  const setSeg = (i, patch) => set("segments", form.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const moveSeg = (i, dir) => {
    const next = [...form.segments];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("segments", next);
  };

  // Debounced autosave.
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => updateItem("outlines", id, form).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [form, id]);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Field label="Title"><input value={form.title} onChange={(e) => set("title", e.target.value)} className="field !py-2" /></Field>
          <Field label="Event"><input value={form.event} onChange={(e) => set("event", e.target.value)} className="field !py-2" placeholder="Persuasive / LD / Extemp…" /></Field>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="label-mono">Target time: {fmtSeconds(total)}</span>
          <button onClick={() => set("segments", [...form.segments, newSegment()])} className="btn-ghost !py-1.5 !px-3 text-xs"><Plus size={12} /> Segment</button>
        </div>
        <div className="space-y-2">
          {form.segments.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="label-mono w-6 shrink-0 text-right">{i + 1}</span>
              <input value={s.label} onChange={(e) => setSeg(i, { label: e.target.value })} className="field !py-1.5 text-sm flex-1" />
              <input type="number" min={0} step={15} value={s.seconds} onChange={(e) => setSeg(i, { seconds: Math.max(0, Number(e.target.value) || 0) })}
                className="field !py-1.5 !w-20 text-sm font-mono text-center" />
              <span className="faint text-xs w-14">{fmtSeconds(s.seconds)}</span>
              <div className="flex items-center gap-1 faint">
                <button onClick={() => moveSeg(i, -1)} disabled={i === 0} className="hover:text-zinc-950 dark:hover:text-zinc-50 disabled:opacity-30">↑</button>
                <button onClick={() => moveSeg(i, 1)} disabled={i === form.segments.length - 1} className="hover:text-zinc-950 dark:hover:text-zinc-50 disabled:opacity-30">↓</button>
                <button onClick={() => set("segments", form.segments.filter((_, j) => j !== i))} className="hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rehearsal */}
      <div className={cx("card p-5", run && "ring-2 ring-green-500/50")}>
        <div className="flex items-center justify-between mb-3">
          <span className="label-mono">Rehearsal</span>
          {seg && <span className="text-sm font-medium">{seg.label}{run && <span className="faint text-xs ml-2">segment {segIdx + 1}/{form.segments.length}</span>}</span>}
        </div>
        <div className="font-serif text-5xl tabular-nums mb-3">{fmtSeconds(elapsed)}</div>
        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-zinc-950 dark:bg-zinc-100 transition-[width] duration-1000" style={{ width: `${total ? Math.min(100, (elapsed / total) * 100) : 0}%` }} />
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setRun((r) => !r)} className="btn-solid flex-1 !py-2 text-xs">{run ? <><Pause size={13} /> Pause</> : <><Play size={13} /> {elapsed === 0 ? "Start rehearsal" : "Resume"}</>}</button>
          <button onClick={() => { setRun(false); setElapsed(0); setSegIdx(0); }} className="btn-ghost !py-2 !px-4 text-xs"><RotateCcw size={13} /></button>
        </div>
        {run && seg && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="muted">Segment elapsed: {fmtSeconds(Math.max(0, Math.min(seg.seconds, elapsed - segStart)))}</span>
              <span className="muted">Target: {fmtSeconds(seg.seconds)}</span>
              <span className={elapsed - segEnd > 0 ? "text-red-500 font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                {elapsed - segEnd > 0 ? `+${fmtSeconds(elapsed - segEnd)} over` : fmtSeconds(Math.max(0, segEnd - elapsed)) + " left"}
              </span>
            </div>
            <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className={cx("h-full rounded-full", elapsed - segStart > seg.seconds ? "bg-red-500" : "bg-green-500")} style={{ width: `${Math.min(100, ((elapsed - segStart) / seg.seconds) * 100)}%` }} />
            </div>
          </div>
        )}
        {!run && elapsed > 0 && <p className="faint text-xs">Rehearsal paused at {fmtSeconds(elapsed)} of {fmtSeconds(total)}.</p>}
        {run && segIdx === form.segments.length - 1 && elapsed >= segEnd && <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5 mt-2"><CheckCircle2 size={14} /> Outline complete.</p>}
      </div>
    </div>
  );
}
