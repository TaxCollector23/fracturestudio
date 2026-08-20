import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, MessageSquare, ArrowRight, Shield } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { listMy, listItems, ASSIGNMENT_KINDS, sortByCreated, timeAgo } from "../lib/competition.js";
import { teamRole, canSeeTeamProgress } from "../lib/access.js";
import { EmptyState, LoadingBlock, ErrorNote } from "../components/CompKit.jsx";
import { cx } from "../lib/ui.js";

export default function CoachDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ts = await listMy("teams");
        const rows = await Promise.all((ts || []).map(async (t) => {
          const [members, assignments, submissions] = await Promise.all([
            Promise.resolve(t.members || {}),
            listItems("assignments", t.id).catch(() => []),
            listItems("submissions", t.id).catch(() => [])
          ]);
          return { team: t, members, assignments: assignments || [], submissions: submissions || [] };
        }));
        if (mounted) setData(rows);
      } catch (e) {
        if (mounted) { setErr(e?.message || "Could not load team progress."); setData([]); }
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const view = useMemo(() => {
    if (!data) return null;
    const rows = data.filter((r) => canSeeTeamProgress(r.team, user?.id));
    const stats = rows.map((r) => buildTeamStats(r));
    return { rows: stats, totalTeams: rows.length };
  }, [data, user?.id]);

  if (!view) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading team progress…" /></div>;

  const members = view.rows.flatMap((r) => r.members.map((m) => ({ ...m, teamName: r.team.name })));
  const allAssignments = view.rows.flatMap((r) => r.assignments.map((a) => ({ ...a, teamName: r.team.name, teamId: r.team.id })));
  const allSubmissions = view.rows.flatMap((r) => r.submissions.map((s) => ({ ...s, teamName: r.team.name })));

  // ── Who needs attention: members with incomplete / overdue work ──
  const attention = members
    .map((m) => {
      const mine = allAssignments.filter((a) => !a.assigneeIds?.length || a.assigneeIds.includes(m.id));
      const incomplete = mine.filter((a) => !allSubmissions.some((s) => s.assignmentId === a.id && s.uid === m.id && (s.status === "done" || s.status === "reviewed")));
      const overdue = incomplete.filter((a) => a.dueDate && new Date(a.dueDate).getTime() < Date.now());
      return { ...m, total: mine.length, incomplete: incomplete.length, overdue: overdue.length, lastActive: lastActivity(m.id, allSubmissions) };
    })
    .filter((m) => m.incomplete > 0)
    .sort((a, b) => b.overdue - a.overdue || b.incomplete - a.incomplete);

  // ── Open assignment kinds → what to practice next ──
  const practiceNext = allAssignments
    .filter((a) => a.status !== "closed")
    .map((a) => {
      const done = allSubmissions.filter((s) => s.assignmentId === a.id && (s.status === "done" || s.status === "reviewed")).length;
      const assigned = (a.assigneeIds?.length ? a.assigneeIds : []).length || 0;
      const total = a.assigneeIds?.length || 0;
      return { ...a, doneCount: done, totalCount: total };
    })
    .filter((a) => a.doneCount < a.totalCount || !a.assigneeIds?.length)
    .reduce((acc, a) => {
      const key = a.kind || "custom";
      if (!acc[key]) acc[key] = { kind: key, open: 0, titles: [] };
      acc[key].open += 1;
      acc[key].titles.push(a.title);
      return acc;
    }, {});

  // ── Improvement per member from self-scores ──
  const trends = members
    .map((m) => {
      const scores = allSubmissions
        .filter((s) => s.uid === m.id && s.selfScore != null)
        .sort((a, b) => String(a.completedAt || a.updatedAt).localeCompare(String(b.completedAt || b.updatedAt)))
        .map((s) => Number(s.selfScore));
      if (scores.length < 2) return { ...m, delta: null, avg: scores.length ? scores[scores.length - 1] : null, n: scores.length };
      const half = Math.floor(scores.length / 2);
      const first = avg(scores.slice(0, half));
      const second = avg(scores.slice(half));
      return { ...m, delta: +(second - first).toFixed(1), avg: second, n: scores.length };
    })
    .filter((m) => m.n >= 1);

  const improving = trends.filter((t) => t.delta != null && t.delta > 0).sort((a, b) => b.delta - a.delta);
  const struggling = trends.filter((t) => t.delta != null && t.delta < 0).sort((a, b) => a.delta - b.delta);

  const recentFeedback = sortByCreated(allSubmissions.filter((s) => s.feedback)).slice(0, 6);
  const recentActivity = sortByCreated(allSubmissions).slice(0, 6);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Coach dashboard</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-3">Who needs help, what to practice next.</h1>
      <p className="muted text-sm max-w-2xl mb-8 leading-relaxed">
        Aggregated across the teams you coach — assignments, completions, self-scores, and feedback.
        Built from shared team data only; students' private audit history stays private.
      </p>

      {err && <ErrorNote msg={err} />}
      {view.totalTeams === 0 && (
        <EmptyState icon={Shield} title="No teams to coach yet"
          body="Create a team (or get added as a coach) and start assigning work — completion and progress appear here automatically."
          action={<Link to="/compete" className="btn-solid py-2 px-4 text-sm">Open competitions <ArrowRight size={13} /></Link>} />
      )}

      {view.totalTeams > 0 && (
        <>
          {/* Who needs attention */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-serif text-xl flex items-center gap-2"><AlertTriangle size={17} className="text-amber-500" /> Who needs attention</h2>
              <span className="faint text-xs">({attention.length} member{attention.length === 1 ? "" : "s"} with open work)</span>
            </div>
            {attention.length === 0 ? (
              <div className="card p-5 text-sm muted flex items-center gap-2"><CheckCircle2 size={15} className="text-green-500" /> Everyone is current — no incomplete assignments.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {attention.slice(0, 9).map((m) => (
                  <div key={m.id} className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-mono shrink-0">{(m.name || m.id).slice(0, 2).toUpperCase()}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name || m.id}</p>
                        <p className="faint text-xs truncate">{m.teamName}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className={cx(m.overdue > 0 ? "text-red-500" : "faint")}>{m.overdue} overdue</span>
                      <span className="faint">{m.incomplete} of {m.total} incomplete</span>
                    </div>
                    {m.lastActive && <p className="faint text-[11px] mt-1.5">Last activity {m.lastActive}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* What to practice next */}
          <section className="mb-8">
            <h2 className="font-serif text-xl mb-3">What to practice next</h2>
            {Object.keys(practiceNext).length === 0 ? (
              <div className="card p-5 text-sm muted">No open assignments — assign something or mark them closed.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(practiceNext).map((p) => (
                  <div key={p.kind} className="card p-4">
                    <span className="pill">{ASSIGNMENT_KINDS.find((k) => k.id === p.kind)?.label || p.kind}</span>
                    <div className="font-serif text-3xl my-2">{p.open} open</div>
                    <p className="faint text-xs line-clamp-2">{(p.titles || []).slice(0, 2).join(" · ")}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-6 mb-8 items-start">
            {/* Improvement */}
            <section className="card p-5">
              <h2 className="font-serif text-xl mb-3">Where the team is improving</h2>
              {trends.length === 0 ? (
                <p className="faint text-xs">Self-scores from completed assignments power this — once members complete 2+ with scores, trends appear.</p>
              ) : (
                <div className="space-y-3">
                  {improving.length > 0 && (
                    <div>
                      <div className="label-mono mb-1.5">Improving</div>
                      {improving.map((t) => <TrendRow key={t.id} t={t} />)}
                    </div>
                  )}
                  {struggling.length > 0 && (
                    <div>
                      <div className="label-mono mb-1.5">Slipping</div>
                      {struggling.map((t) => <TrendRow key={t.id} t={t} down />)}
                    </div>
                  )}
                  {improving.length === 0 && struggling.length === 0 && (
                    <p className="faint text-xs">No clear trend yet — keep assigning self-scored work.</p>
                  )}
                </div>
              )}
            </section>

            {/* Recent feedback */}
            <section className="card p-5">
              <h2 className="font-serif text-xl mb-3 flex items-center gap-2"><MessageSquare size={17} className="faint" /> Recent feedback</h2>
              {recentFeedback.length === 0 ? (
                <p className="faint text-xs">Feedback you send on submissions shows up here.</p>
              ) : (
                <ul className="space-y-2">
                  {recentFeedback.map((s) => (
                    <li key={s.id} className="rounded-sm border hair px-3 py-2">
                      <p className="text-sm"><span className="font-medium">{s.name}</span> <span className="faint text-xs">· {s.teamName} · {timeAgo(s.updatedAt)}</span></p>
                      <p className="text-xs muted mt-0.5 line-clamp-2">“{s.feedback}”</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Recent activity */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif text-xl">Recent activity</h2>
              <Link to="/compete" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50">Competitions →</Link>
            </div>
            {recentActivity.length === 0 ? (
              <p className="faint text-xs">Assignment completions appear here as they happen.</p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    <span className="truncate"><span className="font-medium">{s.name}</span> completed work in <span className="faint">{s.teamName}</span></span>
                    <span className="faint text-xs ml-auto shrink-0">{timeAgo(s.completedAt || s.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function buildTeamStats({ team, members, assignments, submissions }) {
  return {
    team,
    members: Object.entries(members || {}).map(([id, m]) => ({ id, name: m?.name || id, role: m?.role || "member" })),
    assignments,
    submissions
  };
}

function lastActivity(uid, submissions) {
  const mine = submissions.filter((s) => s.uid === uid).map((s) => s.completedAt || s.updatedAt).filter(Boolean).sort();
  return mine.length ? timeAgo(mine[mine.length - 1]) : "";
}

function avg(list) {
  if (!list.length) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function TrendRow({ t, down }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-mono shrink-0">{(t.name || t.id).slice(0, 2).toUpperCase()}</span>
      <span className="truncate flex-1">{t.name || t.id}</span>
      <span className="faint text-xs">{t.n} scored</span>
      <span className={cx("font-mono text-xs inline-flex items-center gap-0.5", down ? "text-red-500" : "text-green-600 dark:text-green-400")}>
        {down ? <TrendingDown size={13} /> : <TrendingUp size={13} />} {down ? "" : "+"}{t.delta}
      </span>
    </div>
  );
}
