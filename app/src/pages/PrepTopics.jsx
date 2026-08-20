import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronDown, ChevronRight, Trash2, Loader2, BookOpen } from "lucide-react";
import {
  newTopic, createItem, updateItem, removeItem, filterByQuery, relatedByTag
} from "../lib/prep.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Modal, Field, TagEditor, SearchBar, Pill } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

const SECTIONS = [
  { key: "definitions", label: "Definitions" },
  { key: "proArguments", label: "Pro arguments" },
  { key: "conArguments", label: "Con arguments" },
  { key: "strategies", label: "Common strategies" },
  { key: "questions", label: "Questions" }
];

export default function PrepTopics() {
  const { items, err, setItems } = useCollection("topics");
  const evidence = useCollection("evidence");
  const blocks = useCollection("blocks");
  const responses = useCollection("responses");
  const cases = useCollection("cases");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => filterByQuery(items || [], query), [items, query]);

  async function addTopic() {
    setCreating(true);
    try {
      const id = await createItem("topics", newTopic({ name: "Untitled topic" }));
      setEditing({ id });
    } finally { setCreating(false); }
  }

  const relatedFor = (t) => ({
    evidence: relatedByTag(t, evidence.items || [], 3),
    blocks: relatedByTag(t, blocks.items || [], 3),
    responses: relatedByTag(t, responses.items || [], 3),
    cases: relatedByTag(t, cases.items || [], 3)
  });

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Knowledge Base</div>
          <h1 className="font-serif text-4xl md:text-5xl">Topic workspaces.</h1>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} placeholder="Search topics…" />
          <button onClick={addTopic} disabled={creating} className="btn-solid !py-2 !px-3 text-xs">{creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} New topic</button>
        </div>
      </div>

      {err && <ErrorNote msg={err} />}
      {!items && <LoadingBlock />}
      {items && list.length === 0 && (
        <EmptyState icon={BookOpen} title={items.length ? "Nothing matches" : "No topics yet"}
          body="A topic workspace gathers definitions, pro and con arguments, strategies, and questions — and shows the evidence, blocks, and cases you've tagged with the same topic."
          action={!items.length ? <button onClick={addTopic} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> New topic</button> : null} />
      )}

      <div className="space-y-3">
        {list.map((t) => {
          const open = expanded[t.id];
          const rel = open ? relatedFor(t) : null;
          return (
            <div key={t.id} className="card p-5">
              <div className="flex items-center gap-2">
                <button onClick={() => setExpanded((e) => ({ ...e, [t.id]: !e[t.id] }))} className="faint">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <h3 className="font-serif text-xl">{t.name || "Untitled topic"}</h3>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setEditing({ id: t.id })} className="text-[11px] faint hover:text-zinc-950 dark:hover:text-zinc-50">edit</button>
                  <button onClick={async () => { await removeItem("topics", t.id); setItems((prev) => (prev || []).filter((x) => x.id !== t.id)); }} className="faint hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(t.tags || []).map((x) => <Pill key={x}>#{x}</Pill>)}
              </div>

              {open && (
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  {SECTIONS.map((sec) => (
                    <div key={sec.key} className="rounded-sm border hair p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-mono">{sec.label}</span>
                        <button onClick={() => setEditing({ id: t.id, list: sec.key })} className="faint hover:text-zinc-950 dark:hover:text-zinc-50"><Plus size={13} /></button>
                      </div>
                      <ul className="space-y-1">
                        {(t[sec.key] || []).map((item, i) => (
                          <li key={i} className="text-sm muted leading-snug">{item}</li>
                        ))}
                        {(t[sec.key] || []).length === 0 && <li className="faint text-xs">Empty.</li>}
                      </ul>
                    </div>
                  ))}
                  <div className="rounded-sm border hair p-3 md:col-span-2">
                    <div className="label-mono mb-2">Related items</div>
                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      {rel?.evidence.length > 0 && <div><div className="faint mb-1">Evidence</div>{rel.evidence.map((e) => <p key={e.id} className="muted line-clamp-1">“{e.text?.slice(0, 60)}”</p>)}</div>}
                      {rel?.blocks.length > 0 && <div><div className="faint mb-1">Blocks</div>{rel.blocks.map((b) => <p key={b.id} className="muted line-clamp-1">{b.tag || b.myResponse}</p>)}</div>}
                      {rel?.responses.length > 0 && <div><div className="faint mb-1">Response trees</div>{rel.responses.map((r) => <p key={r.id} className="muted line-clamp-1">They say: {r.trigger}</p>)}</div>}
                      {rel?.cases.length > 0 && <div><div className="faint mb-1">Cases</div>{rel.cases.map((c) => <Link key={c.id} to={`/prep/cases?id=${c.id}`} className="block underline muted hover:text-zinc-950 dark:hover:text-zinc-50">{c.title}</Link>)}</div>}
                      {(!rel || ["evidence", "blocks", "responses", "cases"].every((k) => !rel[k].length)) && <p className="faint text-xs">Tag evidence, blocks, and cases with this topic to surface them here.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && <TopicEditor topicId={editing.id} listKey={editing.list} onClose={() => setEditing(null)} setItems={setItems} />}
    </div>
  );
}

function TopicEditor({ topicId, listKey, onClose, setItems }) {
  const { items } = useCollection("topics");
  const topic = (items || []).find((t) => t.id === topicId) || newTopic({ id: topicId });
  const [form, setForm] = useState(() => ({ ...topic }));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim()) { setErr("A topic name is required."); return; }
    setBusy(true); setErr(null);
    try {
      if (topicId && (items || []).some((t) => t.id === topicId)) {
        await updateItem("topics", topicId, form);
        setItems((prev) => (prev || []).map((t) => (t.id === topicId ? { ...t, ...form } : t)));
      } else {
        const id = await createItem("topics", form);
        setItems((prev) => [{ ...form, id }, ...(prev || [])]);
      }
      onClose();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  function addToList() {
    if (!draft.trim()) return;
    set(listKey, [...(form[listKey] || []), draft.trim()]);
    setDraft("");
  }

  return (
    <Modal title={topicId && (items || []).some((t) => t.id === topicId) ? "Edit topic" : "New topic"} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Topic name"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="field !py-2" autoFocus /></Field>
        <Field label="Tags"><TagEditor tags={form.tags || []} onChange={(tags) => set("tags", tags)} /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="field text-sm" rows={2} /></Field>
        {listKey && (
          <div className="rounded-sm border hair p-3">
            <div className="label-mono mb-1.5">{SECTIONS.find((s) => s.key === listKey)?.label}</div>
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addToList()} className="field !py-1.5 text-xs flex-1" />
              <button onClick={addToList} className="btn-solid !py-1.5 !px-3 text-xs">Add</button>
            </div>
            <ul className="mt-2 space-y-1">
              {(form[listKey] || []).map((item, i) => (
                <li key={i} className="flex items-center justify-between text-sm muted">
                  <span className="line-clamp-2">{item}</span>
                  <button onClick={() => set(listKey, (form[listKey] || []).filter((_, j) => j !== i))} className="faint hover:text-red-500 ml-2 shrink-0"><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save topic"}</button>
        </div>
      </div>
    </Modal>
  );
}
