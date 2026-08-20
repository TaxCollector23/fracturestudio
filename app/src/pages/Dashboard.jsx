import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Sparkles, Flag, Timer,
  Plus, FolderOpen, PenLine, Swords, Loader2, CheckCircle2, X, TrendingUp, AlertTriangle, Trophy
} from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { listProjects, listGoals, addGoal, updateGoal, deleteGoal, listDrillResults, loadPreferences } from "../lib/firebase.js";
import { computeProfile, recommendNext, skillById, daysUntil, levelForProfile } from "../lib/skills.js";
import { DRILLS, completedDrillIdsFromLocal, loadLocalDrillResults } from "../lib/drills.js";
import { loadLocalGoals, saveLocalGoal, removeLocalGoal, newGoal, buildTrainingPlan, GOAL_TEMPLATES, GOAL_PRIORITIES } from "../lib/goals.js";
import { loadPrefs, ROLES, EVENTS, eventById, roleById, formatById } from "../lib/prefs.js";
import OnboardingModal from "../components/OnboardingModal.jsx";
import { cx } from "../lib/ui.js";

const DRAFT_AUTOSAVE_KEY = "fracture_draft_autosave";

function ScoreTrend({ delta }) {
  if (delta == null) return <span className="faint text-xs">—</span>;
  if (delta > 0) return <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400"><ArrowUpRight size={13} /> +{delta}</span>;
  if (delta < 0) return <span className="inline-flex items-center gap-0.5 text-xs text-red-500"><ArrowDownRight size={13} /> {delta}</span>;
  return <span className="inline-flex items-center gap-0.5 text-xs faint"><Minus size={13} /> flat</span>;
}

function TrendArrow({ trend }) {
  if (trend === "up") return <ArrowUpRight size={13} className="text-green-600 dark:text-green-400" />;
  if (trend === "down") return <ArrowDownRight size={13} className="text-red-500" />;
  if (trend === "new") return <span className="text-[10px] font-mono faint">NEW</span>;
  return <Minus size={13} className="faint" />;
}

