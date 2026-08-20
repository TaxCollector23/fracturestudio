import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus, Star, ExternalLink, Copy, Loader2, Link2, Search, Quote, MessagesSquare,
  HelpCircle, ChevronDown, ChevronRight, Trash2, FolderOpen
} from "lucide-react";
import {
  newEvidence, newBlock, newResponseTree, newBranch, newCrossfireQuestion,
  createItem, updateItem, removeItem, filterByQuery, timeAgo,
  evidenceUsedInCase, relatedByTag
} from "../lib/prep.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Modal, Field, TagEditor, SearchBar, Tabs, Pill } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

const TABS = [
  { id: "evidence", label: "Evidence" },
  { id: "blocks", label: "Blocks" },
  { id: "responses", label: "Response trees" },
  { id: "crossfire", label: "Cross-ex questions" }
];

export default function PrepLibrary() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const t = params.get("tab");
    return TABS.some((x) => x.id === t) ? t : "evidence";
  });
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const evidence = useCollection("evidence");
  const blocks = useCollection("blocks");
  const responses = useCollection("responses");
  const crossfire = useCollection("crossfire");
  const cases = useCollection("cases");

  const collections = { evidence, blocks, responses, crossfire };
  const allErr = [evidence, blocks, responses, crossfire, cases].find((c) => c.err)?.err;
  const loading = [evidence, blocks, responses, crossfire].some((c) => !c.items);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Argument Library</div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <h1 className="font-serif text-4xl md:text-5xl">Your reusable knowledge base.</h1>
        <div className="flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} placeholder={`Search ${tab}…`} />
          <button onClick={() => setFavoritesOnly((v) => !v)}
            className={cx("btn-ghost !py-2 !px-3 text-xs", favoritesOnly && "border-amber-500/50 text-amber-600 dark:text-amber-400")}>
            <Star size={13} className={favoritesOnly ? "fill-amber-500 text-amber-500" : ""} /> Favorites
          </button>
        </div>
      </div>

      <Tabs tabs={TABS.map((t) => ({ ...t, count: collections[t.id].items?.length }))} active={tab} onChange={setTab} />

      {allErr && <ErrorNote msg={allErr} />}
      {loading && <LoadingBlock />}
      {!loading && tab === "evidence" && <EvidenceTab {...{ collection: evidence, cases, query, favoritesOnly }} />}
      {!loading && tab === "blocks" && <BlocksTab {...{ collection: blocks, cases, query, favoritesOnly }} />}
      {!loading && tab === "responses" && <ResponsesTab collection={responses} query={query} />}
      {!loading && tab === "crossfire" && <CrossfireTab collection={crossfire} query={query} favoritesOnly={favoritesOnly} />}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Shared bits
──────────────────────────────────────────────────────────────────────────── */

function FavoriteBtn({ item, col, setItems }) {
  return (
    <button onClick={async () => {
      const next = !item.favorite;
      await updateItem(col, item.id, { favorite: next }).catch(() => {});
      setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, favorite: next } : i)));
    }} className="faint hover:text-amber-500" title={item.favorite ? "Unfavorite" : "Favorite"}>
      <Star size={14} className={item.favorite ? "fill-amber-500 text-amber-500" : ""} />
    </button>
  );
}

function DeleteBtn({ col, item, setItems }) {
  return (
    <button onClick={async () => {
      await removeItem(col, item.id).catch(() => {});
      setItems((prev) => (prev || []).filter((i) => i.id !== item.id));
    }} className="faint hover:text-red-500" title="Delete"><Trash2 size={13} /></button>
  );
}

