import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Timer, Play, Plus, Trash2, Clock, Swords, Lightbulb, MessageSquare, FileText, Loader2, ArrowLeft, Eye } from "lucide-react";
import {
  createItem, updateItem, removeItem, timeAgo, fmtSeconds
} from "../lib/prep.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Field } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

const PREP_OPTIONS = [5, 10, 15, 20, 30];

const COLUMNS = [
  { key: "args", label: "Arguments", icon: Swords, placeholder: "Quick contention or point…" },
  { key: "ev", label: "Evidence", icon: Lightbulb, placeholder: "Quote or stat to cite…" },
  { key: "pred", label: "Opponent predictions", icon: Eye, placeholder: "What will they run?…" },
  { key: "res", label: "Responses", icon: MessageSquare, placeholder: "Their argument → your answer…" },
  { key: "notes", label: "Notes", icon: FileText, placeholder: "Anything else…" }
];

export default function PrepRound() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("id");
  const { items, err, setItems } = useCollection("prepSessions");

  if (sessionId) {
    const session = (items || []).find((s) => s.id === sessionId) || null;
    return <RoundWorkspace
      key={sessionId}
      session={session}
      loading={!items}
      onChange={(next) => setItems((prev) => (prev || []).map((s) => (s.id === sessionId ? next : s)))}
      onBack={() => setParams({}, { replace: true })}
      onDelete={async () => { await removeItem("prepSessions", sessionId); setParams({}, { replace: true }); }}
    />;
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Round Prep</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-2">Timed prep, distraction-free.</h1>
      <p className="muted text-sm mb-8 max-w-xl">Set the topic and prep time, then capture arguments, evidence, opponent predictions, and responses on one screen while the clock runs. Nothing is locked when time ends — the workspace stays editable.</p>

      {err && <ErrorNote msg={err} />}
      {!items && <LoadingBlock />}
      {items && items.length === 0 && (
        <EmptyState icon={Timer} title="No prep sessions yet"
          body="Start a timed session for your next round. Finished sessions stay here so you can revisit what you prepared."
          action={<NewSessionButton onCreated={(id) => setParams({ id }, { replace: true })} />} />
      )}

      {items && items.length > 0 && (
        <>
          <NewSessionButton onCreated={(id) => setParams({ id }, { replace: true })} />
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {items.map((s) => (
              <button key={s.id} onClick={() => setParams({ id: s.id }, { replace: true })} className="card card-hover p-4 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-serif text-lg">{s.topic || "Untitled prep"}</span>
                  <Clock size={15} className="faint" />
                </div>
                <p className="faint text-xs">
                  {s.side && <span className="capitalize">{s.side}</span>} {s.event && `· ${s.event}`} · {s.prepTime} min · {timeAgo(s.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NewSessionButton({ onCreated }) {
  const [topic, setTopic] = useState("");
  const [side, setSide] = useState("aff");
  const [prepTime, setPrepTime] = useState(15);
  const [event, setEvent] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      const id = await createItem("prepSessions", {
        topic: topic.trim(), side, prepTime, event, startedAt: new Date().toISOString(), endedAt: null,
        content: { args: [], ev: [], pred: [], res: [], notes: [] }
      });
      onCreated(id);
    } finally { setBusy(false); }
  }

  return (
    <div className="card p-5">
      <div className="label-mono mb-3">Start a session</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field label="Topic / resolution"><input value={topic} onChange={(e) => setTopic(e.target.value)} className="field !py-2" placeholder="e.g. Resolved: high schools should start later" /></Field>
        </div>
        <Field label="Side"><select value={side} onChange={(e) => setSide(e.target.value)} className="field !py-2"><option value="aff">Aff</option><option value="neg">Neg</option><option value="speech">Speech</option></select></Field>
        <Field label="Event"><input value={event} onChange={(e) => setEvent(e.target.value)} className="field !py-2" placeholder="LD / PF / Policy…" /></Field>
        <div className="sm:col-span-2">
          <Field label="Prep time"><div className="flex gap-1.5">
            {PREP_OPTIONS.map((m) => (
              <button key={m} onClick={() => setPrepTime(m)} className={cx("flex-1 rounded-sm border px-2 py-2 text-sm transition-colors", prepTime === m ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900" : "hair")}>{m}m</button>
            ))}
          </div></Field>
        </div>
      </div>
      <button onClick={start} disabled={busy || !topic.trim()} className="btn-solid w-full mt-4 !py-2.5">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <><Play size={14} /> Start prep</>}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Workspace
──────────────────────────────────────────────────────────────────────────── */

function RoundWorkspace({ session, loading, onChange, onBack, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startRef = useRef(null);

  // Load + set the start timestamp for the timer.
  useEffect(() => {
    if (session) {
      setDraft(JSON.parse(JSON.stringify(session)));
      startRef.current = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(Math.max(0, e));
      setRunning(true);
    }
  }, [session]);

  // Timer ticks while the workspace is open.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (!startRef.current) return;
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  // Debounced autosave.
  useEffect(() => {
    if (!draft || !session) return;
    const t = setTimeout(() => {
      updateItem("prepSessions", session.id, { ...draft, updatedAt: new Date().toISOString() }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [draft, session]);

  if (loading) return <div className="max-w-6xl mx-auto px-5 py-10"><LoadingBlock /></div>;
  if (!session || !draft) {
    return <EmptyState icon={Timer} title="Session not found" body="This prep session no longer exists." action={<button onClick={onBack} className="btn-solid py-2 px-4 text-sm">Back</button>} />;
  }

  const target = (session.prepTime || 15) * 60;
  const over = elapsed > target;
  const remaining = target - elapsed;

  const patchContent = (key, list) => setDraft((d) => ({ ...d, content: { ...d.content, [key]: list } }));
  const addTo = (key) => setDraft((d) => ({ ...d, content: { ...d.content, [key]: [...(d.content?.[key] || []), { id: "x" + Date.now().toString(36), text: "" }] } }));
  const setItemText = (key, id, text) => patchContent(key, (draft.content?.[key] || []).map((x) => (x.id === id ? { ...x, text } : x)));

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1"><ArrowLeft size={13} /> All sessions</button>
        <div className="flex items-center gap-3">
          <button onClick={onDelete} className="text-xs faint hover:text-red-500">Delete session</button>
          <button onClick={async () => {
            const now = new Date().toISOString();
            await updateItem("prepSessions", session.id, { ...draft, endedAt: now });
            onBack();
          }} className="btn-solid !py-2 !px-4 text-xs">End & save</button>
        </div>
      </div>

      {/* Persistent timer */}
      <div className={cx("card p-5 mb-6 text-center lg:sticky lg:top-20 z-10", over && "border-red-400/60 dark:border-red-800/60")}>
        <div className="label-mono mb-1">{session.topic || "Prep"}{session.side && <span className="capitalize"> · {session.side}</span>}</div>
        <div className={cx("font-serif text-6xl tabular-nums", over && "text-red-500")}>
          {fmtSeconds(over ? elapsed - target : remaining)}
        </div>
        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden my-3 max-w-md mx-auto">
          <div className={cx("h-full rounded-full transition-all", over ? "bg-red-500" : "bg-zinc-950 dark:bg-zinc-100")} style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }} />
        </div>
        {over ? (
          <p className="text-sm text-red-500">Official prep time ended — keep working, it's all saved.</p>
        ) : (
          <p className="faint text-xs">{fmtSeconds(elapsed)} used of {fmtSeconds(target)}</p>
        )}
      </div>

      {/* Columns */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => (
          <div key={col.key} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <col.icon size={15} className="faint" />
              <span className="font-serif text-lg">{col.label}</span>
              <button onClick={() => addTo(col.key)} className="ml-auto faint hover:text-zinc-950 dark:hover:text-zinc-50" title="Add"><Plus size={15} /></button>
            </div>
            <div className="space-y-2">
              {(draft.content?.[col.key] || []).map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <textarea value={item.text} onChange={(e) => setItemText(col.key, item.id, e.target.value)}
                    placeholder={col.placeholder}
                    className="field !py-2 text-sm leading-relaxed min-h-[52px] resize-y" />
                  <button onClick={() => patchContent(col.key, (draft.content?.[col.key] || []).filter((x) => x.id !== item.id))} className="faint hover:text-red-500 mt-2 shrink-0"><Trash2 size={13} /></button>
                </div>
              ))}
              {(draft.content?.[col.key] || []).length === 0 && (
                <button onClick={() => addTo(col.key)} className="w-full rounded-sm border border-dashed hair py-3 text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">
                  + {col.placeholder}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="card p-4 text-xs faint leading-relaxed xl:col-span-3 md:col-span-2">
          Everything here autosaves to this session. When the round starts, reopen this page from the session list — it's your flow doc.
        </div>
      </div>
    </div>
  );
}
