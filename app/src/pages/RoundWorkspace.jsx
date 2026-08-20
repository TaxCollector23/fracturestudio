import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, CheckCircle2, Clock, Users, Scale, FileText } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import {
  getItem, listItems, createItem, updateItem, roundBallots, computeRoundStatus,
  roundReadyToComplete, newTimelineEntry, newLogEntry, fmtDate, participantNames,
  ROUND_STATUSES, ballotsByJudge
} from "../lib/competition.js";
import { tournamentRole, canManageRound, canJudgeRound, canCreateBallot, canWriteBallot } from "../lib/access.js";
import { effectiveFormat } from "../lib/events.js";
import { useTimer } from "../lib/timer.js";
import { StatusPill, EmptyState, LoadingBlock, ErrorNote, TimerBlock } from "../components/CompKit.jsx";
import BallotForm from "../components/BallotForm.jsx";
import { Modal } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

export default function RoundWorkspace() {
  const { tid, rid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [round, setRound] = useState(null);
  const [event, setEvent] = useState(null);
  const [ballots, setBallots] = useState(null);
  const [err, setErr] = useState(null);
  const [activeBallot, setActiveBallot] = useState(null);
  const [ballotModal, setBallotModal] = useState(false);
  const [savingBallot, setSavingBallot] = useState(false);
  const [flow, setFlow] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [t, r, bls] = await Promise.all([
          getItem("tournaments", tid),
          getItem("rounds", rid, tid),
          listItems("ballots", tid).catch(() => [])
        ]);
        if (!mounted) return;
        setTournament(t); setRound(r); setBallots(bls || []); setFlow(r?.notes || "");
        const ev = r?.eventId ? await getItem("events", r.eventId, tid).catch(() => null) : null;
        if (mounted) setEvent(ev);
      } catch (e) {
        if (mounted) { setErr(e?.message || "Could not load this round."); setTournament(null); setRound(null); }
      }
    })();
    return () => { mounted = false; };
  }, [tid, rid]);

  const role = tournamentRole(tournament, user?.id);
  const isAdmin = canManageRound(tournament, user?.id);
  const judgeAllowed = canJudgeRound(tournament, round, user?.id);
  const format = effectiveFormat(event || {});
  const people = participantNames(tournament, round);

  // Flow-note autosave (debounced).
  useEffect(() => {
    if (!round || !notesDirty) return;
    const t = setTimeout(() => {
      updateItem("rounds", round.id, { notes: flow }, tid).catch(() => {});
      setNotesDirty(false);
    }, 700);
    return () => clearTimeout(t);
  }, [flow, notesDirty, round, tid]);

  async function patchRound(patch, { timeline: tl = null, log: lg = null } = {}) {
    await updateItem("rounds", rid, patch, tid);
    setRound((r) => ({ ...r, ...patch }));
    if (tl) await createItem("timeline", newTimelineEntry(tl.kind, tl.title, tl.detail, user?.id), tid).catch(() => {});
    if (lg) await createItem("log", newLogEntry(lg.action, rid, lg.detail, user?.id, user?.name || ""), tid).catch(() => {});
  }

  async function saveBallot(next, status) {
    setSavingBallot(true);
    try {
      const submittedAt = status === "submitted" ? new Date().toISOString() : next.submittedAt || null;
      const payload = { ...next, status, submittedAt };
      if (activeBallot) {
        await updateItem("ballots", activeBallot.id, payload, tid);
        setBallots((prev) => (prev || []).map((b) => (b.id === activeBallot.id ? { ...b, ...payload } : b)));
      } else {
        const id = await createItem("ballots", payload, tid);
        setBallots((prev) => [{ ...payload, id }, ...(prev || [])]);
      }
      if (status === "submitted") {
        await createItem("timeline", newTimelineEntry("ballot-submitted", `Ballot submitted for round ${round?.number}`, `${next.judgeName || next.judgeId}`, user?.id), tid).catch(() => {});
        await createItem("log", newLogEntry("ballot.submit", rid, `Round ${round?.number} ballot by ${next.judgeName || next.judgeId}`, user?.id, user?.name || next.judgeName || ""), tid).catch(() => {});
      }
      setBallotModal(false);
      setActiveBallot(null);
    } finally {
      setSavingBallot(false);
    }
  }

  const byJudge = useMemo(() => ballotsByJudge(ballots || [], rid), [ballots, rid]);
  const statusInfo = useMemo(() => computeRoundStatus(round, ballots || []), [round, ballots]);
  const roundBallotList = useMemo(() => roundBallots(ballots || [], rid), [ballots, rid]);

  if (tournament === null && !err) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading round…" /></div>;
  if (err || !tournament || !round) {
    return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><ErrorNote msg={err || "This round could not be loaded."} /><Link to={`/compete/tournament/${tid}`} className="btn-ghost mt-4 py-2 px-4 text-xs"><ArrowLeft size={13} /> Back to tournament</Link></div>;
  }

  const defaultJudge = (round.judges || []).includes(user?.id) ? user.id : ((round.judges || [])[0] || "");

  const nextAction = (() => {
    if (isAdmin) {
      if (round.status === "not-started") return { text: "Start the round when the room is ready.", cta: "Start round", fn: () => patchRound({ status: "active" }, { timeline: { kind: "round-started", title: `Round ${round.number} started`, detail: round.name || "" }, log: { action: "round.start", target: rid, detail: `Round ${round.number} started` } }) };
      if (round.status === "active") return { text: "Speeches running — advance once the judges are in.", cta: statusInfo.needed.length === 0 ? "Mark awaiting ballots" : null, fn: () => patchRound({ status: "awaiting-ballot" }, { log: { action: "round.awaiting", target: rid, detail: `Round ${round.number} awaiting ballots` } }) };
      if (round.status === "awaiting-ballot") {
        if (roundReadyToComplete(round, ballots || [])) return { text: "All ballots are in — close the round and publish results.", cta: "Complete round", fn: () => patchRound({ status: "completed" }, { timeline: { kind: "round-completed", title: `Round ${round.number} completed`, detail: round.name || "" }, log: { action: "round.complete", target: rid, detail: `Round ${round.number} completed` } }) };
        return { text: `${statusInfo.needed.length} ballot${statusInfo.needed.length === 1 ? "" : "s"} still outstanding — judges submit below.` };
      }
      return { text: "Round complete — see results on the tournament page." };
    }
    if (judgeAllowed && round.status !== "completed") return { text: "You're judging this round — take notes below, then submit your ballot." };
    if (round.status === "not-started") return { text: "This round hasn't started yet — check back when it's live." };
    if (round.status === "awaiting-ballot") return { text: "Speeches are done — results come once judges submit." };
    return { text: "Round complete — see results on the tournament page." };
  })();

  const formJudgeId = user?.id || defaultJudge;
  const formJudgeName = user?.id ? user.name || user.email : tournament?.judges?.[defaultJudge]?.name || "";
  const judgeOptions = !user ? (round.judges || []).map((jid) => ({ uid: jid, name: tournament?.judges?.[jid]?.name || jid })) : [];

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <Link to={`/compete/tournament/${tid}`} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 mb-3"><ArrowLeft size={13} /> Tournament</Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-serif text-4xl md:text-5xl">{round.name || `Round ${round.number}`}</h1>
            <StatusPill status={round.status} label={ROUND_STATUSES.find((s) => s.id === round.status)?.label} />
          </div>
          <p className="faint text-xs">{event?.name || "General event"} · {people.length} participants · {(round.judges || []).length} judges{round.startsAt ? ` · ${fmtDate(round.startsAt, true)}` : ""}</p>
        </div>
        {isAdmin && round.status !== "completed" && (
          <button onClick={() => navigate(`/compete/tournament/${tid}?tab=rounds`)} className="btn-ghost !py-2 !px-4 text-xs">Rounds list</button>
        )}
      </div>

      {/* What's next banner */}
      <div className={cx("card p-4 mb-6 flex flex-wrap items-center gap-3",
        round.status === "active" ? "border-l-2 border-l-amber-500" : round.status === "awaiting-ballot" ? "border-l-2 border-l-sky-500" : round.status === "completed" ? "border-l-2 border-l-green-500" : "")}>
        <Clock size={16} className="faint shrink-0" />
        <p className="text-sm flex-1 min-w-[200px]">{nextAction.text}</p>
        {nextAction.cta && nextAction.fn && (
          <button onClick={nextAction.fn} className="btn-solid !py-2 !px-4 text-xs"><Play size={12} /> {nextAction.cta}</button>
        )}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
        {/* Control center */}
        <div className="space-y-6">
          {/* Speech order + timers */}
          <div className="card p-5">
            <div className="label-mono mb-3">Control center · {format.format.name}</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(format.slots || []).map((s, i) => (
                <TimerSlot key={i} slot={s} people={people} />
              ))}
            </div>
          </div>

          {/* Flow notes */}
          <div className="card p-5">
            <div className="label-mono mb-2">Flow / notes</div>
            <textarea value={flow} onChange={(e) => { setFlow(e.target.value); setNotesDirty(true); }}
              placeholder="Arguments, extensions, dropped points, judge reactions…"
              className="field min-h-[160px] text-sm" />
            <p className="faint text-xs mt-1.5">{notesDirty ? "Saving…" : "Autosaved to this round."}</p>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* Judges + ballots */}
          <div className="card p-5">
            <div className="label-mono mb-3 flex items-center gap-2"><Scale size={13} /> Judges & ballots</div>
            {(round.judges || []).length === 0 ? (
              <p className="faint text-xs">No judges assigned — the organizer assigns them in the round setup.</p>
            ) : (
              <ul className="space-y-2">
                {(round.judges || []).map((jid) => {
                  const b = byJudge[jid];
                  const name = tournament?.judges?.[jid]?.name || jid;
                  const canOpen = (b && b.judgeId === user?.id) || (canWriteBallot(tournament, b || { judgeId: jid, status: "draft" }, user?.id) && b?.status !== "submitted" && b?.status !== "locked") || (!b && canCreateBallot(tournament, round, user?.id));
                  const done = b?.status === "submitted" || b?.status === "locked";
                  return (
                    <li key={jid} className="flex items-center gap-2 rounded-sm border hair px-3 py-2">
                      <span className={cx("w-2 h-2 rounded-full shrink-0", done ? "bg-green-500" : b?.status === "draft" ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700")} />
                      <span className="text-sm flex-1 truncate">{name}</span>
                      <span className="faint text-xs">{done ? "Submitted" : b?.status === "draft" ? "Draft" : "No ballot"}</span>
                      {(canOpen || isAdmin) && (
                        <button onClick={() => { setActiveBallot(b || null); setBallotModal(true); }}
                          className="btn-ghost !py-1 !px-2.5 text-[11px]">
                          {b ? (done ? "View" : "Edit") : "Ballot"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Participants */}
          <div className="card p-5">
            <div className="label-mono mb-3 flex items-center gap-2"><Users size={13} /> Participants</div>
            {people.length === 0 ? (
              <p className="faint text-xs">No participants in this round.</p>
            ) : (
              <ul className="space-y-2">
                {people.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-mono shrink-0">{(p.name || p.id).slice(0, 2).toUpperCase()}</span>
                    <span className="truncate">{p.name}</span>
                    {p.side && <span className="pill ml-auto capitalize">{p.side}</span>}
                    {p.teamName && <span className="faint text-xs ml-auto">{p.teamName}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Submitted ballots */}
          {roundBallotList.filter((b) => b.status === "submitted" || b.status === "locked").length > 0 && (
            <div className="card p-5">
              <div className="label-mono mb-3 flex items-center gap-2"><FileText size={13} /> Submitted ballots</div>
              <ul className="space-y-2">
                {roundBallotList.filter((b) => b.status === "submitted" || b.status === "locked").map((b) => (
                  <li key={b.id} className="text-sm flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                    <span className="truncate">{b.judgeName || b.judgeId}</span>
                    <span className="ml-auto font-mono faint text-xs">{totalOf(b)} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {ballotModal && (
        <Modal title={roundBallotList.some((b) => b.id === activeBallot?.id) ? "Ballot" : "New ballot"} onClose={() => { setBallotModal(false); setActiveBallot(null); }} wide>
          <BallotForm
            tournament={tournament} round={round} event={event}
            ballot={activeBallot}
            judgeId={formJudgeId}
            judgeName={formJudgeName}
            judgeOptions={judgeOptions}
            saving={savingBallot}
            onSave={saveBallot}
            onCancel={() => { setBallotModal(false); setActiveBallot(null); }}
            locked={activeBallot?.status === "locked"}
          />
        </Modal>
      )}
    </div>
  );
}

function TimerSlot({ slot, people }) {
  const timer = useTimer({
    duration: Number(slot.seconds) || 0,
    warningAt: Math.round((Number(slot.seconds) || 0) * 0.1),
    autostart: false
  });
  const name = slot.speaker != null ? people[slot.speaker]?.name : null;
  return (
    <TimerBlock
      timer={timer}
      label={name ? `${slot.label} — ${name}` : slot.label}
      sublabel={slot.kind === "speech" ? `${Math.round((Number(slot.seconds) || 0) / 60)}m speech` : slot.kind}
    />
  );
}

function totalOf(b) {
  const cats = b?.rubricSnapshot?.categories || [];
  return cats.reduce((sum, c) => sum + (Number.isFinite(Number(b?.scores?.[c.id])) ? Number(b.scores[c.id]) : 0), 0);
}
