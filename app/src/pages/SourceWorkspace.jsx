import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Link2, Quote, Plus, ExternalLink, Star, Inbox, Trash2,
  BookOpen, HelpCircle, Check
} from "lucide-react";
import { getItem, listItems, createItem, updateItem, removeItem } from "../lib/prep.js";
import {
  newSource, newExcerpt, SOURCE_TYPES, EVIDENCE_TYPES,
  questionsForSource, evidenceForSource, excerptsForSourceId, argumentsForEvidence
} from "../lib/research.js";
import { extractMetadata } from "../lib/api.js";
import { LoadingBlock, ErrorNote, TagInput, SourceTypePill, ProvenanceTag } from "../components/ResearchKit.jsx";
import CitationPreview from "../components/CitationPreview.jsx";
import { cx } from "../lib/ui.js";
import { formatCitation, citationIssues } from "../lib/citations.js";
import { timeAgo } from "../lib/prep.js";

export default function SourceWorkspace() {
  const { id } = useParams();
  const [source, setSource] = useState(null);
  const [topics, setTopics] = useState([]);
  const [collections, setCollections] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [excerpts, setExcerpts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [cases, setCases] = useState([]);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractErr, setExtractErr] = useState("");

  const load = async () => {
    try {
      const s = await getItem("sources", id);
      if (!s) { setErr("That source doesn't exist anymore."); return; }
      setSource(s);
      const [t, c, e, q, x, b, cs] = await Promise.all([
        listItems("topics"), listItems("researchCollections"), listItems("evidence"),
        listItems("researchQuestions"), listItems("excerpts"), listItems("blocks"), listItems("cases")
      ]);
      setTopics(t); setCollections(c); setEvidence(e); setQuestions(q); setExcerpts(x); setBlocks(b); setCases(c);
    } catch (e2) {
      setErr(e2?.message || "Could not load this source.");
    }
  };
  useEffect(() => { load(); }, [id]);

  const patch = async (patchData) => {
    await updateItem("sources", id, patchData);
    setSource((s) => ({ ...s, ...patchData }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const reextract = async () => {
    if (!source?.url) return;
    setExtracting(true); setExtractErr("");
    try {
      const res = await extractMetadata(source.url);
      if (res.status === "ok") {
        const merged = { ...newSource(res.source), ...res.source };
        await patch({ ...merged, extracted: { ok: true, at: new Date().toISOString(), from: source.url } });
      } else {
        setExtractErr(res.message || "Could not re-read that page.");
      }
    } catch (e) {
      setExtractErr(e?.message || "Could not re-read that page.");
    } finally {
      setExtracting(false);
    }
  };

  if (err && !source) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><ErrorNote msg={err} /></div>;
  if (!source) return <div className="max-w-6xl mx-auto px-5 md:px-8 py-10"><LoadingBlock label="Loading source…" /></div>;

  const sEvidence = evidenceForSource(source.id, evidence);
  const sExcerpts = excerptsForSourceId(source.id, excerpts);
  const sQuestions = questionsForSource(source.id, questions);
  const issues = citationIssues(source);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link to="/research/sources" className="inline-flex items-center gap-1.5 text-xs muted hover:text-zinc-950 dark:hover:text-zinc-100">
          <ArrowLeft size={12} /> Source library
        </Link>
        <div className="flex items-center gap-2">
          {saved && <span className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={11} /> Saved</span>}
          {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="btn-ghost !py-1.5 !px-3 text-xs"><ExternalLink size={12} /> Open original</a>}
          <button onClick={() => patch({ favorite: !source.favorite })} className={cx("btn-ghost !py-1.5 !px-3 text-xs", source.favorite && "!text-amber-500")} title="Favorite">
            <Star size={12} /> {source.favorite ? "Favorited" : "Favorite"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h1 className="font-serif text-3xl md:text-4xl min-w-0">{source.title || source.url || "Untitled source"}</h1>
        <SourceTypePill type={source.sourceType} />
      </div>
      <p className="muted text-sm font-mono mb-4">{formatCitation(source, "debate")}</p>

      <div className="grid lg:grid-cols-5 gap-4 mt-6">
        {/* Metadata + quality */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="label-mono">Metadata</span>
              {source.url && (
                <button onClick={reextract} disabled={extracting} className="btn-ghost !py-1 !px-2 text-[11px]">
                  {extracting ? "Reading…" : "Re-extract from URL"}
                </button>
              )}
            </div>
            {extractErr && <div className="mb-3"><ErrorNote msg={extractErr} /></div>}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Title" prov={source.provenance?.title}><input className="input w-full" value={source.title || ""} onChange={(e) => patch({ title: e.target.value })} /></Field>
              <Field label="URL" prov={source.provenance?.url}><input className="input w-full" value={source.url || ""} onChange={(e) => patch({ url: e.target.value })} /></Field>
              <Field label="Author(s)" prov={source.provenance?.authors}><AuthorEdit value={source.authors || []} onChange={(v) => patch({ authors: v })} /></Field>
              <Field label="Publication / container" prov={source.provenance?.publication}><input className="input w-full" value={source.publication || ""} onChange={(e) => patch({ publication: e.target.value })} /></Field>
              <Field label="Publisher"><input className="input w-full" value={source.publisher || ""} onChange={(e) => patch({ publisher: e.target.value })} /></Field>
              <Field label="Published" prov={source.provenance?.publishDate}><input className="input w-full" value={source.publishDate || ""} onChange={(e) => patch({ publishDate: e.target.value })} placeholder="2026-08-20" /></Field>
              <Field label="Accessed"><input className="input w-full" value={source.accessDate || ""} onChange={(e) => patch({ accessDate: e.target.value })} placeholder="2026-08-20" /></Field>
              <Field label="DOI"><input className="input w-full" value={source.doi || ""} onChange={(e) => patch({ doi: e.target.value })} placeholder="10.xxxx/…" /></Field>
              <Field label="Pages"><input className="input w-full" value={source.pages || ""} onChange={(e) => patch({ pages: e.target.value })} /></Field>
              <Field label="Source type">
                <select className="input w-full" value={source.sourceType || "news"} onChange={(e) => patch({ sourceType: e.target.value })}>
                  {SOURCE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description" prov={source.provenance?.description}><textarea className="input w-full" rows={2} value={source.description || ""} onChange={(e) => patch({ description: e.target.value })} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Topics">
                  <div className="flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <button key={t.id} type="button"
                        onClick={() => patch({ topicIds: (source.topicIds || []).includes(t.id) ? (source.topicIds || []).filter((x) => x !== t.id) : [...(source.topicIds || []), t.id] })}
                        className={cx("pill cursor-pointer", (source.topicIds || []).includes(t.id) && "!bg-zinc-950 !text-white dark:!bg-zinc-100 dark:!text-zinc-950")}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Collections">
                  <div className="flex flex-wrap gap-1.5">
                    {collections.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => patch({ collectionIds: (source.collectionIds || []).includes(c.id) ? (source.collectionIds || []).filter((x) => x !== c.id) : [...(source.collectionIds || []), c.id] })}
                        className={cx("pill cursor-pointer", (source.collectionIds || []).includes(c.id) && "!bg-zinc-950 !text-white dark:!bg-zinc-100 dark:!text-zinc-950")}>
                        {c.name}
                      </button>
                    ))}
                    {collections.length === 0 && <span className="faint text-xs">No collections yet — create one from a topic workspace.</span>}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Tags"><TagInput tags={source.tags || []} onChange={(v) => patch({ tags: v })} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes"><textarea className="input w-full" rows={2} value={source.notes || ""} onChange={(e) => patch({ notes: e.target.value })} placeholder="Why did you save this? What is it good for?" /></Field>
              </div>
            </div>
            {source.extracted?.ok && (
              <p className="faint text-[11px] mt-3">Metadata auto-extracted {timeAgo(source.extracted.at)} from {source.extracted.from}. Imported fields are editable; changes here never rewrite the original page.</p>
            )}
          </div>

          <QualityPanel source={source} patch={patch} />

          {/* Usage: where is this source used */}
          <div className="card p-5">
            <span className="label-mono mb-3 block">Where is this used?</span>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="faint text-xs mb-1.5 flex items-center gap-1"><Quote size={11} /> Evidence cards — {sEvidence.length}</p>
                {sEvidence.length === 0 ? <p className="muted text-xs">Nothing extracted yet.</p> : (
                  <ul className="space-y-1">
                    {sEvidence.map((e) => <li key={e.id} className="muted text-xs truncate">“{e.text?.slice(0, 48)}…”</li>)}
                  </ul>
                )}
              </div>
              <div>
                <p className="faint text-xs mb-1.5 flex items-center gap-1"><HelpCircle size={11} /> Research questions — {sQuestions.length}</p>
                {sQuestions.length === 0 ? <p className="muted text-xs">Not linked to any question.</p> : (
                  <ul className="space-y-1">
                    {sQuestions.map((q) => <li key={q.id} className="muted text-xs truncate">{q.question}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Citation + evidence + excerpts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <span className="label-mono mb-2 block">Citation</span>
            <CitationPreview source={source} />
            {issues.length === 0 && <p className="faint text-[11px] mt-2">All citation-critical fields are present.</p>}
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => patch({ archived: !source.archived })} className="btn-ghost !py-1.5 !px-3 text-xs"><Inbox size={12} /> {source.archived ? "Unarchive" : "Archive"}</button>
              <button onClick={async () => { if (confirm(`Delete this source?`)) { await removeItem("sources", id); window.location.href = "/research/sources"; } }} className="btn-ghost !py-1.5 !px-3 text-xs !text-red-500"><Trash2 size={12} /> Delete</button>
            </div>
          </div>

          <EvidenceFromSource source={source} evidence={sEvidence} blocks={blocks} cases={cases} onChanged={load} />
          <ExcerptsPanel source={source} excerpts={sExcerpts} onChanged={load} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, prov, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 label-mono !text-[10px] mb-1">{label} {prov && <ProvenanceTag prov={prov} />}</span>
      {children}
    </label>
  );
}

function AuthorEdit({ value, onChange }) {
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
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="faint hover:text-red-500"><Trash2 size={9} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add}
        placeholder="Add author" className="bg-transparent text-xs w-24 outline-none placeholder:text-zinc-400" />
    </div>
  );
}

function QualityPanel({ source, patch }) {
  const q = source.quality || {};
  const set = (k, v) => patch({ quality: { ...q, [k]: v } });
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="label-mono">Source quality context</span>
      </div>
      <p className="faint text-xs mb-3 leading-relaxed">Not a credibility score — context to help you evaluate the source yourself. Nothing here is judged automatically.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="label-mono !text-[10px] mb-1 block">Primary vs secondary</span>
          <select className="input w-full" value={q.primarySecondary || ""} onChange={(e) => set("primarySecondary", e.target.value)}>
            <option value="">Not assessed</option>
            <option value="primary">Primary source</option>
            <option value="secondary">Secondary source</option>
          </select>
        </label>
        <label className="block">
          <span className="label-mono !text-[10px] mb-1 block">Organization type</span>
          <select className="input w-full" value={q.orgType || ""} onChange={(e) => set("orgType", e.target.value)}>
            <option value="">Not assessed</option>
            <option value="government">Government</option>
            <option value="academic">Academic</option>
            <option value="journalistic">Journalistic</option>
            <option value="organizational">Organizational / advocacy</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label-mono !text-[10px] mb-1 block">Potential conflicts of interest</span>
          <textarea className="input w-full" rows={2} value={q.conflictsOfInterest || ""} onChange={(e) => set("conflictsOfInterest", e.target.value)} placeholder="Funding, authorship ties, advocacy role…" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label-mono !text-[10px] mb-1 block">Methodology (where relevant)</span>
          <textarea className="input w-full" rows={2} value={q.methodology || ""} onChange={(e) => set("methodology", e.target.value)} placeholder="Sample size, study design, data source…" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label-mono !text-[10px] mb-1 block">Your assessment</span>
          <textarea className="input w-full" rows={2} value={q.assessmentNotes || ""} onChange={(e) => set("assessmentNotes", e.target.value)} placeholder="What makes this source trustworthy — or not — for your purposes?" />
        </label>
      </div>
    </div>
  );
}

function ExcerptsPanel({ source, excerpts, onChanged }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ quote: "", location: "", page: "", section: "", notes: "", tags: [] });
  const [err, setErr] = useState("");

  const save = async () => {
    if (!draft.quote.trim()) { setErr("Paste the quoted text — quotes are never altered by Fracture."); return; }
    setErr("");
    await createItem("excerpts", newExcerpt({ ...draft, sourceId: source.id }));
    setDraft({ quote: "", location: "", page: "", section: "", notes: "", tags: [] });
    setOpen(false);
    onChanged();
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="label-mono">Excerpts & highlights</span>
        <button onClick={() => setOpen(!open)} className="btn-ghost !py-1.5 !px-3 text-xs"><Plus size={12} /> Add excerpt</button>
      </div>

      {open && (
        <div className="space-y-2 mb-3 border border-zinc-200 dark:border-zinc-800 rounded-sm p-3">
          <textarea autoFocus className="input w-full" rows={3} value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} placeholder="The exact quoted passage — keep it verbatim." />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="Page" value={draft.page} onChange={(e) => setDraft({ ...draft, page: e.target.value })} />
            <input className="input" placeholder="Section" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} />
            <input className="input" placeholder="Location / ¶" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          </div>
          <input className="input w-full" placeholder="Your notes on this passage" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
          {err && <ErrorNote msg={err} />}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost !py-1.5 !px-3 text-xs">Cancel</button>
            <button onClick={save} className="btn-solid !py-1.5 !px-3 text-xs">Save excerpt</button>
          </div>
        </div>
      )}

      {excerpts.length === 0 && !open ? (
        <p className="faint text-xs">No excerpts yet. Highlight the passages that matter — direct quotations stay verbatim, and your notes stay clearly separate.</p>
      ) : (
        <ul className="space-y-2">
          {excerpts.map((x) => (
            <li key={x.id} className="rounded-sm border border-zinc-200 dark:border-zinc-800 p-3">
              <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 text-sm leading-relaxed">“{x.quote}”</blockquote>
              {(x.page || x.section || x.location) && (
                <p className="faint text-[11px] font-mono mt-1">{[x.page && `p. ${x.page}`, x.section && `§ ${x.section}`, x.location].filter(Boolean).join(" · ")}</p>
              )}
              {x.notes && <p className="muted text-xs mt-1">{x.notes}</p>}
              {(x.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{x.tags.map((t) => <span key={t} className="pill !text-[10px]">{t}</span>)}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvidenceFromSource({ source, evidence, blocks, cases, onChanged }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ label: "", evidenceType: "statistic", claim: "", text: "", explanation: "", notes: "", tags: [], blockIds: [], caseIds: [] });
  const [err, setErr] = useState("");

  const save = async () => {
    if (!draft.text.trim()) { setErr("Paste the evidence excerpt."); return; }
    setErr("");
    await createItem("evidence", {
      label: draft.label, evidenceType: draft.evidenceType, claim: draft.claim, text: draft.text,
      explanation: draft.explanation, notes: draft.notes, tags: draft.tags,
      blockIds: draft.blockIds, caseIds: draft.caseIds,
      sourceId: source.id, source: formatCitation(source, "debate"), url: source.url || "",
      topicIds: source.topicIds || [], favorite: false
    });
    setDraft({ label: "", evidenceType: "statistic", claim: "", text: "", explanation: "", notes: "", tags: [], blockIds: [], caseIds: [] });
    setOpen(false);
    onChanged();
  };

  const usage = (e) => argumentsForEvidence(e, blocks, cases);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="label-mono">Evidence from this source ({evidence.length})</span>
        <button onClick={() => setOpen(!open)} className="btn-solid !py-1.5 !px-3 text-xs"><Plus size={12} /> New evidence card</button>
      </div>

      {open && (
        <div className="space-y-2 mb-3 border border-zinc-200 dark:border-zinc-800 rounded-sm p-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="input" placeholder="Tag / short label — e.g. “Sleep–grades link”" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            <select className="input" value={draft.evidenceType} onChange={(e) => setDraft({ ...draft, evidenceType: e.target.value })}>
              {EVIDENCE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <input className="input w-full" placeholder="Claim this evidence supports" value={draft.claim} onChange={(e) => setDraft({ ...draft, claim: e.target.value })} />
          <textarea autoFocus className="input w-full" rows={3} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} placeholder="The evidence excerpt — verbatim quote from the source." />
          <textarea className="input w-full" rows={2} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} placeholder="What does this card prove, and why does it matter?" />
          <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono faint">Link to arguments:</span>
            <select className="input !w-auto" value="" onChange={(e) => e.target.value && setDraft({ ...draft, blockIds: [...draft.blockIds, e.target.value] })}>
              <option value="">+ block…</option>
              {blocks.filter((b) => !draft.blockIds.includes(b.id)).map((b) => <option key={b.id} value={b.id}>{b.tag || b.myResponse?.slice(0, 40)}</option>)}
            </select>
            <select className="input !w-auto" value="" onChange={(e) => e.target.value && setDraft({ ...draft, caseIds: [...draft.caseIds, e.target.value] })}>
              <option value="">+ case…</option>
              {cases.filter((c) => !draft.caseIds.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.title || "Case"}</option>)}
            </select>
          </div>
          {(draft.blockIds.length > 0 || draft.caseIds.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {draft.blockIds.map((bid) => {
                const b = blocks.find((x) => x.id === bid);
                return <span key={bid} className="pill inline-flex items-center gap-1">{b?.tag || "Block"}<button onClick={() => setDraft({ ...draft, blockIds: draft.blockIds.filter((x) => x !== bid) })} className="faint"><Trash2 size={9} /></button></span>;
              })}
              {draft.caseIds.map((cid) => {
                const c = cases.find((x) => x.id === cid);
                return <span key={cid} className="pill inline-flex items-center gap-1">{c?.title || "Case"}<button onClick={() => setDraft({ ...draft, caseIds: draft.caseIds.filter((x) => x !== cid) })} className="faint"><Trash2 size={9} /></button></span>;
              })}
            </div>
          )}
          {err && <ErrorNote msg={err} />}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost !py-1.5 !px-3 text-xs">Cancel</button>
            <button onClick={save} className="btn-solid !py-1.5 !px-3 text-xs">Create card</button>
          </div>
        </div>
      )}

      {evidence.length === 0 && !open ? (
        <p className="faint text-xs">No evidence cards from this source yet. Turn the best passages into reusable cards — the citation carries over automatically.</p>
      ) : (
        <ul className="space-y-2">
          {evidence.map((e) => {
            const u = usage(e);
            return (
              <li key={e.id} className="rounded-sm border border-zinc-200 dark:border-zinc-800 p-3">
                <div className="flex items-center gap-2 mb-1">
                  {e.label && <span className="pill !text-[10px]">{e.label}</span>}
                  {e.evidenceType && <span className="text-[10px] font-mono faint uppercase tracking-wider">{e.evidenceType.replace(/-/g, " ")}</span>}
                </div>
                {e.claim && <p className="font-medium text-xs mb-1">{e.claim}</p>}
                <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-700 pl-2.5 text-xs leading-relaxed muted">“{e.text}”</blockquote>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-mono faint">
                  {u.blocks.map((b) => <Link key={b.id} to="/prep/library" className="text-green-600 dark:text-green-400 inline-flex items-center gap-1"><Link2 size={10} /> {b.tag || "Block"}</Link>)}
                  {u.cases.map(({ case: c }) => <Link key={c.id} to="/prep/cases" className="text-green-600 dark:text-green-400 inline-flex items-center gap-1"><BookOpen size={10} /> {c.title || "Case"}</Link>)}
                  {u.blocks.length + u.cases.length === 0 && <span>not linked to any argument</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
