import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trophy, Users, Scale, CalendarDays, MapPin,
  Flag, ScrollText, BarChart3, ArrowRight, X, Timer
} from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import {
  getItem, listItems, createItem, updateItem, removeItem, listMy,
  newEvent, newRound, newTimelineEntry, newLogEntry,
  TOURNAMENT_STATUSES, ROUND_STATUSES, computeRoundStatus, roundBallots,
  computeTournamentResults, computeCalibration, nextRoundNumber, fmtDate, sortByCreated
} from "../lib/competition.js";
import { tournamentRole, canManageTournament } from "../lib/access.js";
import { EVENT_FORMATS, effectiveFormat } from "../lib/events.js";
import { rubricById, ballotTotal } from "../lib/rubrics.js";
import { writeMembership } from "../lib/firebase.js";
import { StatusPill, RoleBadge, EmptyState, LoadingBlock, ErrorNote, PersonList } from "../components/CompKit.jsx";
import { Modal, Field, Tabs } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

const RUBRIC_OPTIONS = [
  ["public-forum", "Public Forum"], ["ld", "Lincoln-Douglas"], ["policy", "Policy Debate"],
  ["congress", "Congress"], ["oratory", "Oratory"], ["extemp", "Extemp"], ["impromptu", "Impromptu"], ["custom", "Custom"]
];

export default function Tournament() {
  const { tid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [tournament, setTournament] = useState(null);
  const [events, setEvents] = useState(null);
  const [rounds, setRounds] = useState(null);
  const [ballots, setBallots] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [log, setLog] = useState(null);
  const [tab, setTab] = useState(params.get("tab") || "overview");
  const [err, setErr] = useState(null);

  // Allow ?tab=rounds links (e.g. organizer quick actions) to switch tabs
  // even when already on this page.
  useEffect(() => {
    const t = params.get("tab");
    if (t && t !== tab) setTab(t);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getItem("tournaments", tid);
        if (!mounted) return;
        if (!t) { setTournament(null); return; }
        const [evs, rds, bls, tl] = await Promise.all([
          listItems("events", tid), listItems("rounds", tid), listItems("ballots", tid), listItems("timeline", tid)
        ]);
        const role = tournamentRole(t, user?.id);
        let lg = [];
        if (role === "admin") lg = await listItems("log", tid).catch(() => []);
        if (mounted) {
          setTournament(t); setEvents(evs || []); setRounds(rds || []); setBallots(bls || []);
          setTimeline(tl || []); setLog(lg || []);
        }
      } catch (e) {
        if (mounted) { setErr(e?.message || "Could not load this tournament."); setTournament(null); }
      }
    })();
    return () => { mounted = false; };
  }, [tid, user?.id]);

  const role = tournamentRole(tournament, user?.id);
  const isAdmin = canManageTournament(tournament, user?.id);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "rounds", label: "Rounds", count: rounds?.length },
    { id: "events", label: "Events", count: events?.length },
    { id: "people", label: "People" },
    { id: "results", label: "Results" },
    ...(isAdmin ? [{ id: "calibration", label: "Calibration" }] : []),
    ...(isAdmin ? [{ id: "log", label: "Log", count: log?.length }] : [])
  ];

  const patchTournament = async (patch, { timeline: tl = null, log: lg = null } = {}) => {
    await updateItem("tournaments", tid, patch);
    const next = { ...tournament, ...patch };
    setTournament(next);
    if (tl) await createItem("timeline", newTimelineEntry(tl.kind, tl.title, tl.detail, user?.id), tid).catch(() => {});
    if (lg) await createItem("log", newLogEntry(lg.action, lg.target, lg.detail, user?.id, user?.name || ""), tid).catch(() => {});
    return next;
  };

  if (tournament === null && !err) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading tournament…" /></div>;
  if (err && tournament === null) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><ErrorNote msg={err} /><Link to="/compete" className="btn-ghost mt-4 py-2 px-4 text-xs"><ArrowLeft size={13} /> Back to competitions</Link></div>;
  if (!tournament) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><EmptyState icon={Trophy} title="Tournament not found" body="You don't have access to this tournament, or it no longer exists." action={<Link to="/compete" className="btn-solid py-2 px-4 text-sm">Back to competitions</Link>} /></div>;
  if (!role) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><EmptyState icon={Scale} title="No access" body="This tournament is private — ask an organizer to add you as a participant, judge, or admin." action={<Link to="/compete" className="btn-solid py-2 px-4 text-sm">Back to competitions</Link>} /></div>;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <Link to="/compete" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 mb-3"><ArrowLeft size={13} /> Competitions</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-serif text-4xl md:text-5xl">{tournament.name || "Untitled tournament"}</h1>
            <StatusPill status={tournament.status} label={TOURNAMENT_STATUSES.find((s) => s.id === tournament.status)?.label} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs faint">
            {tournament.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {tournament.location}</span>}
            {tournament.startDate && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {fmtDate(tournament.startDate)}{tournament.endDate && tournament.endDate !== tournament.startDate ? ` – ${fmtDate(tournament.endDate)}` : ""}</span>}
            <span className="inline-flex items-center gap-1"><Users size={12} /> {Object.keys(tournament.participants || {}).length} participants</span>
            <span className="inline-flex items-center gap-1"><Scale size={12} /> {Object.keys(tournament.judges || {}).length} judges</span>
            <RoleBadge role={role} />
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <StatusChanger tournament={tournament} onPatch={patchTournament} />
          </div>
        )}
      </div>

      {err && <ErrorNote msg={err} />}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab tournament={tournament} events={events} rounds={rounds} ballots={ballots} timeline={timeline} isAdmin={isAdmin} onNavigate={navigate} />}
      {tab === "rounds" && <RoundsTab tournament={tournament} events={events} rounds={rounds} ballots={ballots} isAdmin={isAdmin} onPatchTournament={patchTournament} setRounds={setRounds} />}
      {tab === "events" && <EventsTab tournament={tournament} events={events} isAdmin={isAdmin} setEvents={setEvents} />}
      {tab === "people" && <PeopleTab tournament={tournament} teams={[]} isAdmin={isAdmin} onPatchTournament={patchTournament} />}
      {tab === "results" && <ResultsTab tournament={tournament} events={events} rounds={rounds} ballots={ballots} />}
      {tab === "calibration" && isAdmin && <CalibrationTab rounds={rounds} ballots={ballots} tournament={tournament} />}
      {tab === "log" && isAdmin && <LogTab log={log} />}
    </div>
  );
}

