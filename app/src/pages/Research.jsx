import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, Library, Quote, HelpCircle, Plus, ArrowRight, Sparkles,
  FileText, ListChecks, Inbox
} from "lucide-react";
import { listItems, createItem } from "../lib/prep.js";
import { newSource, newResearchQuestion, topicCoverage, topicActivity, researchSearch } from "../lib/research.js";
import { LoadingBlock, ResearchStatus, ResearchEmpty } from "../components/ResearchKit.jsx";
import { useAuth } from "../lib/useAuth.jsx";
import { cx } from "../lib/ui.js";
import { formatCitation } from "../lib/citations.js";
import { timeAgo } from "../lib/prep.js";

export default function Research() {
  const { user } = useAuth();
  const [topics, setTopics] = useState(null);
  const [sources, setSources] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [cases, setCases] = useState([]);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [t, s, e, qs, b, c] = await Promise.all([
        listItems("topics"), listItems("sources"), listItems("evidence"),
        listItems("researchQuestions"), listItems("blocks"), listItems("cases")
      ]);
      setTopics(t); setSources(s); setEvidence(e); setQuestions(qs); setBlocks(b); setCases(c);
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  const createTopic = async () => {
    const name = newName.trim();
    if (!name) return;
    setErr("");
    try {
      const id = await createItem("topics", {
        name, description: "", event: "", resolution: "", status: "active",
        tags: [], definitions: [], proArguments: [], conArguments: [],
        strategies: [], questions: [], notes: ""
      });
      setNewName("");
      setCreating(false);
      window.location.hash = "";
      window.location.href = `/research/topic/${id}`;
    } catch (e) {
      setErr(e?.message || "Could not create the topic.");
    }
  };

  const stats = topics ? {
    topics: topics.length,
    sources: sources.length,
    evidence: evidence.length,
    unanswered: questions.filter((q2) => q2.status === "unanswered").length
  } : null;

  const globalSearch = q.trim() ? [
    ...researchSearch(sources, q).map(({ item, score }) => ({ kind: "source", item, score })),
    ...researchSearch(evidence, q).map(({ item, score }) => ({ kind: "evidence", item, score })),
    ...researchSearch(questions, q, { titleFields: ["question"], bodyFields: ["description"] }).map(({ item, score }) => ({ kind: "question", item, score }))
  ].sort((a, b) => b.score - a.score).slice(0, 8) : [];

  if (topics === null) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading research…" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Research Intelligence</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-3">Research, evidence, citations.</h1>
      <p className="muted text-sm max-w-2xl mb-5 leading-relaxed">
        From research question to evidence card to argument — with structured sources, real citations (MLA / APA / Chicago / debate),
        research gaps, and a bibliography builder. Everything is searchable and linked, so no source ever becomes an isolated bookmark.
      </p>

      {!user && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm muted">Working as a guest — research saves on this device. Sign in to keep it across devices.</p>
          <Link to="/auth" className="btn-solid py-2 px-4 text-xs">Sign in</Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-8">
        <Link to="/research/sources" className="btn-solid !py-2 !px-4 text-xs"><Library size={13} /> Source library</Link>
        <Link to="/research/bibliography" className="btn-ghost !py-2 !px-4 text-xs"><FileText size={13} /> Bibliography</Link>
        <button onClick={() => setCreating(true)} className="btn-ghost !py-2 !px-4 text-xs"><Plus size={13} /> New topic</button>
      </div>

      {creating && (
        <div className="card p-5 mb-8">
          <div className="label-mono mb-3">New research topic</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTopic()}
              placeholder="Topic title — e.g. “Resolved: The USFG should expand school choice”"
              className="input flex-1 min-w-[260px]"
            />
            <button onClick={createTopic} className="btn-solid !py-2 !px-4 text-xs">Create</button>
            <button onClick={() => setCreating(false)} className="btn-ghost !py-2 !px-4 text-xs">Cancel</button>
          </div>
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Link to="/research/sources" className="card card-hover p-4 block">
            <div className="font-serif text-3xl">{stats.sources}</div>
            <div className="label-mono mt-1">Sources</div>
          </Link>
          <div className="card p-4">
            <div className="font-serif text-3xl">{stats.evidence}</div>
            <div className="label-mono mt-1">Evidence cards</div>
          </div>
          <div className="card p-4">
            <div className="font-serif text-3xl">{stats.unanswered}</div>
            <div className="label-mono mt-1">Unanswered questions</div>
          </div>
          <div className="card p-4">
            <div className="font-serif text-3xl">{stats.topics}</div>
            <div className="label-mono mt-1">Topics</div>
          </div>
        </div>
      )}

      {/* Global search across research content */}
      <div className="relative mb-8">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sources, evidence, and questions across everything…"
          className="input w-full"
        />
        {globalSearch.length > 0 && (
          <div className="absolute z-20 mt-2 w-full card p-2 space-y-0.5">
            {globalSearch.map(({ kind, item }) => (
              <Link
                key={kind + item.id}
                to={kind === "source" ? `/research/source/${item.id}` : kind === "evidence" ? "/prep/library" : `/research/topic/${(item.topicIds || [])[0] || ""}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm"
              >
                {kind === "source" ? <Library size={12} className="faint" /> : kind === "evidence" ? <Quote size={12} className="faint" /> : <HelpCircle size={12} className="faint" />}
                <span className="truncate">{item.title || item.question || item.text?.slice(0, 50) || "Untitled"}</span>
                {kind === "source" && <span className="ml-auto text-[10px] font-mono faint truncate max-w-[180px]">{formatCitation(item, "debate")}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="label-mono mb-3">Topics</div>
      {topics.length === 0 ? (
        <ResearchEmpty
          icon={BookOpen}
          title="No research topics yet"
          body="A topic is your research workspace: research questions, sources, evidence, gaps, and tasks organized around one resolution, speech subject, or policy issue."
          action={<button onClick={() => setCreating(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> Create your first topic</button>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((t) => <TopicCard key={t.id} topic={t} sources={sources} evidence={evidence} questions={questions} blocks={blocks} cases={cases} />)}
        </div>
      )}

      <div className="label-mono mt-10 mb-3">Recent activity</div>
      <div className="card p-4">
        {topicActivity({ sources, evidence, questions, blocks, limit: 8 }).length === 0 ? (
          <p className="faint text-sm py-2">Nothing yet — save a source or create an evidence card and it shows up here.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {topicActivity({ sources, evidence, questions, blocks, limit: 8 }).map((r, i) => (
              <li key={i} className="flex items-center gap-2 py-2 text-sm">
                <span className="pill shrink-0">{r.label}</span>
                <span className="truncate muted">{r.detail}</span>
                <span className="ml-auto faint text-xs shrink-0">{timeAgo(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TopicCard({ topic, sources, evidence, questions, blocks, cases }) {
  const cov = topicCoverage({ topics: [topic], sources, evidence, questions, blocks, cases, topicId: topic.id });
  const tSources = sources.filter((s) => (s.topicIds || []).includes(topic.id));
  const tEvidence = evidence.filter((e) => (e.topicIds || []).includes(topic.id) || e.topic === topic.name);
  return (
    <Link to={`/research/topic/${topic.id}`} className="card card-hover p-5 flex flex-col group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="font-serif text-lg leading-snug">{topic.name || "Untitled topic"}</h3>
        <ResearchStatus status={topic.status} />
      </div>
      {topic.resolution && <p className="faint text-xs mb-2">{topic.resolution}</p>}
      {topic.description && <p className="muted text-sm leading-relaxed mb-3 line-clamp-2">{topic.description}</p>}
      <div className="mt-auto">
        <div className="flex items-center gap-3 text-[11px] font-mono faint mb-2">
          <span>{tSources.length} sources</span>
          <span>{tEvidence.length} cards</span>
          <span>{cov.counts.unanswered} unanswered</span>
          <span className={cx("ml-auto", cov.score >= 70 ? "text-green-600 dark:text-green-400" : cov.score >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500")}>{cov.score}% coverage</span>
        </div>
        <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className={cx("h-full rounded-full", cov.score >= 70 ? "bg-green-500" : cov.score >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${cov.score}%` }} />
        </div>
      </div>
      <ArrowRight size={14} className="faint absolute top-5 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
