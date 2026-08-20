// BallotForm.jsx — the structured ballot a judge fills out for a round.
//
// Supports category scores, per-category comments, written feedback, a
// decision (win/loss side, ranking, or score-only), and a reason. The rubric
// is snapshotted onto the ballot at creation so later rubric edits never
// corrupt historical results. Submission runs through validateBallot() and
// every problem is shown inline — nothing is silently rejected. Drafts skip
// the full validation so a judge can save progress.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Save, X } from "lucide-react";
import { blankBallot, validateBallot, ballotTotal, scoresComplete, rubricById } from "../lib/rubrics.js";
import { effectiveFormat } from "../lib/events.js";
import { participantNames } from "../lib/competition.js";
import { cx } from "../lib/ui.js";
import { ErrorNote } from "./CompKit.jsx";

export default function BallotForm({ tournament, round, event, ballot, judgeId, judgeName, judgeOptions = [], saving, onSave, onCancel, locked }) {
  const format = effectiveFormat(event || {});
  const rubric = event?.rubric && event.rubric.categories?.length ? event.rubric : rubricById(format.rubricId);

  const people = participantNames(tournament, round);
  const sides = useMemo(() => {
    if (round?.sides?.length) return round.sides;
    if (format.sides?.length) return format.sides;
    const uniq = [...new Set(people.map((p) => p.side).filter(Boolean))];
    return uniq.map((id) => ({ id, label: id }));
  }, [round, format.sides, people]);

  const [draft, setDraft] = useState(() => {
    if (ballot) return JSON.parse(JSON.stringify(ballot));
    return blankBallot({ rubric, roundId: round?.id, eventId: event?.id, judgeId, decisionType: rubric.decisionType });
  });
  const [attempted, setAttempted] = useState(false);
  const [selectedJudge, setSelectedJudge] = useState(judgeId || judgeOptions[0]?.uid || "");

  const editable = !locked && draft.status !== "locked" && draft.status !== "submitted";
  const isRank = draft.decisionType === "rank";
  const isWinLoss = draft.decisionType === "win-loss";
  const isScore = draft.decisionType === "score";

  const issues = useMemo(() => validateBallot(draft), [draft]);
  const errors = issues.filter((i) => !i.field.startsWith("scores.") || attempted);
  const showIssues = attempted ? issues : issues.filter((i) => !i.field.startsWith("scores."));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setScore = (catId, raw) => {
    const n = raw === "" ? null : Number(raw);
    set({ scores: { ...draft.scores, [catId]: Number.isFinite(n) && n >= 0 ? Math.min(Number(catMax(catId)), Math.round(n)) : null } });
  };
  const catMax = (catId) => (draft.rubricSnapshot?.categories || []).find((c) => c.id === catId)?.max || 30;

  const effectiveJudgeId = selectedJudge || judgeId;
  const total = ballotTotal(draft);
  const complete = scoresComplete(draft);
  const highest = useMemo(() => {
    if (!complete) return null;
    const cats = draft.rubricSnapshot?.categories || [];
    const totals = people.map((p) => ({
      ...p,
      total: cats.reduce((s, c) => s + (Number(draft.scores?.[c.id]) || 0), 0)
    }));
    return totals.sort((a, b) => b.total - a.total)[0];
  }, [complete, people, draft]);

  function submit() {
    setAttempted(true);
    if (issues.length) return;
    onSave({ ...draft, judgeId: effectiveJudgeId, judgeName: judgeOptions.find((j) => j.uid === effectiveJudgeId)?.name || draft.judgeName || judgeName }, "submitted");
  }

  function saveDraft() {
    onSave({ ...draft, judgeId: effectiveJudgeId, judgeName: judgeOptions.find((j) => j.uid === effectiveJudgeId)?.name || draft.judgeName || judgeName }, "draft");
  }

  return (
    <div className="space-y-5">
      {/* Judge selection (guest/solo mode) */}
      {judgeOptions.length > 1 && (!ballot || !ballot.judgeId) && (
        <div className="card p-4">
          <label className="label-mono mb-1.5">Submitting as</label>
          <select value={selectedJudge} onChange={(e) => setSelectedJudge(e.target.value)} className="field !py-2 text-sm">
            {judgeOptions.map((j) => <option key={j.uid} value={j.uid}>{j.name || j.uid}</option>)}
          </select>
          <p className="faint text-xs mt-2">You are running this tournament solo — pick which judge this ballot belongs to.</p>
        </div>
      )}

      {/* Scores */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg">Scores</h3>
          <span className="font-mono text-sm">{complete ? `${total} pts` : "— pts"}</span>
        </div>
        <div className="space-y-3">
          {(draft.rubricSnapshot?.categories || []).map((c) => (
            <div key={c.id} className="grid sm:grid-cols-[minmax(0,1fr)_120px] gap-2 items-start">
              <div>
                <label className="text-sm font-medium">{c.label}</label>
                <input
                  value={draft.scores?.[c.id] ?? ""}
                  onChange={(e) => setScore(c.id, e.target.value)}
                  disabled={!editable}
                  type="number" min={0} max={c.max} placeholder={`0–${c.max}`}
                  className="field !py-2 text-sm mt-1"
                />
              </div>
              <input
                value={draft.comments?.[c.id] || ""}
                onChange={(e) => set({ comments: { ...draft.comments, [c.id]: e.target.value } })}
                disabled={!editable}
                placeholder="Comment…"
                className="field !py-2 text-sm"
              />
            </div>
          ))}
        </div>
        {attempted && issues.filter((i) => i.field.startsWith("scores.")).map((i, idx) => (
          <p key={idx} className="text-red-500 text-xs mt-2"><AlertTriangle size={11} className="inline mr-1" />{i.message}</p>
        ))}
      </div>

      {/* Decision */}
      <div className="card p-5">
        <h3 className="font-serif text-lg mb-3">Decision</h3>
        {isWinLoss && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {sides.map((s) => {
                const onSide = people.filter((p) => p.side === s.id);
                return (
                  <button key={s.id} disabled={!editable}
                    onClick={() => set({ decision: s.id })}
                    className={cx("flex-1 min-w-[140px] rounded-sm border px-4 py-3 text-left transition-colors",
                      draft.decision === s.id ? "border-zinc-950 dark:border-zinc-100 bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950" : "hair hover:bg-zinc-100 dark:hover:bg-zinc-900")}>
                    <div className="font-serif">{s.label}</div>
                    <div className="text-xs opacity-70">{onSide.map((p) => p.name).join(" · ") || "—"}</div>
                  </button>
                );
              })}
            </div>
            {draft.decision && people.some((p) => p.side === draft.decision) && (
              <p className="faint text-xs">You are voting for <span className="font-medium">{people.filter((p) => p.side === draft.decision).map((p) => p.name).join(" · ")}</span>.</p>
            )}
          </div>
        )}
        {isRank && (
          <div>
            <label className="label-mono mb-1.5">1st place</label>
            <select disabled={!editable}
              value={draft.rankParticipantId || ""}
              onChange={(e) => { const idx = people.findIndex((p) => p.id === e.target.value); set({ rankParticipantId: e.target.value, rank: idx >= 0 ? idx + 1 : null }); }}
              className="field">
              <option value="">Rank the round…</option>
              {people.map((p, i) => <option key={p.id} value={p.id}>#{i + 1} — {p.name}</option>)}
            </select>
          </div>
        )}
        {isScore && complete && highest && (
          <div className="rounded-sm border hair p-3 text-sm">
            Highest total: <span className="font-medium">{highest.name}</span> with {highest.total} pts
            <span className="faint text-xs block mt-1">Score-only rounds decide by highest total.</span>
          </div>
        )}
        {isScore && !complete && (
          <p className="faint text-xs">Complete every category score — the highest total wins.</p>
        )}

        <div className="mt-4">
          <label className="label-mono mb-1.5">Reason for decision <span className="normal-case font-normal">(optional)</span></label>
          <textarea disabled={!editable} value={draft.reason || ""} onChange={(e) => set({ reason: e.target.value })}
            placeholder="The weighing, the dropped argument, the clash that decided it…"
            className="field min-h-[70px] text-sm" />
        </div>
      </div>

      {/* Feedback */}
      <div className="card p-5">
        <h3 className="font-serif text-lg mb-3">Feedback to the round</h3>
        <textarea disabled={!editable} value={draft.feedback || ""} onChange={(e) => set({ feedback: e.target.value })}
          placeholder="What worked, what broke, what to fix before the next round…"
          className="field min-h-[110px] text-sm" />
        {showIssues.filter((i) => i.field === "feedback").map((i, idx) => (
          <p key={idx} className="text-red-500 text-xs mt-2"><AlertTriangle size={11} className="inline mr-1" />{i.message}</p>
        ))}
      </div>

      {showIssues.filter((i) => i.field !== "feedback" && !i.field.startsWith("scores.")).length > 0 && (
        <div className="rounded-sm border border-red-500/30 bg-red-500/10 p-3">
          <p className="label-mono text-red-600 dark:text-red-400 mb-1.5">Fix these before submitting</p>
          <ul className="space-y-1">
            {showIssues.filter((i) => i.field !== "feedback" && !i.field.startsWith("scores.")).map((i, idx) => (
              <li key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      {!editable && <ErrorNote msg={draft.status === "locked" ? "This ballot is locked and can no longer be edited." : "This ballot is submitted and locked from further edits."} />}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <>
            <button onClick={saveDraft} disabled={saving} className="btn-ghost !py-2.5 !px-5 text-sm">
              <Save size={14} /> Save draft
            </button>
            <button onClick={submit} disabled={saving} className="btn-solid !py-2.5 !px-5 text-sm">
              <Check size={14} /> {saving ? "Saving…" : "Submit ballot"}
            </button>
          </>
        )}
        {onCancel && <button onClick={onCancel} className="btn-ghost !py-2.5 !px-5 text-sm"><X size={14} /> Close</button>}
        {draft.status === "submitted" && <span className="pill text-green-600 dark:text-green-400"><Check size={12} /> Submitted</span>}
      </div>
    </div>
  );
}
