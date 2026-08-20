import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Timer, CheckCircle2, Circle, Loader2, Play, Pause, RotateCcw, Sparkles,
  ArrowLeft, ChevronRight, Target, Clock
} from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { streamText } from "../lib/api.js";
import { DRILLS, DIFFICULTIES, drillsFor, drillById, difficultyLabel, minutesLabel, saveLocalDrillResult, loadLocalDrillResults } from "../lib/drills.js";
import { saveDrillResult, listDrillResults } from "../lib/firebase.js";
import { computeProfile, levelForProfile } from "../lib/skills.js";
import { listProjects } from "../lib/firebase.js";
import { SKILLS, skillById } from "../lib/skills.js";
import { loadPrefs } from "../lib/prefs.js";
import { cx } from "../lib/ui.js";

const DRAFT_AUTOSAVE_KEY = "fracture_draft_autosave";

export default function Practice() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [event, setEvent] = useState("");
  const [skill, setSkill] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [completed, setCompleted] = useState([]);
  const [level, setLevel] = useState("beginner");
  const [activeId, setActiveId] = useState(params.get("drill"));

  // Load the user's completion state + level from their profile.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const prefs = loadPrefs();
      let done = [];
      if (user) {
        try {
          const rows = await listDrillResults(user.id);
          done = rows.filter((r) => r.score != null).map((r) => r.drillId);
        } catch (_) {}
        try {
          const projects = await listProjects(user.id);
          if (mounted) setLevel(levelForProfile(computeProfile(projects)));
        } catch (_) {}
      } else {
        done = Object.entries(loadLocalDrillResults()).filter(([, v]) => v.score != null).map(([id]) => id);
      }
      if (mounted) {
        setCompleted(done);
        if (prefs.event) setEvent(prefs.event);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const filtered = useMemo(() => drillsFor({ event, skill, difficulty, level, completed }), [event, skill, difficulty, level, completed]);

  const active = activeId ? drillById(activeId) : null;

  function markCompleted(id) {
    setCompleted((prev) => [...new Set([...prev, id])]);
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <header className="mb-6">
        <div className="label-mono mb-2">Practice / Drills</div>
        <h1 className="font-serif text-4xl md:text-5xl">Train the skills that win rounds.</h1>
        <p className="muted mt-3 max-w-xl text-sm leading-relaxed">
          Ten focused drills covering rebuttal, cross-ex, organization, evidence, delivery, and prep.
          Recommended level: <span className="font-medium text-zinc-950 dark:text-zinc-50 capitalize">{level}</span> — earned from your saved audit scores.
        </p>
      </header>

      {active ? (
        <DrillRunner
          drill={active}
          user={user}
          completed={completed.includes(active.id)}
          onBack={() => setActiveId(null)}
          onComplete={(score) => { markCompleted(active.id); }}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <select value={event} onChange={(e) => setEvent(e.target.value)} className="field !w-auto !py-2 !px-3 text-xs">
              <option value="">All events</option>
              {["argument", "speech", "essay", "research-paper", "model-un"].map((e) => (
                <option key={e} value={e}>{e === "argument" ? "Debate / Argument" : e === "speech" ? "Speech" : e === "research-paper" ? "Research paper" : e === "model-un" ? "Model UN" : "Essay / Writing"}</option>
              ))}
            </select>
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className="field !w-auto !py-2 !px-3 text-xs">
              <option value="">All skills</option>
              {SKILLS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="field !w-auto !py-2 !px-3 text-xs">
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <span className="ml-auto self-center text-xs faint">
              {filtered.length} {filtered.length === 1 ? "drill" : "drills"} · completed {completed.length}/{DRILLS.length}
            </span>
          </div>

          {filtered.length === 0 && (
            <div className="card p-10 text-center">
              <Target size={26} className="faint mx-auto mb-4" />
              <p className="muted text-sm">No drills match those filters. Loosen one and try again.</p>
              <button onClick={() => { setEvent(""); setSkill(""); setDifficulty(""); }} className="btn-ghost mt-4 py-2 px-4 text-xs">Clear filters</button>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <button key={d.id} onClick={() => setActiveId(d.id)} className="card card-hover p-5 text-left flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className={cx(
                    "text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full",
                    d.difficulty === "beginner" && "bg-green-500/15 text-green-600 dark:text-green-400",
                    d.difficulty === "intermediate" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    d.difficulty === "advanced" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                    d.difficulty === "competitive" && "bg-red-500/15 text-red-600 dark:text-red-400"
                  )}>{difficultyLabel(d.difficulty)}</span>
                  {d.completed && <CheckCircle2 size={16} className="text-green-500" />}
                </div>
                <h3 className="font-serif text-lg leading-snug mb-1.5">{d.title}</h3>
                <p className="muted text-sm leading-relaxed mb-4">{d.tagline}</p>
                <div className="flex items-center gap-2 text-xs faint mt-auto">
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {minutesLabel(d.minutes)}</span>
                  <span className="inline-flex items-center gap-1 ml-1"><Target size={12} /> {d.skills.map((s) => skillById(s).label).join(" · ")}</span>
                  <ChevronRight size={14} className="ml-auto" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Drill runner
──────────────────────────────────────────────────────────────────────────── */

function DrillRunner({ drill, user, completed, onBack, onComplete }) {
  const [done, setDone] = useState(() => drill.instructions.map(() => false));
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(null);
  const [topic, setTopic] = useState("");
  const [material, setMaterial] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const target = drill.minutes * 60;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => {
      if (s >= target) { clearInterval(t); setRunning(false); return s; }
      return s + 1;
    }), 1000);
    return () => clearInterval(t);
  }, [running, target]);

  const allDone = done.every(Boolean);
  const remaining = Math.max(0, target - seconds);

  async function generate() {
    if (genBusy) return;
    setGenBusy(true); setMaterial(""); setErr(null);
    try {
      let prompt = drill.aiPrompt || "Give me a practice prompt for this drill.";
      if (topic.trim()) prompt = prompt.replace(/\[topic\]/g, topic.trim());
      await streamText("chat", { message: prompt, draft: "" }, {
        onDelta: (d) => setMaterial((m) => m + d)
      });
    } catch (e) {
      setErr("The practice generator is busy — try again in a moment.");
    } finally {
      setGenBusy(false);
    }
  }

  async function complete() {
    const s = score == null ? 6 : score;
    const result = { score: s, seconds, completedAt: Date.now() };
    if (user) { try { await saveDrillResult(user.id, drill.id, result); } catch (_) {} }
    saveLocalDrillResult(drill.id, result);
    setSaved(true);
    onComplete(s);
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
      {/* Instructions + AI */}
      <section className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <button onClick={onBack} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 mb-3"><ArrowLeft size={13} /> All drills</button>
            <h2 className="font-serif text-3xl">{drill.title}</h2>
            <p className="muted text-sm mt-1">{drill.tagline}</p>
          </div>
          {completed && <span className="pill text-green-600 dark:text-green-400"><CheckCircle2 size={12} /> Completed</span>}
        </div>

        <div className="label-mono mb-2">Instructions</div>
        <ol className="space-y-2 mb-5">
          {drill.instructions.map((step, i) => (
            <li key={i}>
              <button onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
                className="w-full flex items-start gap-3 text-left rounded-sm px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                {done[i] ? <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" /> : <Circle size={16} className="faint shrink-0 mt-0.5" />}
                <span className={cx("text-sm leading-relaxed", done[i] && "faint line-through")}>{step}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="label-mono mb-2">Practice material</div>
        <div className="flex gap-2 mb-3">
          <input value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Optional topic (fills [topic] in generated prompts)"
            className="field flex-1 !py-2 text-sm" />
          <button onClick={generate} disabled={genBusy} className="btn-ghost !py-2 !px-4 text-xs shrink-0">
            {genBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Generate
          </button>
        </div>
        <div className="rounded-sm bg-zinc-50 dark:bg-zinc-900/50 border hair p-4 min-h-[120px]">
          {material ? (
            <p className="muted text-sm leading-relaxed whitespace-pre-line">{material}</p>
          ) : (
            <p className="faint text-xs">
              {drill.aiPrompt
                ? "Generate an opponent attack, a prompt, or a question set to drill against — it streams in here."
                : "No AI material for this drill — it's a self-directed exercise."}
            </p>
          )}
        </div>
        {err && <p className="text-red-500 text-sm mt-2">{err}</p>}
      </section>

      {/* Timer + score */}
      <section className="card p-6 lg:sticky lg:top-20">
        <div className="label-mono mb-2">Timer</div>
        <div className="font-serif text-5xl tabular-nums mb-4">
          {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, "0")}
        </div>
        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-zinc-950 dark:bg-zinc-100 transition-[width] duration-1000" style={{ width: `${Math.min(100, (seconds / target) * 100)}%` }} />
        </div>
        <div className="flex gap-2 mb-5">
          <button onClick={() => setRunning((r) => !r)} className="btn-solid flex-1 !py-2 text-xs">
            {running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> {seconds === 0 ? "Start" : "Resume"}</>}
          </button>
          <button onClick={() => { setRunning(false); setSeconds(0); }} className="btn-ghost !py-2 !px-4 text-xs"><RotateCcw size={13} /></button>
        </div>

        <div className="label-mono mb-2">How did it go?</div>
        <div className="flex items-center gap-3 mb-1">
          <input type="range" min={0} max={drill.selfScore.max} value={score ?? Math.ceil(drill.selfScore.max / 2)}
            onChange={(e) => setScore(Number(e.target.value))} className="flex-1 accent-zinc-950 dark:accent-zinc-100" />
          <span className="font-mono text-sm">{score ?? Math.ceil(drill.selfScore.max / 2)}/{drill.selfScore.max}</span>
        </div>
        <p className="faint text-xs mb-5">
          {score == null ? drill.selfScore.mid : score <= drill.selfScore.max * 0.4 ? drill.selfScore.low : score >= drill.selfScore.max * 0.8 ? drill.selfScore.high : drill.selfScore.mid}
        </p>

        {saved ? (
          <div className="rounded-sm border border-green-500/30 bg-green-500/10 p-3 text-center text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={15} className="inline mr-1" /> Logged — this counts toward your profile.
          </div>
        ) : (
          <button onClick={complete} disabled={!allDone} className="btn-solid w-full !py-2.5 text-sm" title={allDone ? "" : "Tick every instruction first"}>
            {allDone ? "Mark drill complete" : `${done.filter(Boolean).length}/${drill.instructions.length} steps done`}
          </button>
        )}
        <p className="faint text-xs mt-3 text-center">Completed drills shift the recommendations on your dashboard.</p>
      </section>
    </div>
  );
}