function UsageRow({ cases, caseIds }) {
  const used = (caseIds || []).filter((id) => (cases?.items || []).some((c) => c.id === id));
  if (!used.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] faint">
      <FolderOpen size={11} />
      <span>Used in:</span>
      {used.slice(0, 4).map((id) => {
        const c = (cases?.items || []).find((x) => x.id === id);
        return <Link key={id} to={`/prep/cases?id=${id}`} className="underline hover:text-zinc-950 dark:hover:text-zinc-50">{c?.title || "case"}</Link>;
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Evidence
──────────────────────────────────────────────────────────────────────────── */

function EvidenceTab({ collection, cases, query, favoritesOnly }) {
  const { items, setItems } = collection;
  const [editing, setEditing] = useState(null); // null | {item?} 
  const list = useMemo(() => {
    let out = filterByQuery(items, query);
    if (favoritesOnly) out = out.filter((e) => e.favorite);
    return out.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [items, query, favoritesOnly]);

  return (
    <>
      {list.length === 0 && (
        <EmptyState icon={Quote} title={items?.length ? "Nothing matches" : "No evidence yet"}
          body="Capture quotes, findings, and sources here, tag them by topic, and link them into cases. Evidence that isn't linked shows up as 'unused' in the case health check."
          action={!items?.length ? <CreateBtn label="Add evidence" onClick={() => setEditing({ item: null })} /> : null} />
      )}
      <div className="space-y-3">
        {list.map((e) => {
          const usedIn = evidenceUsedInCase(e.id, cases?.items || []);
          const related = relatedByTag(e, items || [], 3);
          return (
            <div key={e.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">“{e.text}”</p>
                  <p className="faint text-xs mt-1.5">{e.source}{e.url && <> · </>}
                    {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1"><ExternalLink size={10} /> source</a>}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {e.topic && <Pill>{e.topic}</Pill>}
                    {(e.tags || []).map((t) => <Pill key={t}>#{t}</Pill>)}
                    <span className="faint text-xs ml-auto">{timeAgo(e.updatedAt)}</span>
                  </div>
                  {e.note && <p className="faint text-xs mt-2">{e.note}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <UsageRow cases={cases} caseIds={e.caseIds} />
                    {related.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] faint">
                        <Link2 size={11} /> Related:
                        {related.map((r) => <span key={r.id} className="truncate max-w-[140px]">{r.source || r.text?.slice(0, 20)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <FavoriteBtn item={e} col="evidence" setItems={setItems} />
                  <button onClick={() => setEditing({ item: e })} className="faint hover:text-zinc-950 dark:hover:text-zinc-50 text-[11px]">edit</button>
                  <DeleteBtn col="evidence" item={e} setItems={setItems} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {list.length > 0 && <div className="mt-4"><CreateBtn label="Add evidence" onClick={() => setEditing({ item: null })} /></div>}
      {editing && <EvidenceEditor item={editing.item} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} setItems={setItems} cases={cases} />}
    </>
  );
}

function EvidenceEditor({ item, onClose, onSaved, setItems, cases }) {
  const [form, setForm] = useState(() => item || newEvidence());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    if (!form.text.trim()) { setErr("Quote or finding text is required."); return; }
    setBusy(true); setErr(null);
    try {
      if (item) {
        await updateItem("evidence", item.id, form);
        setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, ...form } : i)));
      } else {
        const id = await createItem("evidence", form);
        setItems((prev) => [{ ...form, id }, ...(prev || [])]);
      }
      onSaved();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  return (
    <Modal title={item ? "Edit evidence" : "Add evidence"} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Quote / finding"><textarea value={form.text} onChange={(e) => set("text", e.target.value)} className="field text-sm" rows={3} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source"><input value={form.source} onChange={(e) => set("source", e.target.value)} className="field !py-2" placeholder="Author, title, year" /></Field>
          <Field label="URL"><input value={form.url} onChange={(e) => set("url", e.target.value)} className="field !py-2" placeholder="https://…" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Topic"><input value={form.topic} onChange={(e) => set("topic", e.target.value)} className="field !py-2" placeholder="e.g. sleep" /></Field>
          <Field label="Attach to case"><select value={form.caseIds?.[0] || ""} onChange={(e) => set("caseIds", e.target.value ? [e.target.value] : [])} className="field !py-2">
            <option value="">None</option>
            {(cases?.items || []).map((c) => <option key={c.id} value={c.id}>{c.title || "Untitled"}</option>)}
          </select></Field>
        </div>
        <Field label="Tags"><TagEditor tags={form.tags || []} onChange={(tags) => set("tags", tags)} /></Field>
        <Field label="Note"><input value={form.note} onChange={(e) => set("note", e.target.value)} className="field !py-2" placeholder="Why this matters" /></Field>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Blocks
──────────────────────────────────────────────────────────────────────────── */

const BLOCK_CATEGORIES = ["No link", "Link turn", "Impact turn", "Non-unique", "Evidence response", "Framework response"];

function BlocksTab({ collection, cases, query, favoritesOnly }) {
  const { items, setItems } = collection;
  const [editing, setEditing] = useState(null);
  const list = useMemo(() => {
    let out = filterByQuery(items, query);
    if (favoritesOnly) out = out.filter((b) => b.favorite);
    return out.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [items, query, favoritesOnly]);

  return (
    <>
      {list.length === 0 && (
        <EmptyState icon={MessagesSquare} title={items?.length ? "Nothing matches" : "No blocks yet"}
          body="A block is a reusable answer: their argument, your response, the explanation, evidence, and impact. Tag it, categorize it, and reuse it across every case."
          action={!items?.length ? <CreateBtn label="Create a block" onClick={() => setEditing({ item: null })} /> : null} />
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {list.map((b) => (
          <div key={b.id} className="card p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              {b.category && <Pill tone="amber">{b.category}</Pill>}
              <span className="font-serif text-lg truncate">{b.tag || "Untitled block"}</span>
              <div className="ml-auto flex items-center gap-2">
                <FavoriteBtn item={b} col="blocks" setItems={setItems} />
                <button onClick={() => setEditing({ item: b })} className="faint hover:text-zinc-950 dark:hover:text-zinc-50 text-[11px]">edit</button>
                <button onClick={async () => {
                  const id = await createItem("blocks", { ...b, id: undefined, tag: b.tag + " (copy)", createdAt: undefined, updatedAt: undefined });
                  setItems((prev) => [{ ...b, id, tag: b.tag + " (copy)" }, ...(prev || [])]);
                }} className="faint hover:text-zinc-950 dark:hover:text-zinc-50" title="Duplicate"><Copy size={13} /></button>
                <DeleteBtn col="blocks" item={b} setItems={setItems} />
              </div>
            </div>
            <div className="space-y-1.5 text-sm flex-1">
              <p><span className="label-mono">They:</span> <span className="muted">{b.theirArgument}</span></p>
              <p><span className="label-mono">You:</span> <span className="muted">{b.myResponse}</span></p>
              {b.explanation && <p className="faint text-xs leading-relaxed">{b.explanation}</p>}
              {b.evidence && <p className="faint text-xs italic">“{b.evidence}”</p>}
              {b.impact && <p className="faint text-xs">Impact: {b.impact}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t hair">
              {b.topic && <Pill>{b.topic}</Pill>}
              {(b.tags || []).map((t) => <Pill key={t}>#{t}</Pill>)}
              <div className="ml-auto"><UsageRow cases={cases} caseIds={b.caseIds} /></div>
            </div>
          </div>
        ))}
      </div>
      {list.length > 0 && <div className="mt-4"><CreateBtn label="Create a block" onClick={() => setEditing({ item: null })} /></div>}
      {editing && <BlockEditor item={editing.item} onClose={() => setEditing(null)} setItems={setItems} cases={cases} />}
    </>
  );
}

function BlockEditor({ item, onClose, setItems, cases }) {
  const [form, setForm] = useState(() => item || newBlock());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.tag.trim() && !form.myResponse.trim()) { setErr("Give the block a tag or a response."); return; }
    setBusy(true); setErr(null);
    try {
      if (item) {
        await updateItem("blocks", item.id, form);
        setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, ...form } : i)));
      } else {
        const id = await createItem("blocks", form);
        setItems((prev) => [{ ...form, id }, ...(prev || [])]);
      }
      onClose();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  return (
    <Modal title={item ? "Edit block" : "New block"} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tag"><input value={form.tag} onChange={(e) => set("tag", e.target.value)} className="field !py-2" placeholder="e.g. No link — health evidence" autoFocus /></Field>
          <Field label="Category"><select value={form.category} onChange={(e) => set("category", e.target.value)} className="field !py-2">
            <option value="">Custom…</option>
            {BLOCK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></Field>
        </div>
        <Field label="Their argument"><textarea value={form.theirArgument} onChange={(e) => set("theirArgument", e.target.value)} className="field text-sm" rows={2} /></Field>
        <Field label="My response"><textarea value={form.myResponse} onChange={(e) => set("myResponse", e.target.value)} className="field text-sm" rows={2} /></Field>
        <Field label="Explanation"><textarea value={form.explanation} onChange={(e) => set("explanation", e.target.value)} className="field text-sm" rows={2} /></Field>
        <Field label="Evidence"><textarea value={form.evidence} onChange={(e) => set("evidence", e.target.value)} className="field text-sm" rows={2} /></Field>
        <Field label="Impact"><input value={form.impact} onChange={(e) => set("impact", e.target.value)} className="field !py-2" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Topic"><input value={form.topic} onChange={(e) => set("topic", e.target.value)} className="field !py-2" /></Field>
          <Field label="Attach to case"><select value={form.caseIds?.[0] || ""} onChange={(e) => set("caseIds", e.target.value ? [e.target.value] : [])} className="field !py-2">
            <option value="">None</option>
            {(cases?.items || []).map((c) => <option key={c.id} value={c.id}>{c.title || "Untitled"}</option>)}
          </select></Field>
        </div>
        <Field label="Tags"><TagEditor tags={form.tags || []} onChange={(tags) => set("tags", tags)} /></Field>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save block"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Response trees ("if they say X, say Y")
──────────────────────────────────────────────────────────────────────────── */

function ResponsesTab({ collection, query }) {
  const { items, setItems } = collection;
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null);
  const list = useMemo(() => filterByQuery(items, query), [items, query]);

  return (
    <>
      {list.length === 0 && (
        <EmptyState icon={MessagesSquare} title={items?.length ? "Nothing matches" : "No response trees yet"}
          body="Build reusable 'if they say X, say Y' trees: a trigger, then multiple response branches with explanation, evidence, warrant, and impact. Save them once, reuse them across topics and cases."
          action={!items?.length ? <CreateBtn label="New response tree" onClick={() => setEditing({ item: null })} /> : null} />
      )}
      <div className="space-y-3">
        {list.map((t) => (
          <div key={t.id} className="card p-4">
            <button onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))} className="w-full flex items-center gap-2 text-left">
              {expanded[t.id] ? <ChevronDown size={15} className="faint" /> : <ChevronRight size={15} className="faint" />}
              <span className="font-serif text-lg">They say: “{t.trigger || "Untitled"}”</span>
              <span className="faint text-xs ml-auto">{t.branches?.length || 0} responses</span>
            </button>
            <div className="flex items-center gap-1.5 mt-2">
              {t.topic && <Pill>{t.topic}</Pill>}
              {(t.tags || []).map((x) => <Pill key={x}>#{x}</Pill>)}
              <button onClick={() => setEditing({ item: t })} className="text-[11px] faint hover:text-zinc-950 dark:hover:text-zinc-50 ml-auto">edit</button>
              <DeleteBtn col="responses" item={t} setItems={setItems} />
            </div>
            {expanded[t.id] && (
              <div className="mt-3 space-y-2">
                {(t.branches || []).map((b) => (
                  <div key={b.id} className="rounded-sm border hair p-3">
                    <div className="flex items-center gap-2">
                      <span className="label-mono">Option {String.fromCharCode(65 + t.branches.indexOf(b))}</span>
                      <span className="text-sm font-medium">{b.label || "Response"}</span>
                    </div>
                    {b.explanation && <p className="muted text-sm mt-1 leading-relaxed">{b.explanation}</p>}
                    {(b.evidence || b.warrant || b.impact) && (
                      <div className="text-xs faint mt-1.5 space-y-0.5">
                        {b.warrant && <p><span className="label-mono">Warrant:</span> {b.warrant}</p>}
                        {b.evidence && <p><span className="label-mono">Evidence:</span> {b.evidence}</p>}
                        {b.impact && <p><span className="label-mono">Impact:</span> {b.impact}</p>}
                      </div>
                    )}
                    {b.notes && <p className="faint text-xs mt-1">{b.notes}</p>}
                  </div>
                ))}
                {(t.branches || []).length === 0 && <p className="faint text-xs">No branches yet — edit to add response options.</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      {list.length > 0 && <div className="mt-4"><CreateBtn label="New response tree" onClick={() => setEditing({ item: null })} /></div>}
      {editing && <ResponseTreeEditor item={editing.item} onClose={() => setEditing(null)} setItems={setItems} />}
    </>
  );
}

function ResponseTreeEditor({ item, onClose, setItems }) {
  const [form, setForm] = useState(() => item || newResponseTree());
  const [branchDraft, setBranchDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.trigger.trim()) { setErr("A 'they say' trigger is required."); return; }
    setBusy(true); setErr(null);
    try {
      if (item) {
        await updateItem("responses", item.id, form);
        setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, ...form } : i)));
      } else {
        const id = await createItem("responses", form);
        setItems((prev) => [{ ...form, id }, ...(prev || [])]);
      }
      onClose();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  return (
    <Modal title={item ? "Edit response tree" : "New response tree"} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="They say…"><input value={form.trigger} onChange={(e) => set("trigger", e.target.value)} className="field !py-2" placeholder="e.g. No link" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Topic"><input value={form.topic} onChange={(e) => set("topic", e.target.value)} className="field !py-2" /></Field>
          <Field label="Tags"><TagEditor tags={form.tags || []} onChange={(tags) => set("tags", tags)} /></Field>
        </div>
        <div className="label-mono">Response branches</div>
        {(form.branches || []).map((b, i) => (
          <div key={b.id} className="rounded-sm border hair p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Option {String.fromCharCode(65 + i)} — {b.label || "untitled"}</span>
              <button onClick={() => set("branches", form.branches.filter((x) => x.id !== b.id))} className="faint hover:text-red-500"><Trash2 size={12} /></button>
            </div>
            {b.explanation && <p className="faint text-xs mt-1">{b.explanation}</p>}
          </div>
        ))}
        {branchDraft ? (
          <BranchForm draft={branchDraft}
            onChange={(next) => setBranchDraft(next)}
            onAdd={() => { set("branches", [...(form.branches || []), branchDraft]); setBranchDraft(null); }}
            onCancel={() => setBranchDraft(null)} />
        ) : (
          <button onClick={() => setBranchDraft(newBranch({ label: `Option ${String.fromCharCode(65 + (form.branches?.length || 0))}` }))} className="btn-ghost !py-2 text-xs w-full"><Plus size={13} /> Add response branch</button>
        )}
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save tree"}</button>
        </div>
      </div>
    </Modal>
  );
}

function BranchForm({ draft, onChange, onAdd, onCancel }) {
  const set = (k, v) => onChange({ ...draft, [k]: v });
  return (
    <div className="rounded-sm border hair p-3 space-y-2">
      <Field label="Label"><input value={draft.label} onChange={(e) => set("label", e.target.value)} className="field !py-1.5 text-xs" placeholder="e.g. Extend evidence" /></Field>
      <Field label="Explanation"><textarea value={draft.explanation} onChange={(e) => set("explanation", e.target.value)} className="field !py-1.5 text-xs" rows={2} /></Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Warrant"><input value={draft.warrant} onChange={(e) => set("warrant", e.target.value)} className="field !py-1.5 text-xs" /></Field>
        <Field label="Evidence"><input value={draft.evidence} onChange={(e) => set("evidence", e.target.value)} className="field !py-1.5 text-xs" /></Field>
        <Field label="Impact"><input value={draft.impact} onChange={(e) => set("impact", e.target.value)} className="field !py-1.5 text-xs" /></Field>
      </div>
      <div className="flex gap-2">
        <button onClick={onAdd} className="btn-solid !py-1 !px-3 text-xs">Add branch</button>
        <button onClick={onCancel} className="btn-ghost !py-1 !px-3 text-xs">Cancel</button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Cross-ex questions
──────────────────────────────────────────────────────────────────────────── */

const CROSS_CATS = ["Clarification", "Evidence challenge", "Warrant attack", "Impact comparison", "Contradiction", "Trap question", "Framework"];

function CrossfireTab({ collection, query, favoritesOnly }) {
  const { items, setItems } = collection;
  const [editing, setEditing] = useState(null);
  const [cat, setCat] = useState("");
  const list = useMemo(() => {
    let out = filterByQuery(items, query);
    if (favoritesOnly) out = out.filter((q) => q.favorite);
    if (cat) out = out.filter((q) => q.category === cat);
    return out;
  }, [items, query, favoritesOnly, cat]);

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Pill onClick={() => setCat("")} tone={!cat ? "blue" : ""}>All</Pill>
        {CROSS_CATS.map((c) => <Pill key={c} onClick={() => setCat(c)} tone={cat === c ? "blue" : ""}>{c}</Pill>)}
      </div>
      {list.length === 0 && (
        <EmptyState icon={HelpCircle} title={items?.length ? "Nothing matches" : "No questions saved"}
          body="Build a searchable bank of cross-examination questions by category, event, and topic — then favorite the ones that work and practice with question sets."
          action={!items?.length ? <CreateBtn label="Save a question" onClick={() => setEditing({ item: null })} /> : null} />
      )}
      <div className="space-y-2">
        {list.map((q) => (
          <div key={q.id} className="card p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed">“{q.question}”</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Pill tone="amber">{q.category}</Pill>
                {q.event && <Pill>{q.event}</Pill>}
                {q.topic && <Pill>{q.topic}</Pill>}
                {(q.tags || []).map((t) => <Pill key={t}>#{t}</Pill>)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <FavoriteBtn item={q} col="crossfire" setItems={setItems} />
              <button onClick={() => setEditing({ item: q })} className="faint hover:text-zinc-950 dark:hover:text-zinc-50 text-[11px]">edit</button>
              <DeleteBtn col="crossfire" item={q} setItems={setItems} />
            </div>
          </div>
        ))}
      </div>
      {list.length > 0 && <div className="mt-4"><CreateBtn label="Save a question" onClick={() => setEditing({ item: null })} /></div>}
      {editing && <CrossfireEditor item={editing.item} onClose={() => setEditing(null)} setItems={setItems} />}
    </>
  );
}

function CrossfireEditor({ item, onClose, setItems }) {
  const [form, setForm] = useState(() => item || newCrossfireQuestion());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.question.trim()) { setErr("A question is required."); return; }
    setBusy(true); setErr(null);
    try {
      if (item) {
        await updateItem("crossfire", item.id, form);
        setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, ...form } : i)));
      } else {
        const id = await createItem("crossfire", form);
        setItems((prev) => [{ ...form, id }, ...(prev || [])]);
      }
      onClose();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  return (
    <Modal title={item ? "Edit question" : "Save a cross-ex question"} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Question"><textarea value={form.question} onChange={(e) => set("question", e.target.value)} className="field text-sm" rows={2} autoFocus /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Category"><select value={form.category} onChange={(e) => set("category", e.target.value)} className="field !py-2">
            {CROSS_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></Field>
          <Field label="Event"><input value={form.event} onChange={(e) => set("event", e.target.value)} className="field !py-2" placeholder="LD / PF…" /></Field>
          <Field label="Topic"><input value={form.topic} onChange={(e) => set("topic", e.target.value)} className="field !py-2" /></Field>
        </div>
        <Field label="Tags"><TagEditor tags={form.tags || []} onChange={(tags) => set("tags", tags)} /></Field>
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save question"}</button>
        </div>
      </div>
    </Modal>
  );
}

function CreateBtn({ label, onClick }) {
  return <button onClick={onClick} className="btn-solid !py-2 !px-4 text-sm"><Plus size={14} /> {label}</button>;
}
