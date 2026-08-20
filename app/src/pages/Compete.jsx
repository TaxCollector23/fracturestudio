import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Users, Bell, Plus, ArrowRight, Shield, CalendarDays, ClipboardList, Loader2 } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { listMy, listItems, computeNotifications, newTournament, newTeam, TOURNAMENT_STATUSES } from "../lib/competition.js";
import { tournamentRole, teamRole } from "../lib/access.js";
import { writeMembership, joinTeamByCode } from "../lib/firebase.js";
import { StatusPill, RoleBadge, EmptyState, LoadingBlock, ErrorNote } from "../components/CompKit.jsx";
import { Modal, Field } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";
import { fmtDate } from "../lib/competition.js";

function isRealUid(id) {
  return !!id && !id.startsWith("p-") && !id.startsWith("j-") && !id.startsWith("t-") && id !== "me";
}

export default function Compete() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState(null);
  const [teams, setTeams] = useState(null);
  const [roundsByT, setRoundsByT] = useState({});
  const [ballotsByT, setBallotsByT] = useState({});
  const [err, setErr] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const [showTournament, setShowTournament] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [ts, tms] = await Promise.all([listMy("tournaments"), listMy("teams")]);
        if (!mounted) return;
        setTournaments(ts || []);
        setTeams(tms || []);
        const rounds = {};
        const ballots = {};
        await Promise.all((ts || []).map(async (t) => {
          const [rs, bs] = await Promise.all([listItems("rounds", t.id).catch(() => []), listItems("ballots", t.id).catch(() => [])]);
          rounds[t.id] = rs; ballots[t.id] = bs;
        }));
        if (mounted) { setRoundsByT(rounds); setBallotsByT(ballots); }
      } catch (e) {
        if (mounted) { setErr(e?.message || "Could not load your competitions."); setTournaments([]); setTeams([]); }
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const allRounds = useMemo(() => Object.values(roundsByT).flat(), [roundsByT]);
  const allBallots = useMemo(() => Object.values(ballotsByT).flat(), [ballotsByT]);

  const notifications = useMemo(() => {
    const byT = {};
    (tournaments || []).forEach((t) => { byT[t.id] = t; });
    return computeNotifications({
      uid: user?.id,
      teams: teams || [],
      assignments: [],
      tournaments: tournaments || [],
      rounds: allRounds,
      ballots: allBallots
    }).map((n) => ({ ...n, read: false }));
  }, [user, teams, tournaments, allRounds, allBallots]);

  const unread = notifications.filter((n) => !n.read).length;

  async function createTournament(data) {
    const { createItem } = await import("../lib/competition.js");
    const name = data.name;
    const t = newTournament({
      name,
      location: data.location,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.startDate && data.startDate <= new Date().toISOString().slice(0, 10) ? "active" : "upcoming",
      createdBy: user?.id || "",
      admins: user?.id ? { [user.id]: { name: user.name || user.email } } : { me: { name: "Solo organizer" } }
    });
    const tid = await createItem("tournaments", t);
    if (user?.id) await writeMembership(user.id, "tournaments", tid, { role: "admin", name: name }).catch(() => {});
    navigate(`/compete/tournament/${tid}`);
  }

  async function createTeam(data) {
    const { createItem } = await import("../lib/competition.js");
    const code = data.code || randomCode();
    const memberId = user?.id || "me";
    const tm = newTeam({
      name: data.name,
      motto: data.motto,
      code,
      createdBy: memberId,
      members: { [memberId]: { role: "coach", name: user?.name || "Solo coach", email: user?.email || "", joinedAt: new Date().toISOString() } }
    });
    const tid = await createItem("teams", tm);
    if (user?.id) await writeMembership(user.id, "teams", tid, { role: "coach", name: tm.name }).catch(() => {});
    navigate(`/compete/team/${tid}`);
  }

  async function joinTeam(code) {
    if (!user) return;
    const team = await joinTeamByCode(code);
    navigate(`/compete/team/${team.id}`);
  }

  if (tournaments === null || teams === null) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading your competitions…" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div>
          <div className="label-mono mb-2">Competition</div>
          <h1 className="font-serif text-4xl md:text-5xl">Tournaments, teams, and rounds.</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowJoin(true)} className="btn-ghost !py-2 !px-4 text-xs">Join team by code</button>
          <button onClick={() => setShowTeam(true)} className="btn-ghost !py-2 !px-4 text-xs"><Plus size={13} /> New team</button>
          <button onClick={() => setShowTournament(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> New tournament</button>
        </div>
      </div>
      <p className="muted text-sm max-w-2xl mb-6 leading-relaxed">
        Run a tournament end to end — events, rounds, judges, ballots, results — or run a team with assignments
        and shared prep. Coaches and tournament admins organize; judges judge; competitors see their rounds and results.
      </p>

      {err && <ErrorNote msg={err} />}

      {/* Notifications */}
      <button onClick={() => setNotifOpen((o) => !o)}
        className="card card-hover w-full p-4 mb-6 flex items-center gap-3 text-left">
        <Bell size={16} className="faint shrink-0" />
        <span className="text-sm font-medium">Notifications</span>
        {unread > 0 && <span className="ml-auto pill text-amber-600 dark:text-amber-400">{unread} new</span>}
        {unread === 0 && <span className="ml-auto faint text-xs">Nothing needs attention right now</span>}
      </button>
      {notifOpen && (
        <div className="card p-4 mb-6 space-y-2">
          {notifications.length === 0 && <p className="faint text-xs">No notifications. Assignments, ballots, and round changes appear here as they happen.</p>}
          {notifications.slice(0, 12).map((n) => (
            <Link key={n.id} to={n.link} className="flex items-start gap-3 rounded-sm border hair px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
              <span className={cx("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", n.read ? "bg-zinc-300" : "bg-amber-500")} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="faint text-xs">{n.body}</p>
              </div>
              <ArrowRight size={13} className="faint ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Tournaments */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl flex items-center gap-2"><Trophy size={18} className="faint" /> Tournaments</h2>
          <span className="faint text-xs">{(tournaments || []).length} attached</span>
        </div>
        {(!tournaments || tournaments.length === 0) ? (
          <EmptyState icon={Trophy} title="No tournaments yet"
            body="A tournament holds events, rounds, judges, ballots, and results in one workspace. Create one to start organizing."
            action={<button onClick={() => setShowTournament(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create tournament</button>} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(tournaments || []).map((t) => {
              const role = tournamentRole(t, user?.id);
              const pending = (roundsByT[t.id] || []).reduce((n, r) => {
                const assigned = (r.judges || []).length;
                const done = (ballotsByT[t.id] || []).filter((b) => b.roundId === r.id && (b.status === "submitted" || b.status === "locked")).length;
                return n + Math.max(0, assigned - done);
              }, 0);
              return (
                <Link key={t.id} to={`/compete/tournament/${t.id}`} className="card card-hover p-4 flex flex-col gap-2 group">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg leading-snug">{t.name || "Untitled tournament"}</h3>
                    <StatusPill status={t.status} label={TOURNAMENT_STATUSES.find((s) => s.id === t.status)?.label} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px] faint items-center">
                    {t.location && <span>{t.location}</span>}
                    {t.startDate && <span className="inline-flex items-center gap-1"><CalendarDays size={11} /> {fmtDate(t.startDate)}{t.endDate ? ` – ${fmtDate(t.endDate)}` : ""}</span>}
                  </div>
                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <RoleBadge role={role} />
                    <span className="faint text-xs">{Object.keys(t.participants || {}).length} participants · {Object.keys(t.judges || {}).length} judges</span>
                    {pending > 0 && <span className="pill text-amber-600 dark:text-amber-400 ml-auto">{pending} ballots pending</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Teams */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl flex items-center gap-2"><Users size={18} className="faint" /> Teams</h2>
          <span className="faint text-xs">{(teams || []).length} joined</span>
        </div>
        {(!teams || teams.length === 0) ? (
          <EmptyState icon={Users} title="No teams yet"
            body="Teams bring students and coaches together: shared assignments, rubrics, and activity in one place."
            action={<div className="flex gap-2 justify-center"><button onClick={() => setShowTeam(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create team</button><button onClick={() => setShowJoin(true)} className="btn-ghost py-2 px-4 text-sm">Join by code</button></div>} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(teams || []).map((t) => {
              const role = teamRole(t, user?.id);
              const count = Object.keys(t.members || {}).length;
              return (
                <Link key={t.id} to={`/compete/team/${t.id}`} className="card card-hover p-4 flex flex-col gap-2 group">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-lg leading-snug">{t.name || "Untitled team"}</h3>
                    <ArrowRight size={14} className="faint opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {t.motto && <p className="muted text-xs line-clamp-2">{t.motto}</p>}
                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <RoleBadge role={role} />
                    <span className="faint text-xs">{count} member{count === 1 ? "" : "s"}</span>
                    {role === "coach" && t.code && <span className="pill ml-auto">code {t.code}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {!user && (
        <div className="card p-4 mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm muted">Working solo right now — everything is stored on this device. Sign in to share tournaments and teams with real people.</p>
          <Link to="/auth" className="btn-solid py-2 px-4 text-xs">Sign in <ArrowRight size={13} /></Link>
        </div>
      )}

      {/* Link to coach dashboard for coaches */}
      <div className="mt-8 flex flex-wrap gap-2">
        <Link to="/coach" className="btn-ghost !py-2 !px-4 text-xs"><Shield size={13} /> Coach dashboard</Link>
        <Link to="/compete/judge" className="btn-ghost !py-2 !px-4 text-xs"><ClipboardList size={13} /> Judge workspace</Link>
      </div>

      {showTournament && <TournamentModal onClose={() => setShowTournament(false)} onCreate={createTournament} />}
      {showTeam && <TeamModal onClose={() => setShowTeam(false)} onCreate={createTeam} />}
      {showJoin && <JoinModal onClose={() => setShowJoin(false)} onJoin={joinTeam} hasUser={!!user} />}
    </div>
  );
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function TournamentModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!name.trim()) { setErr("Give the tournament a name."); return; }
    setBusy(true);
    try { await onCreate({ name: name.trim(), location, startDate, endDate }); }
    catch (e) { setErr(e?.message || "Could not create the tournament."); setBusy(false); }
  }

  return (
    <Modal title="New tournament" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. Autumn Invitational" /></Field>
        <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className="field" placeholder="e.g. Lincoln High School" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" /></Field>
          <Field label="End date"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" /></Field>
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Creating…" : "Create tournament"}</button>
        </div>
      </div>
    </Modal>
  );
}

function TeamModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!name.trim()) { setErr("Give the team a name."); return; }
    setBusy(true);
    try { await onCreate({ name: name.trim(), motto }); }
    catch (e) { setErr(e?.message || "Could not create the team."); setBusy(false); }
  }

  return (
    <Modal title="New team" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Team name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. North High Debate" /></Field>
        <Field label="Motto / blurb"><input value={motto} onChange={(e) => setMotto(e.target.value)} className="field" placeholder="Optional one-liner" /></Field>
        <p className="faint text-xs">You'll get a 6-character join code to share with students and coaches.</p>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Creating…" : "Create team"}</button>
        </div>
      </div>
    </Modal>
  );
}

function JoinModal({ onClose, onJoin, hasUser }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    if (!code.trim()) { setErr("Enter the join code your coach gave you."); return; }
    setBusy(true);
    try { await onJoin(code.trim()); }
    catch (e) { setErr(e?.message || "Could not join the team."); setBusy(false); }
  }

  return (
    <Modal title="Join a team" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Join code"><input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="field font-mono tracking-widest" placeholder="ABC123" maxLength={8} /></Field>
        {!hasUser && <p className="text-sm amber-600"><Bell size={13} className="inline mr-1" />Sign in first — joining a team requires an account so your coach can see you on the roster.</p>}
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy || !hasUser} className="btn-solid py-2 px-4 text-xs">{busy ? <Loader2 size={13} className="animate-spin" /> : "Join team"}</button>
        </div>
      </div>
    </Modal>
  );
}