function MiniTrend({ scores }) {
  // Tiny SVG sparkline of overall scores over time.
  if (!scores || scores.length < 2) return null;
  const w = 120, h = 28;
  const min = Math.min(...scores), max = Math.max(...scores);
  const range = Math.max(1, max - min);
  const pts = scores.map((s, i) => `${(i / (scores.length - 1)) * w},${h - 3 - ((s - min) / range) * (h - 6)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400 dark:text-zinc-500" />
    </svg>
  );
}

function StatCard({ label, children, sub }) {
  return (
    <div className="card p-4">
      <div className="label-mono mb-1">{label}</div>
      <div className="text-2xl font-serif leading-none">{children}</div>
      {sub && <div className="text-xs faint mt-1.5">{sub}</div>}
    </div>
  );
}

function openInStudio(navigate, it) {
  sessionStorage.setItem("fracture_continue", JSON.stringify({ draft: it.draft, audit: it.audit, mode: it.mode }));
  navigate("/studio");
}

export default function Dashboard() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [prefs, setPrefs] = useState(loadPrefs());
  const [projects, setProjects] = useState(null);
  const [goals, setGoals] = useState(null);
  const [drillResults, setDrillResults] = useState(null);
  const [err, setErr] = useState(null);
  const [draftStash, setDraftStash] = useState(null);
  const [goalModal, setGoalModal] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_AUTOSAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.draft?.trim()) setDraftStash(d);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setGoals(loadLocalGoals());
      setDrillResults({ local: loadLocalDrillResults() });
      return;
    }
    listProjects(user.id).then(setProjects).catch((e) => { setErr(e?.message || "Could not load your history."); setProjects([]); });
    listGoals(user.id).then(setGoals).catch(() => setGoals([]));
    listDrillResults(user.id).then((rows) => {
      const byDrill = {};
      for (const r of rows) byDrill[r.drillId] = r;
      setDrillResults(byDrill);
    }).catch(() => setDrillResults({}));
    loadPreferences(user.id).then((remote) => {
      if (remote) setPrefs((p) => ({ ...p, ...remote }));
    }).catch(() => {});
  }, [user]);

  // Open the goal modal via palette ("?goal=1").
  useEffect(() => {
    if (params.get("goal")) { setGoalModal(true); setParams({}, { replace: true }); }
  }, [params, setParams]);

  const profile = useMemo(() => computeProfile(projects || []), [projects]);

  const completedDrills = useMemo(() => {
    if (user && drillResults) return Object.keys(drillResults);
    if (drillResults?.local) return completedDrillIdsFromLocal();
    return [];
  }, [user, drillResults]);

  const recs = useMemo(() => recommendNext({
    profile,
    drills: DRILLS,
    completedDrills,
    goals: goals || [],
    today: new Date()
  }), [profile, completedDrills, goals]);

  const plan = useMemo(() => buildTrainingPlan({
    profile,
    drills: DRILLS,
    completed: completedDrills,
    goals: goals || [],
    event: prefs.event,
    today: new Date()
  }), [profile, completedDrills, goals, prefs.event]);

  const scores = useMemo(() => (profile?.projects || []).filter((p) => typeof p.score === "number").map((p) => p.score), [profile]);

  const activeGoals = (goals || []).filter((g) => g.status !== "done" && g.status !== "archived");
  const nearest = activeGoals
    .map((g) => ({ goal: g, days: daysUntil(g.targetDate) }))
    .filter((x) => x.days != null && x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  const role = roleById(prefs.role);
  const ev = eventById(prefs.event);
  const level = levelForProfile(profile);

  async function saveGoal(g) {
    if (!g.text.trim()) return;
    if (user) {
      const id = await addGoal(user.id, { ...g, text: g.text.trim() });
      setGoals((prev) => [{ ...g, id }, ...(prev || [])]);
    } else {
      const id = "g" + Date.now();
      const rec = { ...g, id, text: g.text.trim() };
      saveLocalGoal(rec);
      setGoals((prev) => [rec, ...(prev || [])]);
    }
  }

  async function setGoalStatus(g, status) {
    if (user) { await updateGoal(user.id, g.id, { status }); }
    else { saveLocalGoal({ ...g, status }); }
    setGoals((prev) => (prev || []).map((x) => (x.id === g.id ? { ...x, status } : x)));
  }

  async function removeGoal(g) {
    if (user) { await deleteGoal(user.id, g.id); }
    else { removeLocalGoal(g.id); }
    setGoals((prev) => (prev || []).filter((x) => x.id !== g.id));
  }

  const loading = !ready || (user && projects === null);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
        <Loader2 className="animate-spin faint" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      {!prefs.onboardingDone && <OnboardingModal />}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div>
          <div className="label-mono mb-2">Your workspace</div>
          <h1 className="font-serif text-4xl md:text-5xl">
            {user ? `Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""}.` : "Your practice workspace."}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {ev && <span className="pill">{ev.label}</span>}
          <span className="pill capitalize">{role.label}</span>
          {profile.sessions > 0 && <span className="pill capitalize">{level} level</span>}
        </div>
      </div>

      {!user && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm muted">
            Sign in to save audits and track skills across sessions — your history, goals, and drills follow your account.
          </p>
          <Link to="/auth" className="btn-solid py-2 px-4 text-xs">Sign in <ArrowRight size={13} /></Link>
        </div>
      )}

      {/* Competition: upcoming rounds I'm in */}
      <CompetitionStrip user={user} />

      {/* What should I do now */}
      {recs.length > 0 && (
        <section className="mb-6">
          <div className="label-mono mb-2">Do this next</div>
          <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-l-2 border-l-zinc-950 dark:border-l-zinc-100">
            <div className="flex-1 min-w-0">
              <p className="font-serif text-lg leading-snug">{recs[0].title}</p>
              <p className="muted text-sm mt-1.5 leading-relaxed"><span className="label-mono mr-1 inline-block align-middle">Why</span> {recs[0].why}</p>
            </div>
            {recs[0].action && (
              <button
                onClick={() => {
                  const a = recs[0].action;
                  if (a.type === "drill") navigate(`/practice?drill=${a.target}`);
                  else if (a.type === "audit") navigate("/studio");
                  else navigate(a.target);
                }}
                className="btn-solid shrink-0 py-2.5 px-5 text-sm">{recs[0].action.label} <ArrowRight size={14} /></button>
            )}
          </div>
        </section>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Last audit score" sub={profile.sessions ? `${profile.sessions} saved ${profile.sessions === 1 ? "session" : "sessions"}` : "No audits yet"}>
          {profile.lastScore != null ? (
            <span className="flex items-center gap-2">{profile.lastScore}<ScoreTrend delta={profile.scoreDelta} /></span>
          ) : "—"}
        </StatCard>
        {profile.scoreAvg != null && profile.scoreAvg !== profile.lastScore && (
          <StatCard label="Vs your average" sub={profile.lastScore > profile.scoreAvg ? "Above your baseline — keep it up" : "Below your baseline — the plan below targets it"}>
            <span className="flex items-center gap-2 text-xl">{profile.lastScore > profile.scoreAvg ? "+" : ""}{profile.lastScore - profile.scoreAvg}<span className="faint text-xs">vs {profile.scoreAvg}</span></span>
          </StatCard>
        )}
        <StatCard label="Weakest skill" sub={profile.weakest ? `${skillById(profile.weakest.id).label} · avg ${profile.weakest.avg}` : "Needs data"}>
          <span className="text-xl">{profile.weakest ? skillById(profile.weakest.id).label : "—"}</span>
        </StatCard>
        <StatCard label="Active goals" sub={nearest ? `Next: ${daysUntil(nearest.goal.targetDate)} ${daysUntil(nearest.goal.targetDate) === 1 ? "day" : "days"}` : "No deadlines set"}>
          {activeGoals.length}
        </StatCard>
        <StatCard label="Trend" sub={profile.overallAvg != null ? `All-skill average ${profile.overallAvg}` : "Run your first audit"}>
          <div className="flex items-center gap-2 text-sm">
            {profile.overallAvg != null ? <span>{profile.overallAvg}<span className="faint text-xs">/100</span></span> : "—"}
            <div className="flex-1 max-w-[90px]"><MiniTrend scores={scores} /></div>
          </div>
        </StatCard>
      </div>

      {profile.sessions === 0 && !activeGoals.length && !draftStash ? (
        /* ── First-run empty state ── */
        <section className="card p-10 text-center">
          <Sparkles size={30} className="faint mx-auto mb-4" />
          <h2 className="font-serif text-2xl mb-2">This is where your improvement shows up.</h2>
          <p className="muted max-w-md mx-auto text-sm leading-relaxed mb-6">
            Run an audit on a draft, save it, and Fracture starts tracking skills, scores, and weaknesses over
            time — then tells you exactly what to practice next.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/studio" className="btn-solid"><PenLine size={15} /> Run your first audit</Link>
            <Link to="/practice" className="btn-ghost"><Timer size={15} /> Browse drills</Link>
            <button onClick={() => setGoalModal(true)} className="btn-ghost"><Flag size={15} /> Set a goal</button>
          </div>
        </section>
      ) : (
        <>
          {/* Skill profile + goals/plan */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6 items-start">
            <section className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl">Skill profile</h2>
                <span className="faint text-xs">{profile.sessions > 0 ? "from your saved audits" : "from this session"}</span>
              </div>

              {!profile.skills || Object.values(profile.skills).every((v) => v == null) ? (
                <div className="text-sm muted py-6 text-center">
                  <p className="mb-2">No skill data yet.</p>
                  <p className="faint text-xs">Run and save an audit — argumentation, rebuttal, evidence, and the rest are scored from the report.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(profile.skills)
                    .filter(([, v]) => v != null)
                    .sort((a, b) => b[1].avg - a[1].avg)
                    .slice(0, 8)
                    .map(([id, v]) => (
                      <div key={id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="muted flex items-center gap-1.5">{skillById(id).label}<TrendArrow trend={v.trend} /></span>
                          <span className="font-mono">{v.avg}<span className="faint">·{v.count}</span></span>
                        </div>
                        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={cx("h-full rounded-full", v.avg >= 70 ? "bg-green-500" : v.avg >= 45 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${Math.max(4, v.avg)}%` }} />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {(profile.recentlyImproved.length > 0 || profile.persistentWeaknesses.length > 0) && (
                <div className="mt-5 space-y-3 border-t hair pt-4">
                  {profile.recentlyImproved.length > 0 && (
                    <div>
                      <div className="label-mono mb-1.5 flex items-center gap-1"><TrendingUp size={12} /> Recently improved</div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.recentlyImproved.map((s) => (
                          <span key={s.id} className="pill text-green-600 dark:text-green-400">{skillById(s.id).label} +{s.delta}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.persistentWeaknesses.length > 0 && (
                    <div>
                      <div className="label-mono mb-1.5 flex items-center gap-1"><AlertTriangle size={12} /> Consistent trouble spots</div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.persistentWeaknesses.map((s) => (
                          <span key={s.id} className="pill text-red-500">{skillById(s.id).label} · {s.avg}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-6">
              {/* Goals */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-xl">Goals</h2>
                  <button onClick={() => setGoalModal(true)} className="btn-ghost py-1.5 px-3 text-xs"><Plus size={13} /> New goal</button>
                </div>
                {activeGoals.length === 0 ? (
                  <p className="muted text-sm py-2">Set a goal — a tournament date, a skill to fix, a score to hit — and the plan below adapts to it.</p>
                ) : (
                  <ul className="space-y-2">
                    {activeGoals.slice(0, 4).map((g) => (
                      <li key={g.id} className="flex items-start gap-3 rounded-sm border hair px-3 py-2.5">
                        <button onClick={() => setGoalStatus(g, "done")} title="Mark complete" className="mt-0.5 faint hover:text-green-600 dark:hover:text-green-400"><CheckCircle2 size={15} /></button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">{g.text}</p>
                          <p className="faint text-xs mt-0.5">
                            {eventById(g.event)?.label || "Any event"} {g.targetDate && <>· target {formatDate(g.targetDate)}</>}
                            {g.priority === "high" && " · high priority"}
                          </p>
                        </div>
                        <button onClick={() => removeGoal(g)} className="faint hover:text-red-500 mt-0.5" title="Remove"><X size={13} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Training plan */}
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-xl">Next 5 practice days</h2>
                  <Link to="/practice" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">All drills →</Link>
                </div>
                <p className="faint text-xs mb-3">Rebuilt from your current profile, goals, and completed drills — it changes as you practice.</p>
                <ol className="space-y-2">
                  {plan.map((d) => (
                    <li key={d.day} className="flex items-start gap-3">
                      <span className="label-mono mt-0.5 shrink-0 w-10">{d.day}</span>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => d.action.type === "drill" ? navigate(`/practice?drill=${d.action.target}`) : d.action.type === "audit" ? navigate("/studio") : navigate(d.action.target)}
                          className="text-sm font-medium hover:text-zinc-950 dark:hover:text-zinc-50 text-left leading-snug">{d.title}</button>
                        <p className="faint text-xs mt-0.5 leading-relaxed">{d.why}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          </div>

          {/* Recent + draft stash + quick actions */}
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <section className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl">Recent work</h2>
                <Link to="/past-work" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">Past Work →</Link>
              </div>
              {draftStash && (
                <button onClick={() => navigate("/studio")} className="w-full flex items-center gap-3 rounded-sm border hair px-3 py-2.5 mb-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <PenLine size={15} className="faint shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Unsaved draft waiting in the Studio</p>
                    <p className="faint text-xs truncate">“{draftStash.draft.slice(0, 80)}…”</p>
                  </div>
                  <ArrowRight size={14} className="faint" />
                </button>
              )}
              {!user && profile.sessions === 0 ? (
                <p className="muted text-sm py-2">Saved audits appear here — sign in and hit Save on any report.</p>
              ) : (profile.projects || []).slice(-5).reverse().length === 0 ? (
                <p className="muted text-sm py-2">Nothing saved yet. Run an audit and press Save to build your history.</p>
              ) : (
                <ul className="space-y-2">
                  {(profile.projects || []).slice(-5).reverse().map((p) => (
                    <li key={p.id}>
                      <button onClick={() => openInStudio(navigate, p)} className="w-full flex items-center gap-3 rounded-sm border hair px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                        <FolderOpen size={15} className="faint shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.title || "Untitled draft"}</p>
                          <p className="faint text-xs">{formatById(p.mode).label}{p.score != null && <> · {p.score}/100</>}</p>
                        </div>
                        <span className="text-xs faint shrink-0">Continue →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card p-5">
              <h2 className="font-serif text-xl mb-4">Quick actions</h2>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/studio" className="rounded-sm border hair p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <PenLine size={18} className="faint mb-2" /><div className="text-sm font-medium">New audit</div><div className="faint text-xs mt-0.5">Fracture a draft</div>
                </Link>
                <Link to="/practice" className="rounded-sm border hair p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <Timer size={18} className="faint mb-2" /><div className="text-sm font-medium">Practice a drill</div><div className="faint text-xs mt-0.5">{DRILLS.length} timed drills</div>
                </Link>
                <Link to="/rebuttals" className="rounded-sm border hair p-4 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <Swords size={18} className="faint mb-2" /><div className="text-sm font-medium">Rebuttal prep</div><div className="faint text-xs mt-0.5">Opponent plan</div>
                </Link>
                <button onClick={() => setGoalModal(true)} className="rounded-sm border hair p-4 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <Flag size={18} className="faint mb-2" /><div className="text-sm font-medium">New goal</div><div className="faint text-xs mt-0.5">Get a training plan</div>
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {err && <p className="text-red-500 text-sm mt-4">{err}</p>}

      {goalModal && (
        <GoalModal
          onClose={() => setGoalModal(false)}
          onSave={async (g) => { await saveGoal(g); setGoalModal(false); }}
          prefs={prefs}
          setPrefs={setPrefs}
        />
      )}
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Small strip on the dashboard: upcoming competition rounds the user is part
// of. Silently renders nothing when there is no competition data.
function CompetitionStrip({ user }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { listMy, listItems } = await import("../lib/competition.js");
        const ts = await listMy("tournaments");
        const data = await Promise.all((ts || []).map(async (t) => {
          const rounds = await listItems("rounds", t.id).catch(() => []);
          return { t, rounds: rounds || [] };
        }));
        if (mounted) setRows(data);
      } catch (_) {
        if (mounted) setRows([]);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  if (!rows) return null;
  const upcoming = [];
  for (const { t, rounds } of rows) {
    for (const r of rounds) {
      const part = user?.id ? r.participants && user.id in (r.participants || {}) : true;
      if (part && (r.status === "not-started" || r.status === "active")) upcoming.push({ r, t });
    }
  }
  if (!upcoming.length) return null;
  return (
    <section className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-lg flex items-center gap-2"><Trophy size={15} className="faint" /> Competition</h2>
        <Link to="/compete" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">All competitions →</Link>
      </div>
      <ul className="space-y-1.5">
        {upcoming.slice(0, 3).map(({ r, t }) => (
          <li key={r.id}>
            <Link to={`/compete/tournament/${t.id}/round/${r.id}`}
              className="flex items-center gap-2 text-sm rounded-sm px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <span className={r.status === "active" ? "w-2 h-2 rounded-full bg-amber-500 shrink-0" : "w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-700 shrink-0"} />
              <span className="font-medium">{r.name || `Round ${r.number}`}</span>
              <span className="faint text-xs">· {t.name}</span>
              {r.status === "active" && <span className="pill ml-auto text-amber-600 dark:text-amber-400">live</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GoalModal({ onClose, onSave, prefs, setPrefs }) {
  const [text, setText] = useState("");
  const [event, setEvent] = useState(prefs.event || "");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!text.trim()) { setErr("Give the goal a name — even a short one."); return; }
    setBusy(true);
    try {
      await onSave(newGoal({ text: text.trim(), event, targetDate, priority }));
    } catch (e) {
      setErr(e?.message || "Could not save the goal.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="label-mono mb-1">New goal</div>
            <h3 className="font-serif text-2xl">What are you working toward?</h3>
          </div>
          <button onClick={onClose} className="faint hover:text-zinc-950 dark:hover:text-zinc-50"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label-mono mb-1.5">Goal</label>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. Win regionals · fix my rebuttals · hit 85 average" className="field" autoFocus />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {GOAL_TEMPLATES.map((t) => (
                <button key={t} onClick={() => setText(t)} className="pill text-[11px] hover:border-zinc-500">{t}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-mono mb-1.5">Event</label>
              <select value={event} onChange={(e) => setEvent(e.target.value)} className="field">
                <option value="">Any / mixed</option>
                {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-mono mb-1.5">Target date</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="field" />
            </div>
          </div>
          <div>
            <label className="label-mono mb-1.5">Priority</label>
            <div className="grid grid-cols-3 gap-1.5">
              {GOAL_PRIORITIES.map((p) => (
                <button key={p.id} onClick={() => setPriority(p.id)}
                  className={`rounded-sm border px-3 py-2 text-xs transition-colors ${priority === p.id ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900" : "hair"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-red-500 text-sm">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
            <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Create goal"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
