import { useEffect, useCallback, useState } from "react";
import { Loader2, X, AlertTriangle, Inbox } from "lucide-react";
import { listItems } from "../lib/prep.js";

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Loads one prep collection with loading/error/refresh state. */
export function useCollection(col) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const refresh = useCallback(async () => {
    try {
      const rows = await listItems(col);
      setItems(rows || []);
      setErr(null);
    } catch (e) {
      setErr(e?.message || `Could not load ${col}.`);
      setItems([]);
    }
  }, [col]);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, err, refresh, setItems };
}

export function useDebounced(value, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ─── States ──────────────────────────────────────────────────────────────────

export function LoadingBlock() {
  return <div className="py-14 flex justify-center"><Loader2 size={20} className="animate-spin faint" /></div>;
}

export function ErrorNote({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{msg}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, body, action }) {
  return (
    <div className="card p-10 text-center">
      <Icon size={28} className="faint mx-auto mb-4" />
      <h3 className="font-serif text-xl mb-2">{title}</h3>
      <p className="muted text-sm max-w-sm mx-auto leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

export function Pill({ children, onClick, tone = "" }) {
  const tones = {
    green: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    red: "text-red-500 border-red-500/30 bg-red-500/10",
    amber: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
    blue: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10"
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-mono transition-colors ${tones[tone] || "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
      {children}
    </button>
  );
}

export function TagEditor({ tags, onChange, placeholder = "Add tag…" }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim().replace(/^#/, "");
    if (!t) return;
    if (!tags.includes(t)) onChange([...tags, t]);
    setDraft("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(tags || []).map((t) => (
        <Pill key={t} onClick={() => onChange(tags.filter((x) => x !== t))}>
          #{t} <X size={10} />
        </Pill>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="bg-transparent text-xs placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none w-24"
      />
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="field !py-2 text-sm" />
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className={`card w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-serif text-xl">{title}</h3>
          <button onClick={onClose} className="faint hover:text-zinc-950 dark:hover:text-zinc-50"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="label-mono mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b hair pb-3 mb-5">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded-sm text-sm transition-colors ${active === t.id ? "bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950" : "text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"}`}>
          {t.label}
          {t.count != null && <span className="ml-1.5 font-mono text-xs opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
