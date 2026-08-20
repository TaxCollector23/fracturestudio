// timer.js — a flexible, reusable timer for the competition layer.
//
// One state machine serves speech timers, prep timers, crossfire/cross-ex
// timers, and custom event slots. The pure functions (makeTimer, timerTick,
// timerStart, …) are unit-testable without a browser; useTimer is the thin
// React wrapper that ticks on an interval and signals completion.
//
// State:
//   duration   — total seconds the timer runs for
//   elapsed    — seconds elapsed (accumulates across pause/resume)
//   remaining  — duration - elapsed
//   running    — whether the interval is live
//   state      — idle | running | paused | finished
//   warningAt  — seconds remaining threshold that flips `warned` (e.g. 30)
//   warned     — true once remaining has crossed below warningAt

export function makeTimer(duration, { warningAt = null } = {}) {
  const d = Math.max(0, Number(duration) || 0);
  return {
    duration: d,
    elapsed: 0,
    remaining: d,
    running: false,
    state: d <= 0 ? "finished" : "idle",
    anchor: null,
    warningAt: warningAt == null ? null : Math.max(0, Number(warningAt)),
    warned: false
  };
}

/** Advance the clock. Safe to call any time; no-ops when not running. */
export function timerTick(t, now = Date.now()) {
  if (!t.running || t.state === "finished") return t;
  const elapsed = t.elapsed + Math.max(0, (now - (t.anchor || now)) / 1000);
  const remaining = Math.max(0, t.duration - elapsed);
  const warned = t.warned || (t.warningAt != null && remaining <= t.warningAt && remaining > 0);
  const state = remaining <= 0 ? "finished" : "running";
  // anchor advances to `now` so drift never accumulates between ticks
  return { ...t, elapsed, remaining, warned, state, anchor: now };
}

export function timerStart(t, now = Date.now()) {
  if (t.state === "finished") return timerReset(t);
  return { ...t, running: true, state: "running", anchor: now, warned: t.warned };
}

export function timerPause(t, now = Date.now()) {
  const ticked = timerTick(t, now);
  if (ticked.state === "finished") return ticked;
  return { ...ticked, running: false, state: "paused", anchor: null };
}

export function timerResume(t, now = Date.now()) {
  if (t.state === "finished") return t;
  return { ...t, running: true, state: "running", anchor: now };
}

export function timerReset(t) {
  return { ...t, elapsed: 0, remaining: t.duration, running: false, state: t.duration <= 0 ? "finished" : "idle", anchor: null, warned: false };
}

/** Add seconds to the clock (used for authorized extensions / grace). */
export function timerExtend(t, seconds) {
  const extra = Math.max(0, Number(seconds) || 0);
  const duration = t.duration + extra;
  return { ...t, duration, remaining: Math.max(0, duration - t.elapsed) };
}

/** True when the timer is showing "over time" (speaker kept going). */
export function isOverTime(t) {
  return t.elapsed > t.duration;
}

// ─── React hook ──────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";

let chimeCtx = null;
function playChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    chimeCtx = chimeCtx || new AC();
    const ctx = chimeCtx;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  } catch (_) { /* audio is best-effort */ }
}

/**
 * React timer. Returns the timer state plus control functions.
 * `onComplete` fires once when the clock hits zero.
 */
export function useTimer({ duration, warningAt = null, onComplete = null, autostart = false, beep = true } = {}) {
  const [timer, setTimer] = useState(() => makeTimer(duration, { warningAt }));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const beepRef = useRef(beep);
  beepRef.current = beep;

  // Keep duration/warning changes in sync (e.g. switching slots).
  useEffect(() => {
    setTimer((t) => ({ ...t, duration, warningAt, remaining: Math.max(0, duration - t.elapsed) }));
  }, [duration, warningAt]);

  useEffect(() => {
    if (autostart && timer.state === "idle") setTimer((t) => timerStart(t));
  }, [autostart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timer.running) return undefined;
    const id = setInterval(() => {
      setTimer((t) => {
        const next = timerTick(t, Date.now());
        if (next.state === "finished" && t.state !== "finished") {
          if (beepRef.current) playChime();
          onCompleteRef.current?.();
        }
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [timer.running]);

  return {
    ...timer,
    start: () => setTimer((t) => timerStart(t)),
    pause: () => setTimer((t) => timerPause(t)),
    resume: () => setTimer((t) => timerResume(t)),
    toggle: () => setTimer((t) => (t.running ? timerPause(t) : t.state === "finished" ? timerReset(t) : timerStart(t))),
    reset: () => setTimer((t) => timerReset(t)),
    extend: (seconds) => setTimer((t) => timerExtend(t, seconds))
  };
}

/** mm:ss clock display for a seconds value. */
export function fmtClock(total) {
  const s = Math.max(0, Math.round(total || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
