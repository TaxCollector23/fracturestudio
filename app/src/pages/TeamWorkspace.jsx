import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, ClipboardList, BookOpen, Trash2, CheckCircle2, Circle, MessageSquare, Loader2, Copy, X } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { getItem, listItems, createItem, updateItem, removeItem, newMember, newAssignment, newSubmission, ASSIGNMENT_KINDS, sortByCreated, fmtDate, timeAgo } from "../lib/competition.js";
import { teamRole, canManageTeam } from "../lib/access.js";
import { writeMembership } from "../lib/firebase.js";
import { StatusPill, RoleBadge, EmptyState, LoadingBlock, ErrorNote, PersonList } from "../components/CompKit.jsx";
import { Modal, Field, Tabs } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

export default function TeamWorkspace() {
  const { tid } = useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [rubrics, setRubrics] = useState(null);
  const [tab, setTab] = useState("overview");
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getItem("teams", tid);
        if (!mounted) return;
        if (!t) { setTeam(null); return; }
        const [as, subs, rubs] = await Promise.all([
          listItems("assignments", tid).catch(() => []),
          listItems("submissions", tid).catch(() => []),
          listItems("rubrics", tid).catch(() => [])
        ]);
        if (mounted) { setTeam(t); setAssignments(as || []); setSubmissions(subs || []); setRubrics(rubs || []); }
      } catch (e) {
        if (mounted) { setErr(e?.message || "Could not load this team."); setTeam(null); }
      }
    })();
    return () => { mounted = false; };
  }, [tid]);

  const role = teamRole(team, user?.id);
  const coach = canManageTeam(team, user?.id);
  const memberId = user?.id || "me";
  const memberName = user?.name || "Solo coach";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members", count: Object.keys(team?.members || {}).length },
    { id: "assignments", label: "Assignments", count: assignments?.length },
    { id: "rubrics", label: "Rubrics", count: rubrics?.length }
  ];

  async function patchTeam(patch) {
    await updateItem("teams", tid, patch);
    setTeam((t) => ({ ...t, ...patch }));
  }

  async function addMember(data) {
    const id = data.uid || "m-" + Date.now().toString(36);
    await patchTeam({ members: { ...team.members, [id]: newMember(id, { role: "member", name: data.name, email: data.email }) } });
    if (!id.startsWith("m-")) await writeMembership(id, "teams", tid, { role: "member", name: data.name }).catch(() => {});
  }

  async function setMemberRole(id, role) {
    await patchTeam({ members: { ...team.members, [id]: { ...team.members[id], role } } });
  }

  async function removeMember(id) {
    const next = { ...team.members };
    delete next[id];
    await patchTeam({ members: next });
  }

  async function createAssignment(data) {
    const a = newAssignment({ ...data, createdBy: memberId });
    const id = await createItem("assignments", a, tid);
    setAssignments((prev) => [{ ...a, id }, ...(prev || [])]);
  }

  async function removeAssignment(id) {
    await removeItem("assignments", id, tid);
    setAssignments((prev) => (prev || []).filter((a) => a.id !== id));
  }

  async function submitCompletion(assignmentId, { note, selfScore }) {
    const existing = (submissions || []).find((s) => s.assignmentId === assignmentId && s.uid === memberId);
    const payload = { ...(existing || newSubmission({ assignmentId, uid: memberId, name: memberName })), note, selfScore, status: "done", completedAt: new Date().toISOString() };
    if (existing) {
      await updateItem("submissions", existing.id, payload, tid);
      setSubmissions((prev) => (prev || []).map((s) => (s.id === existing.id ? { ...s, ...payload } : s)));
    } else {
      const id = await createItem("submissions", payload, tid);
      setSubmissions((prev) => [{ ...payload, id }, ...(prev || [])]);
    }
  }

  async function giveFeedback(submissionId, feedback) {
    const existing = (submissions || []).find((s) => s.id === submissionId);
    if (!existing) return;
    await updateItem("submissions", submissionId, { feedback, status: "reviewed" }, tid);
    setSubmissions((prev) => (prev || []).map((s) => (s.id === submissionId ? { ...s, feedback, status: "reviewed" } : s)));
  }

  async function createRubric(data) {
    const id = await createItem("rubrics", data, tid);
    setRubrics((prev) => [{ ...data, id }, ...(prev || [])]);
  }

  async function removeRubric(id) {
    await removeItem("rubrics", id, tid);
    setRubrics((prev) => (prev || []).filter((r) => r.id !== id));
  }

  if (team === null && !err) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading team…" /></div>;
  if (err || !team) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><ErrorNote msg={err || "Team not found."} /><Link to="/compete" className="btn-ghost mt-4 py-2 px-4 text-xs"><ArrowLeft size={13} /> Back to competitions</Link></div>;

  const members = Object.entries(team.members || {}).map(([id, m]) => ({ id, name: m?.name || id, role: m?.role || "member", email: m?.email || "", meta: m?.role === "coach" ? "Coach" : "" }));

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <Link to="/compete" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 mb-3"><ArrowLeft size={13} /> Competitions</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-serif text-4xl md:text-5xl">{team.name || "Untitled team"}</h1>
            <RoleBadge role={role} />
          </div>
          {team.motto && <p className="muted text-sm">{team.motto}</p>}
        </div>
        {coach && team.code && (
          <button onClick={() => { try { navigator.clipboard.writeText(team.code); } catch (_) {} }}
            className="btn-ghost !py-2 !px-4 text-xs font-mono tracking-widest">
            <Copy size={12} /> {team.code}
          </button>
        )}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && <Overview team={team} assignments={assignments} submissions={submissions} members={members} coach={coach} />}
      {tab === "members" && <Members coach={coach} members={members} onAdd={addMember} onRole={setMemberRole} onRemove={removeMember} />}
      {tab === "assignments" && (
        <Assignments coach={coach} memberId={memberId} members={members} assignments={assignments} submissions={submissions}
          onCreate={createAssignment} onRemove={removeAssignment} onComplete={submitCompletion} onFeedback={giveFeedback} />
      )}
      {tab === "rubrics" && <Rubrics coach={coach} rubrics={rubrics} onCreate={createRubric} onRemove={removeRubric} />}
    </div>
  );
}

