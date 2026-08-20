// ResearchKit.jsx — shared building blocks for the research & citation pages.
// Mirrors PrepKit/CompKit conventions: same card/pill/button classes, same
// per-user store access, and one loader hook so every research page handles
// loading/error/refresh the same way.

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, Inbox, Copy, Check, X, Plus } from "lucide-react";
import { listItems } from "../lib/prep.js";
import { cx } from "../lib/ui.js";
import { sourceTypeLabel } from "../lib/research.js";

/** Load one research collection from the per-user store with state. */
export function useResearchCollection(col) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await listItems(col);
      setItems(rows || []);
      setErr(null);
    } catch (e) {
      setErr(e?.message || `Could not load ${col}.`);
      setItems([]);
    }
  }, [col]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, err, refresh: load, setItems };
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="py-14 flex items-center justify-center gap-2 faint text-sm">
      <Loader2 size={18} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-sm border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" /> <span>{msg}</span>
    </div>
  );
}

export function ResearchEmpty({ icon: Icon = Inbox, title, body, action }) {
  return (
    <div className="card p-10 text-center">
      <Icon size={28} className="faint mx-auto mb-4" />
      <h3 className="font-serif text-xl mb-2">{title}</h3>
      <p className="muted text-sm max-w-sm mx-auto leading-relaxed mb-6">{body}</p>
      {action}
    </div>
  );
}

/** Status pill for research entities (topics, questions, tasks, …). */
export function ResearchStatus({ status, label }) {
  const tones = {
    active: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    completed: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    answered: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    done: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    archived: "border-zinc-300 dark:border-zinc-700 text-zinc-500",
    researching: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10",
    "partially-answered": "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
    unanswered: "text-red-500 border-red-500/30 bg-red-500/10",
    blocked: "text-red-500 border-red-500/30 bg-red-500/10",
    open: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono", tones[status] || "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400")}>
      {label || String(status || "").replace(/-/g, " ")}
    </span>
  );
}

export function SourceTypePill({ type }) {
  if (!type) return null;
  return (
    <span className="inline-flex items-center rounded-sm border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
      {sourceTypeLabel(type)}
    </span>
  );
}

/** Editable tag list: click X to remove, Enter/comma to add. */
export function TagInput({ tags = [], onChange, placeholder = "Add tag…" }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const parts = draft.split(",").map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...new Set([...tags, ...parts])];
    onChange(next);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="pill inline-flex items-center gap-1">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="faint hover:text-red-500" title={`Remove ${t}`}>
            <X size={10} />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          onBlur={add}
          placeholder={placeholder}
          className="bg-transparent text-xs w-24 outline-none placeholder:text-zinc-400"
        />
        {draft.trim() && (
          <button type="button" onClick={add} className="faint hover:text-zinc-950 dark:hover:text-zinc-100"><Plus size={12} /></button>
        )}
      </span>
    </div>
  );
}

/** Copy-to-clipboard button with a brief "Copied" confirmation. */
export function CopyButton({ text, label = "Copy", className = "" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={cx("inline-flex items-center gap-1.5 text-xs btn-ghost !py-1 !px-2", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text || "");
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch (_) {}
      }}
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Small mono label showing where a field's data came from (imported/user/verified). */
export function ProvenanceTag({ prov }) {
  if (!prov) return null;
  const tones = {
    extracted: "text-sky-600 dark:text-sky-400",
    imported: "text-sky-600 dark:text-sky-400",
    user: "text-amber-600 dark:text-amber-400",
    verified: "text-green-600 dark:text-green-400"
  };
  const labels = { extracted: "auto-extracted", imported: "imported", user: "edited by you", verified: "verified" };
  return <span className={cx("text-[10px] font-mono", tones[prov] || "faint")}>{labels[prov] || prov}</span>;
}
