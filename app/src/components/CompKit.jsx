// CompKit.jsx — shared building blocks for the competition pages.
// Mirrors PrepKit but for the shared competition collections, with a
// subscribe-aware hook so Firestore sessions get realtime updates while
// local (guest) sessions just reload.

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertTriangle, Inbox, Play, Pause, RotateCcw, Plus } from "lucide-react";
import { subscribe } from "../lib/competition.js";
import { cx } from "../lib/ui.js";
import { fmtClock } from "../lib/timer.js";

/** Load a competition collection with loading/error state + realtime refresh. */
export function useCompCollection(col, parent) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    const { listItems } = await import("../lib/competition.js");
    try {
      const rows = await listItems(col, parent);
      setItems(rows || []);
      setErr(null);
    } catch (e) {
      setErr(e?.message || `Could not load ${col}.`);
      setItems([]);
    }
  }, [col, parent]);

  useEffect(() => {
    load();
    const unsub = subscribe(col, parent, (rows) => {
      setItems(rows || []);
      setErr(null);
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, [load, col, parent]);

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

/** Colored status pill for tournament / round / ballot / assignment statuses. */
export function StatusPill({ status, tone, label }) {
  const tones = {
    green: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    red: "text-red-500 border-red-500/30 bg-red-500/10",
    amber: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
    blue: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10",
    zinc: "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
  };
  const t = tone || (status === "completed" || status === "submitted" || status === "locked" || status === "active"
    ? "green" : status === "awaiting-ballot" || status === "overdue" || status === "archived"
      ? "amber" : status === "upcoming" || status === "not-started" || status === "draft"
        ? "blue" : "zinc");
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono", tones[t])}>
      {label || String(status || "").replace(/-/g, " ")}
    </span>
  );
}

export function RoleBadge({ role }) {
  const tones = {
    admin: "text-red-500 border-red-500/30 bg-red-500/10",
    coach: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
    judge: "text-sky-600 dark:text-sky-400 border-sky-500/30 bg-sky-500/10",
    participant: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10",
    member: "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider", tones[role] || tones.member)}>
      {role}
    </span>
  );
}

/**
 * Timer block for the round control center. One reusable unit per slot:
 * label, countdown, start/pause/reset, extension, warning and over-time color.
 */
export function TimerBlock({ timer, label, sublabel, extendable = true }) {
  const over = timer.elapsed > timer.duration;
  const showWarn = timer.warned && !over && timer.state !== "finished";
  return (
    <div className={cx("card p-4 rounded-sm transition-colors",
      timer.state === "finished" ? "border-green-500/50" : over ? "border-red-500/60" : showWarn ? "border-amber-500/50" : "")}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium muted truncate">{label}</span>
        {sublabel && <span className="faint text-[10px] font-mono shrink-0 ml-2">{sublabel}</span>}
      </div>
      <div className={cx("font-serif text-4xl tabular-nums",
        timer.state === "finished" ? "text-green-600 dark:text-green-400" : over ? "text-red-500" : showWarn ? "text-amber-600 dark:text-amber-400" : "")}>
        {fmtClock(over ? timer.elapsed - timer.duration : timer.remaining)}
        {over && <span className="text-xs font-mono faint ml-1">over</span>}
      </div>
      <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden my-2">
        <div className={cx("h-full rounded-full transition-all",
          timer.state === "finished" ? "bg-green-500" : over ? "bg-red-500" : showWarn ? "bg-amber-500" : "bg-zinc-950 dark:bg-zinc-100")}
          style={{ width: `${Math.min(100, (timer.elapsed / Math.max(1, timer.duration)) * 100)}%` }} />
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={timer.toggle} disabled={timer.state === "finished"}
          className="btn-solid flex-1 !py-1.5 !px-2 text-[11px]">
          {timer.running ? <><Pause size={11} /> Pause</> : timer.state === "finished" ? "Done" : <><Play size={11} /> {timer.elapsed > 0 ? "Resume" : "Start"}</>}
        </button>
        <button onClick={timer.reset} className="btn-ghost !py-1.5 !px-2 text-[11px]" title="Reset"><RotateCcw size={11} /></button>
        {extendable && timer.state === "running" && (
          <button onClick={() => timer.extend(30)} className="btn-ghost !py-1.5 !px-2 text-[11px]" title="Extend 30s">+30s</button>
        )}
        {timer.state === "finished" && (
          <button onClick={() => timer.extend(30)} className="btn-ghost !py-1.5 !px-2 text-[11px]">+30s</button>
        )}
      </div>
    </div>
  );
}

export function PersonList({ people, empty = "Nobody here yet." }) {
  if (!people.length) return <p className="faint text-xs py-2">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {people.map((p) => (
        <li key={p.id} className="flex items-center gap-2 text-sm">
          <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-mono shrink-0">
            {(p.name || p.id).slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate">{p.name || p.id}</span>
          {p.role && <RoleBadge role={p.role} />}
          {p.meta && <span className="faint text-xs ml-auto shrink-0">{p.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

export function AddButton({ onClick, label }) {
  return (
    <button onClick={onClick} className="btn-ghost !py-2 !px-3 text-xs">
      <Plus size={13} /> {label}
    </button>
  );
}
