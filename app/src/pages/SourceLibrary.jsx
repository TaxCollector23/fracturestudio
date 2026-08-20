import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Library, Plus, Search, Link2, FileText, Loader2, AlertTriangle, X,
  Check, RefreshCw, ExternalLink, Inbox, Trash2
} from "lucide-react";
import { listItems, createItem, updateItem, removeItem, getItem } from "../lib/prep.js";
import { newSource, SOURCE_TYPES, findDuplicateSources, researchSearch, recencyBuckets } from "../lib/research.js";
import { extractMetadata } from "../lib/api.js";
import { ResearchEmpty, LoadingBlock, ErrorNote, TagInput, SourceTypePill, ResearchStatus } from "../components/ResearchKit.jsx";
import CitationPreview, { AttributionLine } from "../components/CitationPreview.jsx";
import { cx } from "../lib/ui.js";
import { timeAgo } from "../lib/prep.js";

export default function SourceLibrary() {
  const [sources, setSources] = useState(null);
  const [topics, setTopics] = useState([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [recency, setRecency] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [s, t] = await Promise.all([listItems("sources"), listItems("topics")]);
      setSources(s); setTopics(t);
    } catch (e) {
      setErr(e?.message || "Could not load sources.");
    }
  };
  useEffect(() => { load(); }, []);

  if (sources === null) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading sources…" /></div>;

  let visible = sources;
  if (q.trim()) visible = researchSearch(visible, q).map(({ item }) => item);
  if (type) visible = visible.filter((s) => s.sourceType === type);
  if (topicFilter) visible = visible.filter((s) => (s.topicIds || []).includes(topicFilter));
  if (recency) visible = recencyBuckets(visible)[recency] || [];
  if (!showArchived) visible = visible.filter((s) => !s.archived);

  const sortKey = (s) => new Date(s.updatedAt || s.createdAt || 0).getTime();
  visible = [...visible].sort((a, b) => sortKey(b) - sortKey(a));

  const topicName = (id) => topics.find((t) => t.id === id)?.name;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="label-mono mb-1">Source library</div>
          <h1 className="font-serif text-3xl md:text-4xl">One record per source.</h1>
          <p className="muted text-sm mt-1 max-w-xl">Every source keeps a single canonical metadata record. Citations in every style are generated from it — so the library, evidence cards, and bibliography always agree.</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> Add source</button>
      </div>

      {err && <div className="mb-4"><ErrorNote msg={err} /></div>}

      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, publication, tags, notes…" className="input w-full !pl-9" />
          </div>
          <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {SOURCE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className="input !w-auto" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="">All topics</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="input !w-auto" value={recency} onChange={(e) => setRecency(e.target.value)}>
            <option value="">Any date</option>
            <option value="recent">Published recently</option>
            <option value="older">Older</option>
            <option value="unknown">No date known</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs muted cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Include archived
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        sources.length === 0 ? (
          <ResearchEmpty icon={Library} title="No sources yet"
            body="Paste a URL and Fracture will extract the metadata (title, author, publication, date) for you to confirm — or enter the source details manually."
            action={<button onClick={() => setAdding(true)} className="btn-solid !py-2 !px-4 text-xs"><Plus size={13} /> Add your first source</button>} />
        ) : (
          <ResearchEmpty icon={Search} title="No sources match" body="Try a different search or clear the filters." />
        )
      ) : (
        <div className="space-y-2">
          {visible.map((s) => <SourceRow key={s.id} s={s} topicName={topicName} onChanged={load} />)}
        </div>
      )}

      {adding && <AddSourceModal topics={topics} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </div>
  );
}

