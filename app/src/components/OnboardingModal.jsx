import { useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { loadPrefs, savePrefs, ROLES, EVENTS, FOCUSES } from "../lib/prefs.js";
import { useAuth } from "../lib/useAuth.jsx";
import { savePreferences } from "../lib/firebase.js";

/**
 * First-visit setup: role, event, focus — the three answers that personalize
 * the dashboard, recommendations, and default analysis mode. Skippable,
 * one screen, no dead-end forms.
 */
export default function OnboardingModal({ onDone }) {
  const { user } = useAuth();
  const [role, setRole] = useState("");
  const [event, setEvent] = useState("");
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);

  function finish(skip = false) {
    const prefs = loadPrefs();
    const next = {
      ...prefs,
      role: skip ? (prefs.role || "student") : role,
      event: skip ? (prefs.event || "") : event,
      focus: skip ? (prefs.focus || "") : focus,
      onboardingDone: true
    };
    // Default the analysis mode to the chosen event's format.
    const ev = EVENTS.find((e) => e.id === event);
    if (ev) next.analysisFormat = ev.format;
    savePrefs(next);
    if (user) savePreferences(user.id, next).catch(() => {});
    setSaving(true);
    if (onDone) { onDone(next); return; } // parent updates live state (Studio)
    window.location.reload(); // re-render the dashboard with the new profile
  }

  const ready = role && event;

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="card w-full max-w-lg p-7 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <div className="label-mono">Set up your practice profile</div>
          <button onClick={() => finish(true)} className="faint hover:text-zinc-950 dark:hover:text-zinc-50" title="Skip for now"><X size={16} /></button>
        </div>
        <h2 className="font-serif text-2xl mb-2">What are you here for?</h2>
        <p className="muted text-sm mb-5">Three quick answers tune your dashboard, recommended drills, and default mode. You can change any of this in Settings.</p>

        <div className="mb-5">
          <label className="label-mono mb-1.5">I am a…</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => setRole(r.id)}
                className={`rounded-sm border px-3 py-2 text-left transition-colors ${role === r.id ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900" : "hair hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[11px] faint leading-snug mt-0.5">{r.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="label-mono mb-1.5">My primary event</label>
          <select value={event} onChange={(e) => setEvent(e.target.value)} className="field">
            <option value="">Choose…</option>
            {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>

        <div className="mb-6">
          <label className="label-mono mb-1.5">Right now I want to…</label>
          <div className="grid grid-cols-1 gap-1.5">
            {FOCUSES.map((f) => (
              <button key={f.id} onClick={() => setFocus(f.id)}
                className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${focus === f.id ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900" : "hair hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button onClick={() => finish(true)} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">Skip for now</button>
          <button onClick={() => finish(false)} disabled={!ready || saving} className="btn-solid py-2.5 px-5 text-sm">
            {saving ? "Setting up…" : <>Start <ArrowRight size={14} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