/* ─── Overview ─────────────────────────────────────────────────────────────── */

function Overview({ team, assignments, submissions, members, coach }) {
  const open = (assignments || []).filter((a) => a.status === "open");
  const recent = sortByCreated(submissions || []).slice(0, 5);
  return (
    <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
      <div className="space-y-6">
        <div className="card p-5">
          <div className="label-mono mb-3">Members</div>
          <PersonList people={members} empty="No members yet — share the join code." />
        </div>
        <div className="card p-5">
          <div className="label-mono mb-3">Recent activity</div>
          {recent.length === 0 ? (
            <p className="faint text-xs">Assignment completions and coach feedback show up here.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((s) => (
                <li key={s.id} className="text-sm flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <span className="truncate">{s.name} completed “{(assignments || []).find((a) => a.id === s.assignmentId)?.title || "assignment"}”</span>
                  <span className="faint text-xs ml-auto shrink-0">{timeAgo(s.completedAt || s.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="space-y-6">
        <div className="card p-5">
          <div className="label-mono mb-2">Open assignments</div>
          <div className="font-serif text-3xl mb-1">{open.length}</div>
          <p className="faint text-xs">{members.length} members · {coach ? "you're a coach" : "you're a member"}</p>
        </div>
        <div className="card p-5">
          <div className="label-mono mb-2">Share the join code</div>
          <div className="font-mono text-3xl tracking-[0.3em] mb-2">{team.code || "—"}</div>
          <p className="faint text-xs">Members enter this on the Competitions page. Teams are for prep, assignments, and shared rubrics — tournaments pull people from here.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Members ──────────────────────────────────────────────────────────────── */

function Members({ coach, members, onAdd, onRole, onRemove }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {coach && <div className="flex justify-end"><button onClick={() => setAdding(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> Add member</button></div>}
      <div className="card p-5">
        <PersonList people={members} empty="No members yet — share the join code." />
        {coach && members.length > 0 && (
          <div className="mt-4 border-t hair pt-4 space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-mono shrink-0">{(m.name || m.id).slice(0, 2).toUpperCase()}</span>
                <span className="truncate flex-1">{m.name}{m.email ? ` · ${m.email}` : ""}</span>
                <select value={m.role} onChange={(e) => onRole(m.id, e.target.value)} className="field !w-auto !py-1 !px-2 text-xs">
                  <option value="member">Member</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => onRemove(m.id)} className="faint hover:text-red-500" title="Remove"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      {adding && <AddMemberModal onClose={() => setAdding(false)} onAdd={(d) => onAdd(d).then(() => setAdding(false))} />}
    </div>
  );
}

function AddMemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  async function submit() {
    if (!name.trim()) { setErr("Enter a name."); return; }
    setBusy(true);
    try { await onAdd({ name: name.trim(), email: email.trim(), uid: uid.trim() }); }
    catch (e) { setErr(e?.message || "Could not add."); setBusy(false); }
  }
  return (
    <Modal title="Add member" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. Jordan Lee" /></Field>
        <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="jordan@school.edu" /></Field>
        <Field label="Account id (optional)"><input value={uid} onChange={(e) => setUid(e.target.value)} className="field font-mono" placeholder="Only if they have an account" /></Field>
        <p className="faint text-xs">Without an account id they appear on the roster but can't sign in. Account holders can also join by code.</p>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Adding…" : "Add member"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Assignments ──────────────────────────────────────────────────────────── */

function Assignments({ coach, memberId, members, assignments, submissions, onCreate, onRemove, onComplete, onFeedback }) {
  const [creating, setCreating] = useState(false);
  const sorted = sortByCreated(assignments || []);

  function subFor(a, uid) {
    return (submissions || []).find((s) => s.assignmentId === a.id && s.uid === uid);
  }

  return (
    <div className="space-y-4">
      {coach && <div className="flex justify-end"><button onClick={() => setCreating(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> New assignment</button></div>}
      {sorted.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments yet"
          body="Assign practice drills, argument prep, case reviews, research tasks, or custom work to members. Completion is lightweight — a note and optional self-score, not grading."
          action={coach ? <button onClick={() => setCreating(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create assignment</button> : null} />
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => {
            const mine = subFor(a, memberId);
            const myDone = mine?.status === "done" || mine?.status === "reviewed";
            const due = a.dueDate ? new Date(a.dueDate) : null;
            const overdue = due && due.getTime() < Date.now() && !myDone;
            return (
              <div key={a.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg">{a.title}</h3>
                      {a.kind && <span className="pill">{ASSIGNMENT_KINDS.find((k) => k.id === a.kind)?.label || a.kind}</span>}
                      {overdue && <StatusPill status="overdue" />}
                      {myDone && <StatusPill status="done" label="Completed" />}
                    </div>
                    {a.instructions && <p className="muted text-sm mt-1 leading-relaxed whitespace-pre-line">{a.instructions}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs faint mt-2">
                      {a.dueDate && <span>Due {fmtDate(a.dueDate)}</span>}
                      {a.topic && <span>Topic: {a.topic}</span>}
                      <span>Assigned to {a.assigneeIds?.length || members.length} member{(a.assigneeIds?.length || members.length) === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  {coach && <button onClick={() => onRemove(a.id)} className="faint hover:text-red-500" title="Delete"><Trash2 size={14} /></button>}
                </div>

                {/* Assignee progress (coach) */}
                {coach && (
                  <div className="mt-3 grid sm:grid-cols-2 gap-1.5">
                    {(a.assigneeIds && a.assigneeIds.length ? a.assigneeIds : members.map((m) => m.id)).map((uid) => {
                      const s = subFor(a, uid);
                      const name = members.find((m) => m.id === uid)?.name || uid;
                      const done = s?.status === "done" || s?.status === "reviewed";
                      return (
                        <div key={uid} className="flex items-start gap-2 rounded-sm border hair px-3 py-2">
                          {done ? <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" /> : <Circle size={14} className="faint shrink-0 mt-0.5" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{name}</p>
                            {s?.note && <p className="faint text-xs truncate">{s.note}</p>}
                            {s?.selfScore != null && <p className="faint text-xs">Self-score: {s.selfScore}/10</p>}
                            {s?.feedback && <p className="text-xs text-green-700 dark:text-green-400"><MessageSquare size={11} className="inline mr-1" />{s.feedback}</p>}
                            {s && <FeedbackInput submission={s} onSend={(fb) => onFeedback(s.id, fb)} />}
                          </div>
                          {s?.feedback && <StatusPill status="submitted" label="Reviewed" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* My completion (member) */}
                {!coach && (
                  <div className="mt-3 border-t hair pt-3">
                    {myDone ? (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 size={15} /> Completed{mine?.feedback ? ` — coach: “${mine.feedback}”` : ""}
                      </div>
                    ) : (
                      <CompleteForm a={a} mine={mine} onSubmit={(note, score) => onComplete(a.id, { note, selfScore: score })} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {creating && <AssignmentModal members={members} onClose={() => setCreating(false)} onCreate={(d) => onCreate(d).then(() => setCreating(false))} />}
    </div>
  );
}

function FeedbackInput({ submission, onSend }) {
  const [text, setText] = useState(submission?.feedback || "");
  const [sent, setSent] = useState(false);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input value={text} onChange={(e) => { setText(e.target.value); setSent(false); }} className="field !py-1 !px-2 text-xs" placeholder="Coach feedback…" />
      <button disabled={!text.trim() || sent} onClick={async () => { await onSend(text.trim()); setSent(true); }}
        className="btn-ghost !py-1 !px-2.5 text-[11px]">{sent ? <CheckCircle2 size={11} /> : <MessageSquare size={11} />} {sent ? "Sent" : "Send"}</button>
    </div>
  );
}

function CompleteForm({ a, mine, onSubmit }) {
  const [note, setNote] = useState(mine?.note || "");
  const [score, setScore] = useState(mine?.selfScore ?? 6);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} className="field flex-1 min-w-[200px] !py-2 text-sm" placeholder="Quick note on what you did…" />
      <select value={score} onChange={(e) => setScore(Number(e.target.value))} className="field !w-auto !py-2 text-sm">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}/10</option>)}
      </select>
      <button onClick={async () => { setBusy(true); try { await onSubmit(note.trim(), score); } finally { setBusy(false); } }} disabled={busy} className="btn-solid !py-2 !px-4 text-xs">
        {busy ? <Loader2 size={12} className="animate-spin" /> : "Mark complete"}
      </button>
    </div>
  );
}

function AssignmentModal({ members, onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [kind, setKind] = useState("drill");
  const [dueDate, setDueDate] = useState("");
  const [topic, setTopic] = useState("");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function toggle(id) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function submit() {
    if (!title.trim()) { setErr("Give the assignment a title."); return; }
    setBusy(true);
    try { await onCreate({ title: title.trim(), instructions, kind, dueDate, topic, assigneeIds }); }
    catch (e) { setErr(e?.message || "Could not create the assignment."); setBusy(false); }
  }

  return (
    <Modal title="New assignment" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Title"><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="field" placeholder="e.g. Drill: one-two-three organization" /></Field>
        <Field label="Instructions"><textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="field min-h-[80px] text-sm" placeholder="What should they do, and what counts as done?" /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Type"><select value={kind} onChange={(e) => setKind(e.target.value)} className="field">{ASSIGNMENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></Field>
          <Field label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="field" /></Field>
        </div>
        <Field label="Topic / event (optional)"><input value={topic} onChange={(e) => setTopic(e.target.value)} className="field" placeholder="e.g. LD · resolved: AI regulation" /></Field>
        <div>
          <div className="label-mono mb-1.5">Assign to</div>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
            {members.map((m) => (
              <label key={m.id} className={cx("flex items-center gap-2 rounded-sm border px-3 py-2 text-sm cursor-pointer", assigneeIds.includes(m.id) ? "border-zinc-950 dark:border-zinc-100 bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950" : "hair")}>
                <input type="checkbox" checked={assigneeIds.includes(m.id)} onChange={() => toggle(m.id)} className="sr-only" />
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
          {assigneeIds.length === 0 && <p className="faint text-xs mt-1">No selection = everyone on the team.</p>}
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Creating…" : "Create assignment"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Rubrics ──────────────────────────────────────────────────────────────── */

function Rubrics({ coach, rubrics, onCreate, onRemove }) {
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      {coach && <div className="flex justify-end"><button onClick={() => setCreating(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> New rubric</button></div>}
      {(!rubrics || rubrics.length === 0) ? (
        <EmptyState icon={BookOpen} title="No shared rubrics yet"
          body="Define team rubrics here and reuse them in tournaments. Ballots snapshot the rubric at submission time, so changing it later never corrupts old ballots."
          action={coach ? <button onClick={() => setCreating(true)} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> Create rubric</button> : null} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {(rubrics || []).map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-lg">{r.name}</h3>
                {coach && <button onClick={() => onRemove(r.id)} className="faint hover:text-red-500"><Trash2 size={14} /></button>}
              </div>
              <ul className="mt-2 space-y-1">
                {(r.categories || []).map((c) => (
                  <li key={c.id} className="text-sm flex justify-between"><span className="muted">{c.label}</span><span className="font-mono faint">{c.max} pts</span></li>
                ))}
              </ul>
              <p className="faint text-xs mt-2 capitalize">{r.decisionType || "win-loss"} decision</p>
            </div>
          ))}
        </div>
      )}
      {creating && <RubricModal onClose={() => setCreating(false)} onCreate={(d) => onCreate(d).then(() => setCreating(false))} />}
    </div>
  );
}

function RubricModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [decisionType, setDecisionType] = useState("win-loss");
  const [categories, setCategories] = useState([
    { id: "c1", label: "Argumentation", max: 30 },
    { id: "c2", label: "Delivery", max: 30 }
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function setCat(i, patch) {
    setCategories((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }
  function addCat() {
    setCategories((prev) => [...prev, { id: "c" + (prev.length + 1) + Date.now().toString(36), label: "", max: 30 }]);
  }

  async function submit() {
    if (!name.trim()) { setErr("Name the rubric."); return; }
    const clean = categories.map((c, i) => ({ ...c, id: c.id || "c" + i, label: c.label.trim() || `Category ${i + 1}`, max: Number(c.max) || 30 })).filter((c) => c.label);
    if (!clean.length) { setErr("Add at least one category."); return; }
    setBusy(true);
    try { await onCreate({ name: name.trim(), decisionType, categories: clean }); }
    catch (e) { setErr(e?.message || "Could not create the rubric."); setBusy(false); }
  }

  return (
    <Modal title="New rubric" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Rubric name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="e.g. Team PF rubric" /></Field>
        <Field label="Decision type"><select value={decisionType} onChange={(e) => setDecisionType(e.target.value)} className="field">
          <option value="win-loss">Win / loss</option><option value="rank">Ranking</option><option value="score">Score only</option>
        </select></Field>
        <div>
          <div className="label-mono mb-1.5">Categories</div>
          <div className="space-y-1.5">
            {categories.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <input value={c.label} onChange={(e) => setCat(i, { label: e.target.value })} placeholder="Category label" className="field flex-1 !py-2" />
                <input type="number" min={1} max={100} value={c.max} onChange={(e) => setCat(i, { max: e.target.value })} className="field !w-20 !py-2 text-right" />
                <button onClick={() => setCategories((prev) => prev.filter((_, j) => j !== i))} className="faint hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={addCat} className="btn-ghost !py-1.5 !px-3 text-xs mt-2"><Plus size={12} /> Add category</button>
        </div>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Creating…" : "Create rubric"}</button>
        </div>
      </div>
    </Modal>
  );
}