function SourceRow({ s, topicName, onChanged }) {
  const toggleArchive = async () => {
    await updateItem("sources", s.id, { archived: !s.archived });
    onChanged();
  };
  const del = async () => {
    if (!confirm(`Delete source “${s.title || s.url}”? Evidence cards keep their text but lose the source link.`)) return;
    await removeItem("sources", s.id);
    onChanged();
  };
  return (
    <Link to={`/research/source/${s.id}`} className="card card-hover p-4 block group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{s.title || s.url || "Untitled source"}</p>
            {s.archived && <ResearchStatus status="archived" label="archived" />}
            {s.favorite && <span className="text-amber-500 text-xs">★</span>}
          </div>
          <AttributionLine source={s} className="mt-0.5" />
          {s.description && <p className="muted text-xs mt-1 line-clamp-1">{s.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <SourceTypePill type={s.sourceType} />
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
            <button onClick={toggleArchive} className="faint hover:text-zinc-950 dark:hover:text-zinc-100 p-1" title={s.archived ? "Unarchive" : "Archive"}><Inbox size={13} /></button>
            <button onClick={del} className="faint hover:text-red-500 p-1" title="Delete"><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] font-mono faint">
        {(s.topicIds || []).map((tid) => topicName(tid) && <span key={tid} className="pill">{topicName(tid)}</span>)}
        {s.publishDate && <span>{s.publishDate.slice(0, 10)}</span>}
        {s.updatedAt && <span className="ml-auto">updated {timeAgo(s.updatedAt)}</span>}
      </div>
    </Link>
  );
}

// ─── Add source modal ────────────────────────────────────────────────────────

function AddSourceModal({ topics, onClose, onSaved }) {
  const [mode, setMode] = useState("url"); // url | manual
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(""); // "" | extracting | extracted | failed
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dupes, setDupes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const startExtract = async () => {
    if (!url.trim()) return;
    setBusy(true); setStatus("extracting"); setErr(""); setResult(null); setDupes([]);
    try {
      const res = await extractMetadata(url.trim());
      if (res.status !== "ok") {
        setStatus("failed");
        setResult({ message: res.message, url });
        setDraft(newSource({ url: url.trim(), sourceType: res.source?.sourceType || "website" }));
      } else {
        setStatus("extracted");
        setResult(res);
        setDraft(newSource({ ...res.source, sourceType: res.source.sourceType || "website", extracted: { ok: true, at: new Date().toISOString(), from: url.trim() } }));
      }
    } catch (e) {
      setStatus("failed");
      setErr(e?.message || "Could not read that page.");
      setDraft(newSource({ url: url.trim() }));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft.title?.trim() && !draft.url?.trim()) {
      setErr("Give the source a title or a URL before saving.");
      return;
    }
    setErr("");
    // Duplicate check against the saved library before creating.
    try {
      const all = await listItems("sources");
      const found = findDuplicateSources(all, draft);
      if (found.length > 0) {
        setDupes(found);
        return;
      }
      await createItem("sources", draft);
      onSaved();
    } catch (e) {
      setErr(e?.message || "Could not save the source.");
    }
  };

  const saveAnyway = async () => {
    setSaving(true);
    try {
      await createItem("sources", draft);
      onSaved();
    } catch (e) {
      setErr(e?.message || "Could not save the source.");
    } finally {
      setSaving(false);
    }
  };

  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8" onClick={onClose}>
      <div className="card w-full max-w-2xl p-6 mt-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl">Add source</h2>
          <button onClick={onClose} className="faint hover:text-zinc-950 dark:hover:text-zinc-100"><X size={18} /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button onClick={() => { setMode("url"); setErr(""); setResult(null); setDupes([]); }}
            className={cx("px-3 py-1.5 rounded-sm text-xs font-medium", mode === "url" ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950" : "muted hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
            <Link2 size={12} className="inline mr-1" />Paste a URL
          </button>
          <button onClick={() => { setMode("manual"); setErr(""); setResult(null); setDupes([]); }}
            className={cx("px-3 py-1.5 rounded-sm text-xs font-medium", mode === "manual" ? "bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950" : "muted hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
            <FileText size={12} className="inline mr-1" />Enter manually
          </button>
        </div>

        {mode === "url" && (
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startExtract()}
                placeholder="https://…"
                className="input flex-1"
              />
              <button onClick={startExtract} disabled={busy || !url.trim()} className="btn-solid !py-2 !px-4 text-xs disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Extract
              </button>
            </div>
            <p className="faint text-xs mt-1.5">Fracture reads the page once and pulls title, author, publication, and date. Everything extracted is editable — treat it as a starting point, not truth.</p>
          </div>
        )}

        {status === "extracting" && (
          <div className="card p-6 text-center"><Loader2 size={20} className="animate-spin mx-auto mb-2 faint" /><p className="text-sm muted">Reading the page and extracting metadata…</p></div>
        )}

        {status === "failed" && (
          <div className="card p-4 mb-4 border-amber-500/40">
            <p className="text-sm flex items-start gap-2"><AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <span>{result?.message || err || "Could not read that page."}</span></p>
            <p className="faint text-xs mt-2">You can still save it manually below — the source record will note that extraction failed.</p>
          </div>
        )}

        {status === "extracted" && (
          <div className="card p-3 mb-4 border-green-500/40 bg-green-500/5">
            <p className="text-xs flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check size={13} /> Extracted {result?.verified?.length || 0} fields
              {result?.inferredType && <span className="faint">— source type is an inference from the domain, change it if wrong</span>}
            </p>
            {(result?.missing || []).length > 0 && (
              <p className="faint text-[11px] mt-1">Not found: {result.missing.join(", ")} — add them if they matter for citations.</p>
            )}
          </div>
        )}

        {draft && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Labeled label="Title"><input className="input w-full" value={draft.title || ""} onChange={(e) => set("title", e.target.value)} placeholder="Article or publication title" /></Labeled>
              <Labeled label="URL"><input className="input w-full" value={draft.url || ""} onChange={(e) => set("url", e.target.value)} /></Labeled>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Labeled label="Author(s) — comma separated"><AuthorInput value={draft.authors || []} onChange={(v) => set("authors", v)} /></Labeled>
              <Labeled label="Publication / container"><input className="input w-full" value={draft.publication || ""} onChange={(e) => set("publication", e.target.value)} placeholder="The New York Times, journal name, site…" /></Labeled>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Labeled label="Publisher"><input className="input w-full" value={draft.publisher || ""} onChange={(e) => set("publisher", e.target.value)} /></Labeled>
              <Labeled label="Published (YYYY-MM-DD)"><input className="input w-full" value={draft.publishDate || ""} onChange={(e) => set("publishDate", e.target.value)} placeholder="2026-08-20" /></Labeled>
              <Labeled label="Accessed"><input className="input w-full" value={draft.accessDate || ""} onChange={(e) => set("accessDate", e.target.value)} placeholder="2026-08-20" /></Labeled>
              <Labeled label="DOI"><input className="input w-full" value={draft.doi || ""} onChange={(e) => set("doi", e.target.value)} placeholder="10.xxxx/…" /></Labeled>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Labeled label="Source type">
                <select className="input w-full" value={draft.sourceType || "news"} onChange={(e) => set("sourceType", e.target.value)}>
                  {SOURCE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Labeled>
              <Labeled label="Pages"><input className="input w-full" value={draft.pages || ""} onChange={(e) => set("pages", e.target.value)} placeholder="pp. 12–18" /></Labeled>
            </div>
            <Labeled label="Description"><textarea className="input w-full" rows={2} value={draft.description || ""} onChange={(e) => set("description", e.target.value)} /></Labeled>
            <div className="grid sm:grid-cols-2 gap-3">
              <Labeled label="Topics">
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => set("topicIds", (draft.topicIds || []).includes(t.id) ? (draft.topicIds || []).filter((x) => x !== t.id) : [...(draft.topicIds || []), t.id])}
                      className={cx("pill cursor-pointer", (draft.topicIds || []).includes(t.id) && "!bg-zinc-950 !text-white dark:!bg-zinc-100 dark:!text-zinc-950")}>
                      {t.name}
                    </button>
                  ))}
                  {topics.length === 0 && <span className="faint text-xs">No topics yet — create one from the research hub.</span>}
                </div>
              </Labeled>
              <Labeled label="Tags"><TagInput tags={draft.tags || []} onChange={(v) => set("tags", v)} /></Labeled>
            </div>
            <Labeled label="Notes"><textarea className="input w-full" rows={2} value={draft.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Why did you save this?" /></Labeled>

            <CitationPreview source={draft} />
          </div>
        )}

        {dupes.length > 0 && (
          <div className="card p-4 mt-4 border-amber-500/40">
            <p className="text-sm font-medium mb-2 flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" /> Looks like this might already be saved</p>
            <div className="space-y-1.5 mb-3">
              {dupes.map(({ source, reason }) => (
                <div key={source.id} className="text-xs">
                  <Link to={`/research/source/${source.id}`} className="text-sky-600 dark:text-sky-400 font-medium truncate">{source.title || source.url}</Link>
                  <span className="faint"> — matched by {reason === "url" ? "URL" : reason === "doi" ? "DOI" : "title"}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={dupes[0] && `/research/source/${dupes[0].source.id}`} onClick={onClose} className="btn-solid !py-2 !px-4 text-xs">Use existing source</Link>
              <button onClick={saveAnyway} disabled={saving} className="btn-ghost !py-2 !px-4 text-xs">Save anyway (keep both)</button>
              <button onClick={() => setDupes([])} className="btn-ghost !py-2 !px-4 text-xs">Edit details</button>
            </div>
          </div>
        )}

        {err && !dupes.length && <div className="mt-3"><ErrorNote msg={err} /></div>}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost !py-2 !px-4 text-xs">Cancel</button>
          {draft && !dupes.length && (
            <button onClick={save} className="btn-solid !py-2 !px-5 text-xs"><ExternalLink size={12} className="mr-1" /> Save source</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="label-mono !text-[10px] mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function AuthorInput({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const name = draft.trim();
    if (!name) return;
    onChange([...value, { name }]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((a, i) => (
        <span key={i} className="pill inline-flex items-center gap-1">
          {a.name}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="faint hover:text-red-500"><X size={10} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add}
        placeholder="Full name or organization" className="bg-transparent text-xs w-32 outline-none placeholder:text-zinc-400" />
    </div>
  );
}