/* ─── Status changer ───────────────────────────────────────────────────────── */

function StatusChanger({ tournament, onPatch }) {
  const next = TOURNAMENT_STATUSES.find((s) => s.id !== tournament.status);
  if (!next) return null;
  const auto = next.id === "active" && tournament.status === "upcoming";
  return (
    <button onClick={() => onPatch({ status: next.id }, {
      timeline: { kind: "status", title: `Tournament marked ${next.label.toLowerCase()}`, detail: tournament.name },
      log: { action: "tournament.status", target: tournament.id, detail: `${tournament.status} → ${next.id}` }
    })}
      className="btn-ghost !py-2 !px-4 text-xs">
      <Flag size={13} /> {auto ? "Start tournament" : `Mark ${next.label}`}
    </button>
  );
}

/* ─── Overview ─────────────────────────────────────────────────────────────── */

function OverviewTab({ tournament, events, rounds, ballots, timeline, isAdmin, onNavigate }) {
  const sorted = sortByCreated(rounds || []);
  const active = sorted.find((r) => r.status === "active") || null;
  const upcoming = sorted.filter((r) => r.status === "not-started");
  const awaiting = sorted.filter((r) => r.status === "awaiting-ballot");
  const pendingBallots = (rounds || []).reduce((n, r) => n + computeRoundStatus(r, ballots).needed.length, 0);
  const results = useMemo(() => computeTournamentResults(tournament, rounds, ballots).slice(0, 5), [tournament, rounds, ballots]);
  const timelineSorted = sortByCreated(timeline || []).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Rounds" value={rounds?.length || 0} sub={`${events?.length || 0} events`} />
        <StatCard label="Pending ballots" value={pendingBallots} sub={pendingBallots ? "Judges to hear from" : "All caught up"} warn={pendingBallots > 0} />
        <StatCard label="Participants" value={Object.keys(tournament.participants || {}).length} sub={`${Object.keys(tournament.judges || {}).length} judges`} />
        <StatCard label="Completed" value={rounds?.filter((r) => r.status === "completed").length || 0} sub={`of ${rounds?.length || 0} rounds`} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
        <div className="space-y-6">
          {/* Current round + next steps */}
          {active ? (
            <RoundFocusCard round={active} tournament={tournament} ballots={ballots} events={events} onOpen={() => onNavigate(`/compete/tournament/${tournament.id}/round/${active.id}`)} />
          ) : awaiting.length > 0 ? (
            <div className="card p-5">
              <div className="label-mono mb-2">Awaiting ballots</div>
              <ul className="space-y-2">
                {awaiting.map((r) => (
                  <li key={r.id}>
                    <button onClick={() => onNavigate(`/compete/tournament/${tournament.id}/round/${r.id}`)}
                      className="w-full flex items-center gap-3 rounded-sm border hair px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                      <Timer size={15} className="faint shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Round {r.number}{r.name ? ` · ${r.name}` : ""}</p>
                        <p className="faint text-xs">{computeRoundStatus(r, ballots).needed.length} ballot{computeRoundStatus(r, ballots).needed.length === 1 ? "" : "s"} outstanding</p>
                      </div>
                      <ArrowRight size={14} className="faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="card p-5">
              <div className="label-mono mb-2">Next round</div>
              {upcoming.length > 0 ? (
                <button onClick={() => onNavigate(`/compete/tournament/${tournament.id}/round/${upcoming[0].id}`)}
                  className="w-full flex items-center gap-3 rounded-sm border hair px-3 py-2.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <Flag size={15} className="faint shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Round {upcoming[0].number}{upcoming[0].name ? ` · ${upcoming[0].name}` : ""} is up next</p>
                    <p className="faint text-xs">{eventName(events, upcoming[0].eventId)} · {upcoming[0].judges?.length || 0} judges</p>
                  </div>
                  <ArrowRight size={14} className="faint" />
                </button>
              ) : (
                <p className="muted text-sm py-2">{isAdmin ? "No rounds yet — create one to get going." : "The organizers haven't scheduled rounds yet."}</p>
              )}
            </div>
          )}

          {/* Important actions */}
          {isAdmin && (
            <div className="card p-5">
              <div className="label-mono mb-3">Organizer actions</div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/compete/tournament/${tournament.id}?tab=rounds`} className="btn-ghost !py-2 !px-3 text-xs">+ Round</Link>
                <Link to={`/compete/tournament/${tournament.id}?tab=events`} className="btn-ghost !py-2 !px-3 text-xs">+ Event</Link>
                <Link to={`/compete/tournament/${tournament.id}?tab=people`} className="btn-ghost !py-2 !px-3 text-xs">+ People</Link>
              </div>
            </div>
          )}

          {/* Recent results */}
          {results.length > 0 && (
            <div className="card p-5">
              <div className="label-mono mb-3">Standings preview</div>
              <table className="w-full text-sm">
                <thead><tr className="text-left faint text-xs"><th className="pb-2">#</th><th className="pb-2">Competitor</th><th className="pb-2 text-right">W</th><th className="pb-2 text-right">L</th><th className="pb-2 text-right">Pts</th></tr></thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={row.id} className="border-t hair">
                      <td className="py-2 font-mono faint">{i + 1}</td>
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2 text-right">{row.wins}</td>
                      <td className="py-2 text-right faint">{row.losses}</td>
                      <td className="py-2 text-right font-mono">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="card p-5">
          <div className="label-mono mb-3">Competition timeline</div>
          {timelineSorted.length === 0 ? (
            <p className="faint text-xs">Round starts, ballots, and results appear here in order.</p>
          ) : (
            <ol className="relative border-l hair ml-2 space-y-4">
              {timelineSorted.map((e) => (
                <li key={e.id} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-zinc-950 dark:bg-zinc-100" />
                  <p className="text-sm font-medium leading-snug">{e.title}</p>
                  <p className="faint text-xs mt-0.5">{e.detail}{e.at ? ` · ${fmtDate(e.at, true)}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, warn }) {
  return (
    <div className={cx("card p-4", warn && "border-amber-500/40")}>
      <div className="label-mono mb-1">{label}</div>
      <div className="text-2xl font-serif leading-none">{value}</div>
      {sub && <div className="text-xs faint mt-1.5">{sub}</div>}
    </div>
  );
}

function RoundFocusCard({ round, tournament, ballots, events, onOpen }) {
  const status = computeRoundStatus(round, ballots);
  const event = (events || []).find((e) => e.id === round.eventId);
  return (
    <div className="card p-5 border-l-2 border-l-amber-500">
      <div className="label-mono mb-1">Live now</div>
      <div className="flex items-center gap-2">
        <h3 className="font-serif text-2xl">Round {round.number}{round.name ? ` · ${round.name}` : ""}</h3>
        <StatusPill status={round.status} />
      </div>
      <p className="faint text-xs mb-3">{event?.name || "Event"} · {round.judges?.length || 0} judges · {Object.keys(round.participants || {}).length} participants</p>
      {status.needed.length > 0 && <p className="text-amber-600 dark:text-amber-400 text-xs mb-3">{status.needed.length} ballot{status.needed.length === 1 ? "" : "s"} still outstanding</p>}
      <button onClick={onOpen} className="btn-solid !py-2 !px-4 text-xs">Open round workspace <ArrowRight size={13} /></button>
    </div>
  );
}

function eventName(events, id) {
  return (events || []).find((e) => e.id === id)?.name || "General";
}

/* ─── Rounds ───────────────────────────────────────────────────────────────── */

function RoundsTab({ tournament, events, rounds, ballots, isAdmin, setRounds }) {
  const [showNew, setShowNew] = useState(false);
  const sorted = [...(rounds || [])].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));

  async function createRound(data) {
    const r = newRound({
      ...data,
      number: nextRoundNumber(rounds),
      participants: data.participants || {},
      sides: data.sides || null
    });
    const id = await createItem("rounds", r, tournament.id);
    await createItem("timeline", newTimelineEntry("round-created", `Round ${r.number} created`, r.name || "", tournament.createdBy || ""), tournament.id).catch(() => {});
    await createItem("log", newLogEntry("round.create", id, `Round ${r.number} ${r.name || ""}`.trim(), tournament.createdBy || ""), tournament.id).catch(() => {});
    setRounds((prev) => [{ ...r, id }, ...(prev || [])]);
  }

  return (
    <div className="space-y-4">
      {isAdmin && <div className="flex justify-end"><button onClick={() => setShowNew(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> New round</button></div>}
      {(!rounds || rounds.length === 0) ? (
        <EmptyState icon={Flag} title="No rounds yet"
          body="Rounds are where the competition actually happens — participants, judges, timers, and ballots all live here."
          action={isAdmin ? <button onClick={() => setShowNew(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create round</button> : null} />
      ) : (
        <div className="space-y-2">
          {sorted.map((r) => {
            const status = computeRoundStatus(r, ballots);
            const event = (events || []).find((e) => e.id === r.eventId);
            return (
              <Link key={r.id} to={`/compete/tournament/${tournament.id}/round/${r.id}`}
                className="card card-hover p-4 flex flex-wrap items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-serif text-lg shrink-0">{r.number}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg leading-snug">{r.name || `Round ${r.number}`}</p>
                  <p className="faint text-xs">{event?.name || "General"} · {Object.keys(r.participants || {}).length} participants · {r.judges?.length || 0} judges</p>
                </div>
                <StatusPill status={r.status} label={ROUND_STATUSES.find((s) => s.id === r.status)?.label} />
                {status.needed.length > 0 && <span className="pill text-amber-600 dark:text-amber-400">{status.needed.length} ballot{status.needed.length === 1 ? "" : "s"}</span>}
                <ArrowRight size={15} className="faint" />
              </Link>
            );
          })}
        </div>
      )}
      {showNew && <RoundModal tournament={tournament} events={events} onClose={() => setShowNew(false)} onCreate={createRound} />}
    </div>
  );
}

function RoundModal({ tournament, events, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState(events?.[0]?.id || "");
  const [startsAt, setStartsAt] = useState("");
  const [judgeIds, setJudgeIds] = useState([]);
  const [participantIds, setParticipantIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const event = events?.find((e) => e.id === eventId);
  const fmt = effectiveFormat(event || {});
  const participantOptions = Object.entries(tournament.participants || {}).map(([uid, info]) => ({
    uid, name: info?.name || uid, teamId: info?.teamId, teamName: info?.teamName
  }));
  const judgeOptions = Object.entries(tournament.judges || {}).map(([uid, info]) => ({ uid, name: info?.name || uid }));

  const sides = fmt.sides?.length ? fmt.sides : (event?.participantType === "team" ? [{ id: "pro", label: "Pro" }, { id: "con", label: "Con" }] : []);

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function submit() {
    if (!participantIds.length) { setErr("Add at least one participant."); return; }
    if (!judgeIds.length) { setErr("Assign at least one judge."); return; }
    setBusy(true);
    try {
      const participants = {};
      for (const pid of participantIds) {
        const p = participantOptions.find((x) => x.uid === pid);
        participants[pid] = { name: p?.name || pid, teamId: p?.teamId || "", teamName: p?.teamName || "", side: sides.length === 2 ? sides[participantIds.indexOf(pid) % 2].id : null };
      }
      await onCreate({ name: name.trim(), eventId, startsAt, judges: judgeIds, participants });
    } catch (e) { setErr(e?.message || "Could not create the round."); setBusy(false); }
  }

  return (
    <Modal title="New round" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Round name"><input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. Prelim 1, Quarterfinal…" /></Field>
          <Field label="Event"><select value={eventId} onChange={(e) => setEventId(e.target.value)} className="field">
            <option value="">General / no event</option>
            {(events || []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></Field>
        </div>
        <Field label="Scheduled start"><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="field" /></Field>

        {sides.length > 0 && (
          <div>
            <div className="label-mono mb-1.5">Sides ({sides.map((s) => s.label).join(" / ")})</div>
            <p className="faint text-xs mb-2">Participants alternate sides in the order you pick them below.</p>
          </div>
        )}

        <div>
          <div className="label-mono mb-1.5">Participants</div>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
            {participantOptions.map((p) => (
              <label key={p.uid} className={cx("flex items-center gap-2 rounded-sm border px-3 py-2 text-sm cursor-pointer transition-colors", participantIds.includes(p.uid) ? "border-zinc-950 dark:border-zinc-100 bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950" : "hair")}>
                <input type="checkbox" checked={participantIds.includes(p.uid)} onChange={() => toggle(participantIds, setParticipantIds, p.uid)} className="sr-only" />
                <span className="truncate">{p.name}</span>
                {p.teamName && <span className="text-[10px] opacity-60 ml-auto">{p.teamName}</span>}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="label-mono mb-1.5">Judges</div>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
            {judgeOptions.map((j) => (
              <label key={j.uid} className={cx("flex items-center gap-2 rounded-sm border px-3 py-2 text-sm cursor-pointer transition-colors", judgeIds.includes(j.uid) ? "border-zinc-950 dark:border-zinc-100 bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950" : "hair")}>
                <input type="checkbox" checked={judgeIds.includes(j.uid)} onChange={() => toggle(judgeIds, setJudgeIds, j.uid)} className="sr-only" />
                <span className="truncate">{j.name}</span>
              </label>
            ))}
          </div>
        </div>

        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Creating…" : "Create round"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Events ───────────────────────────────────────────────────────────────── */

function EventsTab({ tournament, events, isAdmin, setEvents }) {
  const [showNew, setShowNew] = useState(false);

  async function createEvent(data) {
    const e = newEvent(data);
    const id = await createItem("events", e, tournament.id);
    setEvents((prev) => [{ ...e, id }, ...(prev || [])]);
  }
  async function removeEvent(id) {
    await removeItem("events", id, tournament.id);
    setEvents((prev) => (prev || []).filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-4">
      {isAdmin && <div className="flex justify-end"><button onClick={() => setShowNew(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> New event</button></div>}
      {(!events || events.length === 0) ? (
        <EmptyState icon={Trophy} title="No events yet"
          body="An event defines the format, timing structure, sides, and rubric — Public Forum, LD, Oratory, Extemp, Impromptu, Congress, or a fully custom event."
          action={isAdmin ? <button onClick={() => setShowNew(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create event</button> : null} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(events || []).map((e) => {
            const fmt = effectiveFormat(e);
            const total = (fmt.slots || []).reduce((s, x) => s + (Number(x.seconds) || 0), 0);
            const rubric = rubricById(fmt.rubricId);
            return (
              <div key={e.id} className="card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg">{e.name}</h3>
                  {isAdmin && <button onClick={() => removeEvent(e.id)} className="faint hover:text-red-500" title="Delete event"><X size={14} /></button>}
                </div>
                <p className="faint text-xs capitalize">{fmt.format.name} · {e.participantType || fmt.format.participantType === "team" ? "team" : "individual"}</p>
                <p className="faint text-xs">{fmt.slots?.length || 0} timed segments · {Math.round(total / 60)} min total · {rubric.name}</p>
                {fmt.sides?.length > 0 && <p className="faint text-xs">Sides: {fmt.sides.map((s) => s.label).join(" / ")}</p>}
              </div>
            );
          })}
        </div>
      )}
      {showNew && <EventModal events={events} onClose={() => setShowNew(false)} onCreate={createEvent} />}
    </div>
  );
}

function EventModal({ events, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [formatId, setFormatId] = useState("public-forum");
  const [participantType, setParticipantType] = useState("team");
  const [rubricId, setRubricId] = useState("public-forum");
  const [slots, setSlots] = useState(EVENT_FORMATS["public-forum"].slots.map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function pickFormat(id) {
    setFormatId(id);
    const f = EVENT_FORMATS[id];
    setParticipantType(f.participantType);
    setRubricId(f.rubricId);
    setSlots(f.slots.map((s) => ({ ...s })));
  }

  async function submit() {
    if (!name.trim()) { setErr("Give the event a name."); return; }
    setBusy(true);
    try {
      await onCreate({
        name: name.trim(), formatId, participantType, rubricId,
        timing: { slots: slots.map((s) => ({ ...s, seconds: Number(s.seconds) || 0 })) },
        roundCount: 0
      });
    } catch (e) { setErr(e?.message || "Could not create the event."); setBusy(false); }
  }

  return (
    <Modal title="New event" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Event name"><input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. Varsity Public Forum" /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Format">
            <select value={formatId} onChange={(e) => pickFormat(e.target.value)} className="field">
              {Object.entries(EVENT_FORMATS).map(([id, f]) => <option key={id} value={id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Participant type">
            <select value={participantType} onChange={(e) => setParticipantType(e.target.value)} className="field">
              <option value="individual">Individual competitors</option>
              <option value="team">Teams of two</option>
            </select>
          </Field>
        </div>
        <Field label="Rubric">
          <select value={rubricId} onChange={(e) => setRubricId(e.target.value)} className="field">
            {RUBRIC_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </Field>

        <div>
          <div className="label-mono mb-1.5">Timing structure</div>
          <p className="faint text-xs mb-2">Edit the default timings for this event. New formats can be added in lib/events.js.</p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-20 text-[11px] font-mono uppercase faint shrink-0">{s.kind}</span>
                <span className="flex-1 truncate">{s.label}</span>
                <input type="number" min={0} step={15} value={s.seconds}
                  onChange={(e) => setSlots((prev) => prev.map((x, j) => (j === i ? { ...x, seconds: e.target.value } : x)))}
                  className="field !w-24 !py-1.5 !px-2 text-right" />
                <span className="faint text-xs w-8">sec</span>
              </div>
            ))}
          </div>
        </div>

        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Creating…" : "Create event"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── People ───────────────────────────────────────────────────────────────── */

function PeopleTab({ tournament, isAdmin, onPatchTournament }) {
  const [adding, setAdding] = useState(null); // 'participant' | 'judge' | 'team'
  const [myTeams, setMyTeams] = useState(null);
  const admins = Object.entries(tournament.admins || {}).map(([uid, info]) => ({ id: uid, name: info?.name || uid, role: "admin" }));
  const judges = Object.entries(tournament.judges || {}).map(([uid, info]) => ({ id: uid, name: info?.name || uid, role: "judge" }));
  const participants = Object.entries(tournament.participants || {}).map(([uid, info]) => ({ id: uid, name: info?.name || uid, role: "participant", meta: [info?.teamName, info?.email].filter(Boolean).join(" · ") }));

  useEffect(() => {
    let mounted = true;
    listMy("teams").then((ts) => { if (mounted) setMyTeams(ts || []); }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  async function addPerson(kind, { id, name, email, teamId, teamName }) {
    const key = kind === "judge" ? "judges" : "participants";
    const next = { ...tournament, [key]: { ...tournament[key], [id]: { name, email: email || "", teamId: teamId || "", teamName: teamName || "" } } };
    await onPatchTournament({ [key]: next[key] }, {
      timeline: { kind: `${kind}-added`, title: `${kind === "judge" ? "Judge" : "Participant"} added`, detail: name, actorId: tournament.createdBy },
      log: { action: `${kind}.add`, target: tournament.id, detail: name }
    });
    if (!id.startsWith("p-") && !id.startsWith("j-") && id !== "me") {
      await writeMembership(id, "tournaments", tournament.id, { role: key === "judges" ? "judge" : "participant", name }).catch(() => {});
    }
  }

  async function removePerson(kind, id) {
    const key = kind === "judge" ? "judges" : "participants";
    const next = { ...tournament };
    delete next[key][id];
    await onPatchTournament({ [key]: next[key] }, {
      log: { action: `${kind}.remove`, target: tournament.id, detail: id }
    });
  }

  async function addTeam(team) {
    const next = { ...tournament, teamIds: [...new Set([...(tournament.teamIds || []), team.id])] };
    for (const [uid, m] of Object.entries(team.members || {})) {
      if (next.participants[uid]) continue;
      next.participants[uid] = { name: m?.name || uid, teamId: team.id, teamName: team.name || "", email: m?.email || "" };
      if (!uid.startsWith("m-") && uid !== "me") {
        await writeMembership(uid, "tournaments", tournament.id, { role: "participant", name: m?.name || uid }).catch(() => {});
      }
    }
    await onPatchTournament({ teamIds: next.teamIds, participants: next.participants }, {
      timeline: { kind: "team-added", title: "Team added", detail: team.name || "", actorId: tournament.createdBy },
      log: { action: "team.add", target: tournament.id, detail: team.name || "" }
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <PersonCard title="Admins" people={admins} empty="No organizers yet — you are the first." />
      <PersonCard title="Judges" people={judges} empty="No judges assigned yet."
        action={isAdmin ? <button onClick={() => setAdding("judge")} className="btn-ghost !py-1.5 !px-3 text-xs"><Plus size={12} /> Add judge</button> : null}
        onRemove={isAdmin ? (id) => removePerson("judge", id) : null} />
      <PersonCard title="Participants" people={participants} empty="No participants yet — add students, teams, or your own team's members."
        action={isAdmin ? (
          <div className="flex gap-1.5">
            <button onClick={() => setAdding("team")} className="btn-ghost !py-1.5 !px-3 text-xs"><Plus size={12} /> Add team</button>
            <button onClick={() => setAdding("participant")} className="btn-ghost !py-1.5 !px-3 text-xs"><Plus size={12} /> Add participant</button>
          </div>
        ) : null}
        onRemove={isAdmin ? (id) => removePerson("participant", id) : null} />

      {adding === "team" && (
        <AddTeamModal teams={myTeams || []} onClose={() => setAdding(null)}
          onAdd={(team) => addTeam(team).then(() => setAdding(null))} />
      )}
      {adding && adding !== "team" && (
        <AddPersonModal kind={adding} onClose={() => setAdding(null)}
          onAdd={(data) => addPerson(adding, data).then(() => setAdding(null))} />
      )}
    </div>
  );
}

function PersonCard({ title, people, empty, action, onRemove }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-lg">{title}</h3>
        {action}
      </div>
      <PersonList people={people} empty={empty} />
      {people.length > 0 && onRemove && (
        <div className="mt-3 flex justify-end">
          <button onClick={() => { const id = window.prompt("Enter the person's id/name to remove:"); if (id) onRemove(id); }} className="faint text-xs hover:text-red-500">Remove…</button>
        </div>
      )}
    </div>
  );
}

function AddTeamModal({ teams, onClose, onAdd }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (!teams.length) {
    return (
      <Modal title="Add a team" onClose={onClose}>
        <p className="muted text-sm mb-4">You're not a member of any team yet. Create or join a team on the Competitions page, then add it here — every member lands on the roster.</p>
        <div className="flex justify-end"><button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Close</button></div>
      </Modal>
    );
  }
  async function pick(team) {
    setBusy(true);
    try { await onAdd(team); }
    catch (e) { setErr(e?.message || "Could not add the team."); setBusy(false); }
  }
  return (
    <Modal title="Add a team" onClose={onClose}>
      <div className="space-y-2">
        {teams.map((t) => (
          <button key={t.id} onClick={() => pick(t)} disabled={busy}
            className="w-full flex items-center justify-between rounded-sm border hair px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
            <span className="font-medium">{t.name || "Untitled team"}</span>
            <span className="faint text-xs">{Object.keys(t.members || {}).length} members</span>
          </button>
        ))}
        {err && <p className="text-red-500 text-sm">{err}</p>}
      </div>
    </Modal>
  );
}

function AddPersonModal({ kind, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const id = uid.trim() || (kind === "judge" ? "j-" : "p-") + Date.now().toString(36);

  async function submit() {
    if (!name.trim()) { setErr("Enter a name."); return; }
    setBusy(true);
    try { await onAdd({ id, name: name.trim(), email: email.trim(), teamId: "", teamName: "" }); }
    catch (e) { setErr(e?.message || "Could not add."); setBusy(false); }
  }

  return (
    <Modal title={kind === "judge" ? "Add a judge" : "Add a participant"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder={kind === "judge" ? "e.g. Ms. Rivera" : "e.g. Alex Chen"} /></Field>
        <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="alex@school.edu" /></Field>
        <Field label="Fracture account id (optional)">
          <input value={uid} onChange={(e) => setUid(e.target.value)} className="field font-mono" placeholder="Only if they have an account — they get login access" />
        </Field>
        <p className="faint text-xs">Without an account id, they're on the roster and results, but can't sign in to view the tournament themselves.</p>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Adding…" : `Add ${kind}`}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Results ──────────────────────────────────────────────────────────────── */

function ResultsTab({ tournament, rounds, ballots }) {
  const standings = useMemo(() => computeTournamentResults(tournament, rounds, ballots), [tournament, rounds, ballots]);
  const sortedRounds = [...(rounds || [])].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));

  if (!rounds || rounds.length === 0) {
    return <EmptyState icon={BarChart3} title="No results yet" body="Once rounds run and ballots come in, standings and per-round results appear here." />;
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 overflow-x-auto">
        <div className="label-mono mb-3">Standings</div>
        {standings.length === 0 ? <p className="faint text-xs">No ballots submitted yet.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left faint text-xs"><th className="pb-2">#</th><th className="pb-2">Competitor</th><th className="pb-2 text-right">W</th><th className="pb-2 text-right">L</th><th className="pb-2 text-right">Ballots</th><th className="pb-2 text-right">Points</th></tr></thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.id} className="border-t hair">
                  <td className="py-2 font-mono faint">{i + 1}</td>
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="py-2 text-right">{row.wins}</td>
                  <td className="py-2 text-right faint">{row.losses}</td>
                  <td className="py-2 text-right faint">{row.ballots}</td>
                  <td className="py-2 text-right font-mono">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sortedRounds.map((r) => {
        const bs = roundBallots(ballots, r.id).filter((b) => b.status === "submitted" || b.status === "locked");
        if (!bs.length) return null;
        return (
          <div key={r.id} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">Round {r.number}{r.name ? ` · ${r.name}` : ""}</h3>
              <StatusPill status={r.status} />
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left faint text-xs"><th className="pb-2">Judge</th><th className="pb-2">Decision</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {bs.map((b) => (
                  <tr key={b.id} className="border-t hair">
                    <td className="py-2">{b.judgeName || b.judgeId}</td>
                    <td className="py-2 capitalize">{b.decision || (b.rank ? `#${b.rank}` : "—")}</td>
                    <td className="py-2 text-right font-mono">{ballotTotal(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Calibration ──────────────────────────────────────────────────────────── */

function CalibrationTab({ rounds, ballots, tournament }) {
  const roundWithBallots = (rounds || []).filter((r) => roundBallots(ballots, r.id).filter((b) => b.status === "submitted" || b.status === "locked").length >= 2);

  if (roundWithBallots.length === 0) {
    return (
      <EmptyState icon={Scale} title="Nothing to compare yet"
        body="Once two or more judges submit ballots for the same round, you'll see side-by-side scores and flagged differences to discuss at the judge meeting." />
    );
  }

  return (
    <div className="space-y-6">
      <p className="muted text-sm leading-relaxed">
        Compare judges on the same round — overall totals, category scores, decisions, and feedback depth.
        A wider spread is a discussion prompt, not a verdict: no judge is declared “correct”.
      </p>
      {roundWithBallots.map((r) => {
        const cal = computeCalibration(r, ballots);
        return (
          <div key={r.id} className="card p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif text-lg">Round {r.number}{r.name ? ` · ${r.name}` : ""}</h3>
              <span className="faint text-xs">{cal.rows.length} judges</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left faint text-xs">
                  <th className="pb-2">Judge</th>
                  {cal.categories.map((c) => <th key={c.id} className="pb-2 text-right">{c.label}</th>)}
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Decision</th>
                  <th className="pb-2 text-right">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {cal.rows.map((row) => (
                  <tr key={row.judgeId} className="border-t hair">
                    <td className="py-2 font-medium">{row.judgeName}</td>
                    {cal.categories.map((c) => {
                      const v = row.scores[c.id];
                      const wide = cal.spread[c.id] > 5;
                      return <td key={c.id} className={cx("py-2 text-right font-mono", wide ? "bg-amber-500/10" : "")}>{Number.isFinite(v) ? v : "—"}</td>;
                    })}
                    <td className="py-2 text-right font-mono font-medium">{row.total}</td>
                    <td className="py-2 text-right capitalize">{row.decision || "—"}</td>
                    <td className="py-2 text-right faint">{row.feedbackWords} words</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cal.disagreements.length > 0 && (
              <div className="mt-3 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
                {cal.disagreements.map((d, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400"><strong>{d.title}:</strong> {d.detail}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Log ──────────────────────────────────────────────────────────────────── */

function LogTab({ log }) {
  if (!log || log.length === 0) {
    return <EmptyState icon={ScrollText} title="No audit entries yet" body="Competition-critical changes — who assigned a judge, submitted a ballot, or changed a round — are recorded here." />;
  }
  return (
    <div className="card p-5">
      <ul className="space-y-2">
        {sortByCreated(log).map((e) => (
          <li key={e.id} className="flex items-start gap-3 text-sm border-b hair last:border-0 pb-2">
            <span className="font-mono text-[11px] faint mt-0.5">{e.action}</span>
            <div className="min-w-0 flex-1">
              <p>{e.detail || e.target}</p>
              <p className="faint text-xs">{e.actorName || e.actorId || "system"} · {fmtDate(e.at, true)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
