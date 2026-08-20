import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Scale, ArrowRight, CheckCircle2, CalendarClock } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { listMy, listItems, createItem, updateItem, roundBallots, computeRoundStatus, ballotsByJudge, newTimelineEntry, newLogEntry, ROUND_STATUSES, fmtDate } from "../lib/competition.js";
import { tournamentRole } from "../lib/access.js";
import { StatusPill, EmptyState, LoadingBlock, ErrorNote } from "../components/CompKit.jsx";
import { Modal } from "../components/PrepKit.jsx";
import BallotForm from "../components/BallotForm.jsx";
import { cx } from "../lib/ui.js";

export default function JudgeWorkspace() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [openRound, setOpenRound] = useState(null);
  const [activeBallot, setActiveBallot] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ts = await listMy("tournaments");
        const rows = await Promise.all((ts || []).map(async (t) => {
          const [rounds, ballots, events] = await Promise.all([
            listItems("rounds", t.id).catch(() => []),
            listItems("ballots", t.id).catch(() => []),
            listItems("events", t.id).catch(() => [])
          ]);
          return { tournament: t, rounds: rounds || [], ballots: ballots || [], events: events || [] };
        }));
        if (mounted) setData(rows);
      } catch (e) {
        if (mounted) { setErr(e?.message || "Could not load your judging assignments."); setData([]); }
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const view = useMemo(() => {
    if (!data) return null;
    const pending = [];
    const assigned = [];
    const upcoming = [];
    for (const { tournament, rounds, ballots } of data) {
      const role = tournamentRole(tournament, user?.id);
      for (const r of rounds) {
        const isJudge = (r.judges || []).includes(user?.id);
        const isPart = r.participants && user?.id && user.id in (r.participants || {});
        const done = roundBallots(ballots, r.id).some((b) => b.judgeId === user?.id && (b.status === "submitted" || b.status === "locked"));
        const event = (data.find((x) => x.tournament.id === tournament.id)?.events || []).find((e) => e.id === r.eventId) || null;
        if (isJudge) {
          const row = { ...r, event, tournament, tournamentName: tournament?.name || "Tournament" };
          assigned.push(row);
          if ((r.status === "active" || r.status === "awaiting-ballot") && !done) pending.push(row);
        }
        if (isPart && (r.status === "not-started" || r.status === "active")) upcoming.push({ ...r, event, tournament, tournamentName: tournament?.name || "Tournament" });
      }
    }
    const sortKey = (r) => r.status === "active" ? 0 : r.status === "not-started" ? 1 : 2;
    pending.sort((a, b) => sortKey(a) - sortKey(b));
    return { pending, assigned, upcoming, tournaments: data };
  }, [data, user?.id]);

  if (!view) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading your rounds…" /></div>;

  const pending = view.pending;
  const assigned = view.assigned;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Judge workspace</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-3">Your rounds, your ballots.</h1>
      <p className="muted text-sm max-w-2xl mb-8 leading-relaxed">
        Everything you need to judge is here — no tournament administration pages required. Open a round, take notes,
        score, and submit. Drafts save as you go; nothing is silently rejected.
      </p>

      {err && <ErrorNote msg={err} />}
      {!user && (
        <div className="card p-4 mb-6">
          <p className="text-sm muted">Solo mode — you're running the whole tournament, so every round shows here and you can submit as any assigned judge.</p>
        </div>
      )}

      {/* Pending ballots */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-serif text-xl">Ballots required</h2>
          {pending.length > 0 && <span className="pill text-amber-600 dark:text-amber-400">{pending.length}</span>}
        </div>
        {pending.length === 0 ? (
          <div className="card p-5">
            <p className="text-sm muted flex items-center gap-2"><CheckCircle2 size={15} className="text-green-500" /> All caught up — no outstanding ballots.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((r) => (
              <button key={r.id} onClick={() => openFor(r)}
                className="card card-hover w-full p-4 flex flex-wrap items-center gap-3 text-left">
                <Scale size={16} className="text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg leading-snug">{r.name || `Round ${r.number}`} <span className="faint text-sm font-sans">· {r.tournamentName}</span></p>
                  <p className="faint text-xs">{ROUND_STATUSES.find((s) => s.id === r.status)?.label} · {Object.keys(r.participants || {}).length} participants{r.startsAt ? ` · ${fmtDate(r.startsAt, true)}` : ""}</p>
                </div>
                <span className="btn-solid !py-2 !px-4 text-xs">Open ballot <ArrowRight size={12} /></span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Assigned rounds */}
      <section className="mb-8">
        <div className="label-mono mb-3">All rounds you're judging</div>
        {assigned.length === 0 ? (
          <EmptyState icon={Scale} title="No judging assignments yet"
            body="When a tournament organizer assigns you to a round, it appears here with one-click access to the ballot." />
        ) : (
          <div className="space-y-2">
            {assigned.map((r) => {
              const done = roundBallots(view.tournaments.find((x) => x.tournament.id === r.tournament.id)?.ballots || [], r.id).some((b) => b.judgeId === user?.id && (b.status === "submitted" || b.status === "locked"));
              return (
                <button key={r.id} onClick={() => openFor(r)}
                  className="card card-hover w-full p-4 flex flex-wrap items-center gap-3 text-left">
                  <span className={cx("w-2.5 h-2.5 rounded-full shrink-0", done ? "bg-green-500" : r.status === "active" ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.name || `Round ${r.number}`} <span className="faint text-xs">· {r.tournamentName}</span></p>
                    <p className="faint text-xs">{ROUND_STATUSES.find((s) => s.id === r.status)?.label}</p>
                  </div>
                  <StatusPill status={r.status} />
                  <ArrowRight size={14} className="faint" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Rounds you're competing in */}
      {view.upcoming.length > 0 && (
        <section className="mb-8">
          <div className="label-mono mb-3">Rounds you're in</div>
          <div className="space-y-2">
            {view.upcoming.map((r) => (
              <Link key={r.id} to={`/compete/tournament/${r.tournament.id}/round/${r.id}`}
                className="card card-hover w-full p-4 flex flex-wrap items-center gap-3">
                <CalendarClock size={15} className="faint shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name || `Round ${r.number}`} <span className="faint text-xs">· {r.tournamentName}</span></p>
                  <p className="faint text-xs">{ROUND_STATUSES.find((s) => s.id === r.status)?.label}{r.startsAt ? ` · ${fmtDate(r.startsAt, true)}` : ""}</p>
                </div>
                <ArrowRight size={14} className="faint" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {openRound && (
        <RoundBallotModal
          round={openRound}
          user={user}
          activeBallot={activeBallot}
          setActiveBallot={setActiveBallot}
          saving={saving}
          onClose={() => { setOpenRound(null); setActiveBallot(null); }}
          onSave={saveBallot}
        />
      )}
    </div>
  );

  async function openFor(r) {
    // Find this round's ballots in the right tournament.
    const entry = view.tournaments.find((x) => x.tournament.id === r.tournament.id);
    const existing = roundBallots(entry?.ballots || [], r.id).find((b) => b.judgeId === user?.id);
    setActiveBallot(existing || null);
    setOpenRound(r);
  }

  async function saveBallot(next, status) {
    setSaving(true);
    try {
      const tid = openRound.tournament.id;
      const submittedAt = status === "submitted" ? new Date().toISOString() : next.submittedAt || null;
      const payload = { ...next, status, submittedAt };
      if (activeBallot) {
        await updateItem("ballots", activeBallot.id, payload, tid);
      } else {
        const id = await createItem("ballots", payload, tid);
        setActiveBallot({ ...payload, id });
      }
      if (status === "submitted") {
        await createItem("timeline", newTimelineEntry("ballot-submitted", `Ballot submitted for round ${openRound.number}`, `${next.judgeName || next.judgeId}`, user?.id), tid).catch(() => {});
        await createItem("log", newLogEntry("ballot.submit", openRound.id, `Round ${openRound.number} ballot by ${next.judgeName || next.judgeId}`, user?.id, user?.name || next.judgeName || ""), tid).catch(() => {});
      }
      setOpenRound(null);
      setActiveBallot(null);
      // Refresh so the lists reflect the submission.
      const ts = await listMy("tournaments");
      const rows = await Promise.all((ts || []).map(async (t) => {
        const [rounds, ballots, events] = await Promise.all([
          listItems("rounds", t.id).catch(() => []),
          listItems("ballots", t.id).catch(() => []),
          listItems("events", t.id).catch(() => [])
        ]);
        return { tournament: t, rounds: rounds || [], ballots: ballots || [], events: events || [] };
      }));
      setData(rows);
    } finally {
      setSaving(false);
    }
  }
}

function RoundBallotModal({ round, user, activeBallot, saving, onClose, onSave }) {
  const { tournament } = round;
  const judgeOptions = (round.judges || []).map((jid) => ({ uid: jid, name: tournament?.judges?.[jid]?.name || jid }));
  const formJudgeId = user?.id || judgeOptions[0]?.uid || "";
  return (
    <Modal title={`${round.name || `Round ${round.number}`} — ballot`} onClose={onClose} wide>
      <div className="flex items-center gap-2 mb-4">
        <StatusPill status={round.status} />
        <span className="faint text-xs">{tournament?.name}</span>
      </div>
      <BallotForm
        tournament={tournament}
        round={round}
        event={round.event}
        ballot={activeBallot}
        judgeId={formJudgeId}
        judgeName={user?.name || tournament?.judges?.[formJudgeId]?.name || ""}
        judgeOptions={!user ? judgeOptions : []}
        saving={saving}
        onSave={onSave}
        onCancel={onClose}
        locked={activeBallot?.status === "locked"}
      />
    </Modal>
  );
}
