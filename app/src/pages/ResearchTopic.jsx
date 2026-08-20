import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, HelpCircle, Library, Quote, Plus, ListChecks, FolderOpen,
  AlertTriangle, CheckCircle2, BookOpen, Link2, ExternalLink, Trash2
} from "lucide-react";
import { getItem, listItems, createItem, updateItem, removeItem } from "../lib/prep.js";
import {
  newResearchQuestion, newResearchCollection, newResearchTask,
  researchGaps, topicCoverage, questionsForSource, evidenceForSource,
  QUESTION_STATUSES, QUESTION_PRIORITIES
} from "../lib/research.js";
import { ResearchEmpty, ResearchStatus, TagInput, ErrorNote, LoadingBlock, SourceTypePill } from "../components/ResearchKit.jsx";
import { AttributionLine } from "../components/CitationPreview.jsx";
import { cx } from "../lib/ui.js";
import { formatCitation } from "../lib/citations.js";

const TABS = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "sources", label: "Sources", icon: Library },
  { id: "evidence", label: "Evidence", icon: Quote },
  { id: "gaps", label: "Gaps", icon: AlertTriangle },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "collections", label: "Collections", icon: FolderOpen }
];

export default function ResearchTopic() {
  const { id } = useParams();
  const [topic, setTopic] = useState(null);
  const [sources, setSources] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [excerpts, setExcerpts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [tab, setTab] = useState("overview");
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const t = await getItem("topics", id);
      setTopic(t);
      if (!t) return;
      const [s, q, e, x, b, c] = await Promise.all([
        listItems("sources"), listItems("researchQuestions"), listItems("evidence"),
        listItems("excerpts"), listItems("blocks"), listItems("cases")
      ]);
      setSources(s); setQuestions(q); setEvidence(e); setExcerpts(x); setBlocks(b); setCases(c);
      setTasks((await listItems("researchTasks")).filter((tk) => tk.topicId === id));
      setCollections((await listItems("researchCollections")).filter((co) => (co.topicIds || []).includes(id)));
    } catch (e2) {
      setErr(e2?.message || "Could not load this topic.");
    }
  };

  useEffect(() => { load(); }, [id]);

  const patch = async (patchData) => {
    await updateItem("topics", id, patchData);
    setTopic((t) => ({ ...t, ...patchData }));
  };

  if (err && !topic) return <div className="max-w-5xl mx-auto px-5 md:px-8 py-10"><ErrorNote msg={err} /></div>;
  if (!topic) return <div className="max-w-5xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading topic…" /></div>;

  const inTopic = (item) => (item.topicIds || []).includes(id) || item.topic === topic.name;
  const tSources = sources.filter(inTopic);
  const tEvidence = evidence.filter(inTopic);
  const tQuestions = questions.filter(inTopic);
  const cov = topicCoverage({ topics: [topic], sources, evidence, questions, blocks, cases, topicId: id });
  const gaps = researchGaps({ topics: [topic], sources, evidence, questions, blocks, cases, topicId: id });

  const addQuestion = async () => {
    const question = prompt("Research question:");
    if (!question?.trim()) return;
    await createItem("researchQuestions", newResearchQuestion({ question: question.trim(), topicIds: [id], tags: topic.tags || [] }));
    load();
  };

  const addCollection = async () => {
    const name = prompt("Collection name (e.g. “Pro case”, “Economy”, “Tournament prep”):");
    if (!name?.trim()) return;
    await createItem("researchCollections", newResearchCollection({ name: name.trim(), topicIds: [id] }));
    load();
  };

  const addTask = async () => {
    const title = prompt("Research task (e.g. “Find evidence for the extinction impact”):");
    if (!title?.trim()) return;
    await createItem("researchTasks", newResearchTask({ title: title.trim(), topicId: id, priority: "medium" }));
    load();
  };

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <Link to="/research" className="inline-flex items-center gap-1.5 text-xs muted hover:text-zinc-950 dark:hover:text-zinc-100 mb-4">
        <ArrowLeft size={12} /> All research
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <div className="label-mono mb-1">Research topic</div>
          <h1 className="font-serif text-3xl md:text-4xl">{topic.name || "Untitled topic"}</h1>
          {topic.resolution && <p className="faint text-sm mt-1 italic">{topic.resolution}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ResearchStatus status={topic.status} />
          <Link to="/prep/topics" className="btn-ghost !py-1.5 !px-3 text-xs"><ExternalLink size={12} /> Knowledge base</Link>
        </div>
      </div>

      {/* Quick topic edit */}
      <div className="card p-4 mt-4 grid sm:grid-cols-2 gap-3">
        <Field label="Title"><input className="input" value={topic.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label="Event"><input className="input" value={topic.event || ""} placeholder="PF, LD, Policy, Extemp…" onChange={(e) => patch({ event: e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <Field label="Resolution / central question">
            <textarea className="input w-full" rows={2} value={topic.resolution || ""} placeholder="What is this research organized around?" onChange={(e) => patch({ resolution: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea className="input w-full" rows={2} value={topic.description || ""} onChange={(e) => patch({ description: e.target.value })} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Tags"><TagInput tags={topic.tags || []} onChange={(tags) => patch({ tags })} /></Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-zinc-200 dark:border-zinc-800 mt-6 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx("inline-flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 transition-colors",
              tab === t.id ? "border-zinc-950 dark:border-zinc-100 font-medium" : "border-transparent muted hover:text-zinc-900 dark:hover:text-zinc-100")}>
            <t.icon size={13} /> {t.label}
            {t.id === "gaps" && gaps.length > 0 && <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] flex items-center justify-center font-mono">{gaps.length}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab cov={cov} gaps={gaps} sources={tSources} evidence={tEvidence} questions={tQuestions}
          excerpts={excerpts} blocks={blocks} go={setTab} topic={topic} />
      )}
      {tab === "questions" && (
        <QuestionsTab questions={tQuestions} sources={sources} evidence={evidence} topicId={id} onChanged={load} add={addQuestion} />
      )}
      {tab === "sources" && (
        <SourcesTab sources={tSources} evidence={evidence} questions={tQuestions} topic={topic} />
      )}
      {tab === "evidence" && (
        <EvidenceTab evidence={tEvidence} sources={sources} blocks={blocks} cases={cases} topic={topic} />
      )}
      {tab === "gaps" && <GapsTab gaps={gaps} />}
      {tab === "tasks" && (
        <TasksTab tasks={tasks} add={addTask} onChanged={load} />
      )}
      {tab === "collections" && (
        <CollectionsTab collections={collections} sources={tSources} evidence={tEvidence} add={addCollection} onChanged={load} />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label-mono !text-[10px] mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function OverviewTab({ cov, gaps, sources, evidence, questions, excerpts, blocks, go, topic }) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="label-mono">Research coverage</span>
            <span className="font-serif text-2xl">{cov.score}%</span>
          </div>
          <p className="faint text-xs mb-3">How the score is built — every part is counted below, nothing hidden.</p>
          <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-4 flex">
            {cov.parts.map((p) => p.total > 0 && (
              <div key={p.id} className={cx("h-full", p.id === "questions" ? "bg-sky-500" : p.id === "evidence" ? "bg-green-500" : "bg-amber-500")}
                style={{ width: `${(p.weight / (cov.parts.reduce((s, x) => s + x.weight, 0))) * 100}%` }} />
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {cov.parts.map((p) => (
              <div key={p.id} className="rounded-sm border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="text-sm font-medium mb-1">{p.label}: <span className="font-mono">{p.total ? `${p.value}/${p.total}` : "—"}</span></div>
                <p className="faint text-[11px] leading-snug">{p.explanation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="label-mono">Research gaps</span>
            <button onClick={() => go("gaps")} className="text-xs muted hover:text-zinc-950 dark:hover:text-zinc-100">View all</button>
          </div>
          {gaps.length === 0 ? (
            <p className="text-sm muted leading-relaxed">
              No tracked questions or arguments are missing research. That means every question has linked sources or evidence and every
              argument carries a card — it does <em>not</em> mean the research is complete or correct.
            </p>
          ) : (
            <ul className="space-y-2">
              {gaps.slice(0, 4).map((g) => (
                <li key={g.id} className="flex items-start gap-2 text-sm">
                  <span className={cx("mt-0.5 shrink-0", g.severity === "danger" ? "text-red-500" : g.severity === "warn" ? "text-amber-500" : "faint")}>
                    {g.severity === "danger" ? <AlertTriangle size={13} /> : g.severity === "warn" ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                  </span>
                  <div>
                    <span className="font-medium">{g.title}.</span>{" "}
                    <span className="muted">{g.detail} {g.action}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <span className="label-mono mb-3 block">Quick stats</span>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="muted">Research questions</span><span className="font-mono">{questions.length}</span></li>
            <li className="flex justify-between"><span className="muted">Answered</span><span className="font-mono">{questions.filter((q) => q.status === "answered").length}</span></li>
            <li className="flex justify-between"><span className="muted">Unanswered</span><span className="font-mono">{questions.filter((q) => q.status === "unanswered").length}</span></li>
            <li className="flex justify-between"><span className="muted">Sources</span><span className="font-mono">{sources.length}</span></li>
            <li className="flex justify-between"><span className="muted">Evidence cards</span><span className="font-mono">{evidence.length}</span></li>
            <li className="flex justify-between"><span className="muted">Unlinked evidence</span><span className="font-mono">{cov.counts.unlinkedEvidence}</span></li>
            <li className="flex justify-between"><span className="muted">Arguments w/o evidence</span><span className="font-mono">{cov.counts.argumentsWithoutEvidence}</span></li>
          </ul>
        </div>
        <div className="card p-5">
          <span className="label-mono mb-3 block">Recent activity</span>
          {topicActivityLocal({ sources, evidence, questions, excerpts, blocks, topicName: topic.name }).length === 0 ? (
            <p className="faint text-xs">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {topicActivityLocal({ sources, evidence, questions, excerpts, blocks, topicName: topic.name }).slice(0, 6).map((r, i) => (
                <li key={i} className="text-xs">
                  <span className="pill">{r.label}</span>
                  <p className="muted truncate mt-0.5">{r.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function topicActivityLocal({ sources, evidence, questions, excerpts, blocks, topicName }) {
  const rows = [];
  for (const s of sources) rows.push({ at: s.updatedAt || s.createdAt, label: "Source", detail: s.title || s.url });
  for (const e of evidence) rows.push({ at: e.updatedAt || e.createdAt, label: "Evidence", detail: e.text?.slice(0, 50) });
  for (const q of questions) rows.push({ at: q.updatedAt || q.createdAt, label: "Question", detail: q.question });
  for (const x of excerpts) rows.push({ at: x.updatedAt || x.createdAt, label: "Excerpt", detail: x.quote?.slice(0, 50) });
  for (const b of blocks) rows.push({ at: b.updatedAt || b.createdAt, label: "Argument", detail: b.tag || b.myResponse?.slice(0, 50) });
  return rows.filter((r) => r.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function QuestionsTab({ questions, sources, evidence, topicId, onChanged, add }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});

  const save = async () => {
    await updateItem("researchQuestions", editing.id, draft);
    setEditing(null);
    onChanged();
  };

  if (questions.length === 0) {
    return <ResearchEmpty icon={HelpCircle} title="No research questions yet"
      body="Define what you are trying to answer — “What causes X?”, “What evidence supports this policy?”, “What are the strongest arguments against Z?” — then link sources and evidence to it."
      action={<button onClick={add} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> Add a research question</button>} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={add} className="btn-ghost !py-2 !px-3 text-xs"><Plus size={13} /> Add question</button></div>
      {questions.map((q) => (
        <div key={q.id} className="card p-4">
          {editing?.id === q.id ? (
            <div className="space-y-2">
              <input className="input w-full" value={draft.question || ""} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
              <textarea className="input w-full" rows={2} placeholder="Description" value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="flex flex-wrap items-center gap-3">
                <select className="input !w-auto" value={draft.status || "unanswered"} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {QUESTION_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <select className="input !w-auto" value={draft.priority || "medium"} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                  {QUESTION_PRIORITIES.map((s) => <option key={s.id} value={s.id}>{s.label} priority</option>)}
                </select>
                <div className="ml-auto flex gap-2">
                  <button onClick={save} className="btn-solid !py-1.5 !px-3 text-xs">Save</button>
                  <button onClick={() => setEditing(null)} className="btn-ghost !py-1.5 !px-3 text-xs">Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{q.question}</p>
                  {q.description && <p className="muted text-sm mt-0.5">{q.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ResearchStatus status={q.status} />
                  <button onClick={() => { setEditing(q); setDraft(q); }} className="text-xs muted hover:text-zinc-950 dark:hover:text-zinc-100">Edit</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Link to="/research/sources" className="text-[11px] font-mono text-sky-600 dark:text-sky-400 inline-flex items-center gap-1">
                  <Link2 size={10} /> {q.sourceIds?.length || 0} sources
                </Link>
                <span className="text-[11px] font-mono faint inline-flex items-center gap-1"><Quote size={10} /> {q.evidenceIds?.length || 0} evidence</span>
                {q.priority === "high" && <span className="pill">high priority</span>}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function SourcesTab({ sources, evidence, questions, topic }) {
  if (sources.length === 0) {
    return <ResearchEmpty icon={Library} title="No sources in this topic yet"
      body="Add sources to the library and tag them with this topic — or link existing sources here. Each source keeps one canonical metadata record used everywhere."
      action={<Link to="/research/sources" className="btn-solid !py-2 !px-4 text-xs"><Library size={13} /> Open source library</Link>} />;
  }
  return (
    <div className="space-y-2">
      {sources.map((s) => {
        const cards = evidenceForSource(s.id, evidence);
        const qs = questionsForSource(s.id, questions);
        return (
          <Link key={s.id} to={`/research/source/${s.id}`} className="card card-hover p-4 block">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{s.title || s.url || "Untitled source"}</p>
                <AttributionLine source={s} className="mt-1" />
              </div>
              <SourceTypePill type={s.sourceType} />
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-[11px] font-mono faint">
              <span>{cards.length} evidence cards</span>
              <span>{qs.length} questions</span>
              {s.publishDate && <span>{s.publishDate.slice(0, 7)}</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function EvidenceTab({ evidence, sources, blocks, cases, topic }) {
  if (evidence.length === 0) {
    return <ResearchEmpty icon={Quote} title="No evidence cards yet"
      body="Open a source, highlight the useful passage, and turn it into an evidence card. Cards carry a claim, an excerpt, the citation, and links to the arguments that use them."
      action={<Link to="/research/sources" className="btn-solid !py-2 !px-4 text-xs"><Library size={13} /> Open source library</Link>} />;
  }
  const srcOf = (id) => sources.find((s) => s.id === id);
  return (
    <div className="space-y-2">
      {evidence.map((e) => {
        const src = srcOf(e.sourceId);
        const usedIn = [
          ...(e.blockIds || []).map((bid) => ({ label: blocks.find((b) => b.id === bid)?.tag || "Block", to: "/prep/library" })),
          ...(e.caseIds || []).map((cid) => ({ label: cases.find((c) => c.id === cid)?.title || "Case", to: "/prep/cases" }))
        ];
        return (
          <div key={e.id} className="card p-4">
            {e.label && <div className="flex items-center gap-2 mb-1"><span className="pill">{e.label}</span>
              {e.evidenceType && <span className="text-[10px] font-mono faint uppercase tracking-wider">{e.evidenceType.replace(/-/g, " ")}</span>}</div>}
            {e.claim && <p className="font-medium text-sm mb-1">{e.claim}</p>}
            <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 text-sm muted leading-relaxed">{e.text}</blockquote>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {src
                ? <Link to={`/research/source/${src.id}`} className="text-[11px] font-mono text-sky-600 dark:text-sky-400 truncate max-w-[320px]">{formatCitation(src, "debate")}</Link>
                : <span className="text-[11px] font-mono faint truncate">{e.source}</span>}
              {usedIn.map((u, i) => (
                <Link key={i} to={u.to} className="text-[11px] font-mono text-green-600 dark:text-green-400 inline-flex items-center gap-1"><Link2 size={10} /> {u.label}</Link>
              ))}
              {usedIn.length === 0 && <span className="text-[11px] font-mono faint">not used in any argument</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GapsTab({ gaps }) {
  if (gaps.length === 0) {
    return <ResearchEmpty icon={CheckCircle2} title="No gaps detected"
      body="Every tracked question and argument has some research coverage. That means links exist — not that the research is complete, accurate, or strong enough. Keep adding sources and stress-testing." />;
  }
  const sev = { danger: "text-red-500 border-red-500/30 bg-red-500/10", warn: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10", info: "border-zinc-300 dark:border-zinc-700 text-zinc-500" };
  return (
    <div className="space-y-2">
      {gaps.map((g) => (
        <div key={g.id} className="card p-4">
          <div className="flex items-start gap-3">
            <span className={cx("mt-0.5 shrink-0", g.severity === "danger" ? "text-red-500" : g.severity === "warn" ? "text-amber-500" : "faint")}>
              {g.severity === "info" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-sm">{g.title}</p>
              <p className="muted text-sm mt-0.5">{g.detail}</p>
              <p className="text-xs mt-1.5"><span className="font-medium">Suggested action:</span> <span className="muted">{g.action}</span></p>
            </div>
            <span className={cx("ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase", sev[g.severity] || sev.info)}>{g.severity}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ tasks, add, onChanged }) {
  const flip = async (t) => {
    await updateItem("researchTasks", t.id, { status: t.status === "done" ? "open" : "done" });
    onChanged();
  };
  const del = async (t) => {
    if (!confirm(`Delete task “${t.title}”?`)) return;
    await removeItem("researchTasks", t.id);
    onChanged();
  };
  if (tasks.length === 0) {
    return <ResearchEmpty icon={ListChecks} title="No research tasks"
      body="Tasks exist to close research gaps: find evidence for an impact, find a response to an argument, verify a source, update outdated evidence."
      action={<button onClick={add} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> Add a research task</button>} />;
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><button onClick={add} className="btn-ghost !py-2 !px-3 text-xs"><Plus size={13} /> Add task</button></div>
      {tasks.map((t) => (
        <div key={t.id} className={cx("card p-4 flex items-center gap-3", t.status === "done" && "opacity-60")}>
          <button onClick={() => flip(t)} className={cx("shrink-0 w-5 h-5 rounded-full border flex items-center justify-center", t.status === "done" ? "border-green-500 bg-green-500/20 text-green-500" : "border-zinc-300 dark:border-zinc-700")}>
            {t.status === "done" && <CheckCircle2 size={13} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={cx("text-sm", t.status === "done" && "line-through")}>{t.title}</p>
            {t.notes && <p className="faint text-xs mt-0.5">{t.notes}</p>}
          </div>
          <ResearchStatus status={t.status} />
          {t.priority === "high" && <span className="pill">high</span>}
          <button onClick={() => del(t)} className="faint hover:text-red-500 shrink-0" title="Delete"><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

function CollectionsTab({ collections, sources, evidence, add, onChanged }) {
  const [draft, setDraft] = useState(null);
  const save = async () => {
    if (draft.name?.trim()) await updateItem("researchCollections", draft.id, { name: draft.name.trim() });
    setDraft(null);
    onChanged();
  };
  if (collections.length === 0) {
    return <ResearchEmpty icon={FolderOpen} title="No collections yet"
      body="Collections are flexible groupings — “Pro case”, “Con case”, “Economy”, “High-quality sources”, “Tournament prep”. A source or card can live in several."
      action={<button onClick={add} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> New collection</button>} />;
  }
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {collections.map((c) => {
        const cSources = sources.filter((s) => (s.collectionIds || []).includes(c.id));
        const cEvidence = evidence.filter((e) => (e.collectionIds || []).includes(c.id));
        return (
          <div key={c.id} className="card p-4">
            {draft?.id === c.id ? (
              <div className="flex gap-2">
                <input autoFocus className="input flex-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <button onClick={save} className="btn-solid !py-1.5 !px-3 text-xs">Save</button>
              </div>
            ) : (
              <p className="font-medium mb-1 cursor-pointer" onClick={() => setDraft(c)}>{c.name}</p>
            )}
            <p className="text-[11px] font-mono faint">{cSources.length} sources · {cEvidence.length} cards</p>
            {c.description && <p className="muted text-xs mt-1">{c.description}</p>}
            <Link to="/research/bibliography" className="text-xs text-sky-600 dark:text-sky-400 mt-2 inline-block">Build bibliography →</Link>
          </div>
        );
      })}
      <button onClick={add} className="card card-hover p-4 flex items-center justify-center gap-2 text-sm muted">
        <Plus size={14} /> New collection
      </button>
    </div>
  );
}
