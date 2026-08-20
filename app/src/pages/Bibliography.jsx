import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Copy, Check, AlertTriangle, ArrowLeft, ListFilter } from "lucide-react";
import { listItems } from "../lib/prep.js";
import { buildBibliography } from "../lib/research.js";
import { CITATION_STYLES } from "../lib/citations.js";
import { LoadingBlock, ResearchEmpty, CopyButton } from "../components/ResearchKit.jsx";
import { cx } from "../lib/ui.js";

export default function Bibliography() {
  const [sources, setSources] = useState(null);
  const [topics, setTopics] = useState([]);
  const [collections, setCollections] = useState([]);
  const [style, setStyle] = useState("mla");
  const [scope, setScope] = useState({ mode: "all", topicId: "", collectionId: "", manual: [] });
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, c] = await Promise.all([listItems("sources"), listItems("topics"), listItems("researchCollections")]);
        setSources(s); setTopics(t); setCollections(c);
      } catch (_) {}
    })();
  }, []);

  if (sources === null) return <div className="max-w-4xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading sources…" /></div>;

  const nonArchived = sources.filter((s) => !s.archived);

  let selected;
  if (scope.mode === "topic") selected = nonArchived.filter((s) => (s.topicIds || []).includes(scope.topicId));
  else if (scope.mode === "collection") selected = nonArchived.filter((s) => (s.collectionIds || []).includes(scope.collectionId));
  else if (scope.mode === "manual") selected = nonArchived.filter((s) => scope.manual.includes(s.id));
  else selected = nonArchived;

  const bib = buildBibliography(selected, style);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(bib.text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1400);
    } catch (_) {}
  };

  const download = () => {
    const blob = new Blob([bib.text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bibliography-${style}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggleManual = (id) => {
    setScope((sc) => ({
      ...sc,
      manual: sc.manual.includes(id) ? sc.manual.filter((x) => x !== id) : [...sc.manual, id]
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <Link to="/research" className="inline-flex items-center gap-1.5 text-xs muted hover:text-zinc-950 dark:hover:text-zinc-100 mb-4">
        <ArrowLeft size={12} /> All research
      </Link>
      <div className="label-mono mb-1">Bibliography builder</div>
      <h1 className="font-serif text-3xl md:text-4xl mb-2">One citation engine, every export.</h1>
      <p className="muted text-sm mb-6 max-w-xl">Pick a scope, pick a style, and the bibliography is generated from the same canonical source records used everywhere else — sorted per style convention.</p>

      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="label-mono !text-[10px] mr-1"><ListFilter size={11} className="inline mr-1" />Scope</span>
          {[
            { id: "all", label: "All sources" },
            { id: "topic", label: "By topic" },
            { id: "collection", label: "By collection" },
            { id: "manual", label: "Pick manually" }
          ].map((m) => (
            <button key={m.id} onClick={() => setScope({ ...scope, mode: m.id })}
              className={cx("px-3 py-1.5 rounded-sm text-xs font-medium transition-colors",
                scope.mode === m.id ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950" : "muted hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
              {m.label}
            </button>
          ))}
          {scope.mode === "topic" && (
            <select className="input !w-auto" value={scope.topicId} onChange={(e) => setScope({ ...scope, topicId: e.target.value })}>
              <option value="">Choose topic…</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {scope.mode === "collection" && (
            <select className="input !w-auto" value={scope.collectionId} onChange={(e) => setScope({ ...scope, collectionId: e.target.value })}>
              <option value="">Choose collection…</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {scope.mode === "manual" && (
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {nonArchived.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer rounded-sm px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <input type="checkbox" checked={scope.manual.includes(s.id)} onChange={() => toggleManual(s.id)} />
                <span className="truncate">{s.title || s.url || "Untitled source"}</span>
              </label>
            ))}
            {nonArchived.length === 0 && <p className="faint text-xs col-span-2 py-2">No sources yet — add some from the source library.</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <span className="label-mono !text-[10px] mr-1">Style</span>
          {CITATION_STYLES.map((s) => (
            <button key={s.id} onClick={() => setStyle(s.id)}
              className={cx("px-3 py-1.5 rounded-sm text-xs font-mono transition-colors",
                style === s.id ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950" : "muted hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
              {s.label}
            </button>
          ))}
          <span className="ml-auto text-xs muted">{selected.length} sources</span>
        </div>
      </div>

      {selected.length === 0 ? (
        <ResearchEmpty icon={FileText} title="Nothing to cite yet"
          body="Add sources to the library first — then come back and generate a bibliography for a topic, a collection, or a hand-picked set." />
      ) : (
        <>
          {bib.issues.some((x) => x.issues.length > 0) && (
            <div className="card p-3 mb-4 border-amber-500/40">
              <p className="text-xs flex items-start gap-2"><AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                <span><span className="font-medium">Review before exporting.</span> {bib.issues.length} source{bib.issues.length > 1 ? "s" : ""} {bib.issues.length > 1 ? "have" : "has"} missing citation fields — citations are still generated with the best available information, but completeness affects quality.</span></p>
              <ul className="mt-2 space-y-1">
                {bib.issues.slice(0, 4).map(({ source, issues }) => (
                  <li key={source.id} className="text-[11px]">
                    <Link to={`/research/source/${source.id}`} className="text-sky-600 dark:text-sky-400 font-medium">{source.title || source.url}</Link>
                    <span className="faint"> — {issues.map((i) => i.field).join(", ")}</span>
                  </li>
                ))}
                {bib.issues.length > 4 && <li className="text-[11px] faint">…and {bib.issues.length - 4} more.</li>}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <button onClick={copyAll} className="btn-solid !py-2 !px-4 text-xs">
              {copiedAll ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
              {copiedAll ? "Copied bibliography" : "Copy bibliography"}
            </button>
            <button onClick={download} className="btn-ghost !py-2 !px-4 text-xs"><FileText size={12} className="mr-1" /> Download .txt</button>
            <span className="ml-auto faint text-[11px]">{bib.items.length} entries, sorted alphabetically per {CITATION_STYLES.find((s) => s.id === style)?.label}</span>
          </div>

          <div className="card p-5">
            <ol className="space-y-3">
              {bib.items.map(({ source, citation }, idx) => (
                <li key={source.id} className="flex items-start gap-2 group">
                  <span className="text-xs font-mono faint mt-1 w-5 shrink-0">{idx + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">{citation}</p>
                    <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={citation} label="Copy" />
                      <Link to={`/research/source/${source.id}`} className="text-[11px] faint hover:text-zinc-950 dark:hover:text-zinc-100">Edit source</Link>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
