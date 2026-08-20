import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Loader2, Compass, ChevronDown, ChevronRight } from "lucide-react";
import {
  newStrategy, newStrategyOption, createItem, updateItem, removeItem, timeAgo
} from "../lib/prep.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Modal, Field, SearchBar } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

export default function PrepStrategy() {
  const { items, err, setItems } = useCollection("strategies");
  const cases = useCollection("cases");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null);

  const list = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (items || []).filter((s) => !q || JSON.stringify(s).toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [items, query]);

  async function create() {
    const id = await createItem("strategies", newStrategy({ title: "Untitled strategy" }));
    setEditing({ id });
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Strategy</div>
          <h1 className="font-serif text-4xl md:text-5xl">Choose how you'll win.</h1>
          <p className="muted text-sm mt-2 max-w-xl">Lay out competing approaches for a round — each with benefits, risks, and notes — and decide before the pressure hits. This is structured thinking, not prediction.</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar value={query} onChange={setQuery} placeholder="Search strategies…" />
          <button onClick={create} className="btn-solid !py-2 !px-3 text-xs"><Plus size={13} /> New strategy</button>
        </div>
      </div>

      {err && <ErrorNote msg={err} />}
      {!items && <LoadingBlock />}
      {items && list.length === 0 && (
        <EmptyState icon={Compass} title={items?.length ? "Nothing matches" : "No strategy docs yet"}
          body="Compare approaches like 'collapse on Contention 1' vs 'split coverage' — write the benefits and risks of each, then commit to one."
          action={!items?.length ? <button onClick={create} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> New strategy</button> : null} />
      )}

      <div className="space-y-3">
        {list.map((s) => {
          const open = expanded[s.id];
          const caseTitle = (cases.items || []).find((c) => c.id === s.caseId)?.title;
          return (
            <div key={s.id} className="card p-5">
              <div className="flex items-center gap-2">
                <button onClick={() => setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))} className="faint">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <h3 className="font-serif text-xl">{s.title || "Untitled strategy"}</h3>
                <span className="faint text-xs ml-auto">{timeAgo(s.updatedAt)}{caseTitle && <> · {caseTitle}</>}</span>
                <button onClick={() => setEditing({ id: s.id })} className="text-[11px] faint hover:text-zinc-950 dark:hover:text-zinc-50">edit</button>
                <button onClick={async () => { await removeItem("strategies", s.id); setItems((prev) => (prev || []).filter((x) => x.id !== s.id)); }} className="faint hover:text-red-500"><Trash2 size={13} /></button>
              </div>
              {open && (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  {(s.options || []).map((o, i) => (
                    <div key={o.id} className="rounded-sm border hair p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="label-mono">Option {String.fromCharCode(65 + i)}</span>
                        <span className="font-serif text-lg">{o.name}</span>
                      </div>
                      {o.benefits.length > 0 && (
                        <div className="mb-2"><div className="label-mono mb-1 text-green-600 dark:text-green-400">Benefits</div>
                          <ul className="text-sm muted space-y-0.5">{o.benefits.map((b, j) => <li key={j}>· {b}</li>)}</ul></div>
                      )}
                      {o.risks.length > 0 && (
                        <div><div className="label-mono mb-1 text-red-500">Risks</div>
                          <ul className="text-sm muted space-y-0.5">{o.risks.map((r, j) => <li key={j}>· {r}</li>)}</ul></div>
                      )}
                      {o.notes && <p className="faint text-xs mt-2">{o.notes}</p>}
                    </div>
                  ))}
                  {(s.options || []).length === 0 && <p className="faint text-xs md:col-span-2">No options yet — edit to add approaches.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && <StrategyEditor id={editing.id} onClose={() => setEditing(null)} setItems={setItems} cases={cases} />}
    </div>
  );
}

function StrategyEditor({ id, onClose, setItems, cases }) {
  const { items } = useCollection("strategies");
  const existing = (items || []).find((s) => s.id === id);
  const [form, setForm] = useState(() => existing ? JSON.parse(JSON.stringify(existing)) : newStrategy());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setOpt = (i, patch) => set("options", form.options.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  async function save() {
    if (!form.title.trim()) { setErr("A title is required."); return; }
    setBusy(true); setErr(null);
    try {
      if (existing) {
        await updateItem("strategies", id, form);
        setItems((prev) => (prev || []).map((s) => (s.id === id ? { ...s, ...form } : s)));
      } else {
        const newId = await createItem("strategies", form);
        setItems((prev) => [{ ...form, id: newId }, ...(prev || [])]);
      }
      onClose();
    } catch (e) { setErr(e?.message || "Could not save."); setBusy(false); }
  }

  return (
    <Modal title={existing ? "Edit strategy" : "New strategy"} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><input value={form.title} onChange={(e) => set("title", e.target.value)} className="field !py-2" autoFocus /></Field>
          <Field label="Related case"><select value={form.caseId} onChange={(e) => set("caseId", e.target.value)} className="field !py-2">
            <option value="">None</option>
            {(cases.items || []).map((c) => <option key={c.id} value={c.id}>{c.title || "Untitled"}</option>)}
          </select></Field>
        </div>

        {(form.options || []).map((o, i) => (
          <div key={o.id} className="rounded-sm border hair p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-mono">Option {String.fromCharCode(65 + i)}</span>
              <button onClick={() => set("options", form.options.filter((_, j) => j !== i))} className="faint hover:text-red-500"><Trash2 size={13} /></button>
            </div>
            <input value={o.name} onChange={(e) => setOpt(i, { name: e.target.value })} className="field !py-1.5 text-sm" placeholder="e.g. Collapse on Contention 1" />
            <LineList label="Benefits" items={o.benefits} onChange={(benefits) => setOpt(i, { benefits })} tone="green" />
            <LineList label="Risks" items={o.risks} onChange={(risks) => setOpt(i, { risks })} tone="red" />
            <Field label="Notes"><input value={o.notes} onChange={(e) => setOpt(i, { notes: e.target.value })} className="field !py-1.5 text-xs" /></Field>
          </div>
        ))}
        <button onClick={() => set("options", [...(form.options || []), newStrategyOption(`Option ${String.fromCharCode(65 + (form.options?.length || 0))}`)])} className="btn-ghost w-full !py-2 text-xs"><Plus size={13} /> Add option</button>

        {err && <p className="text-red-500 text-sm">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-solid py-2 px-4 text-xs">{busy ? "Saving…" : "Save strategy"}</button>
        </div>
      </div>
    </Modal>
  );
}

function LineList({ label, items, onChange, tone }) {
  const [draft, setDraft] = useState("");
  function add() {
    if (!draft.trim()) return;
    onChange([...(items || []), draft.trim()]);
    setDraft("");
  }
  return (
    <div>
      <div className={cx("label-mono mb-1", tone === "green" ? "text-green-600 dark:text-green-400" : "text-red-500")}>{label}</div>
      <div className="flex gap-2 mb-1">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="field !py-1 text-xs flex-1" placeholder="Add a line…" />
        <button onClick={add} className="btn-solid !py-1 !px-2.5 text-xs"><Plus size={11} /></button>
      </div>
      {(items || []).map((item, i) => (
        <div key={i} className="flex items-center justify-between text-xs muted py-0.5">
          <span>· {item}</span>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="faint hover:text-red-500 ml-2"><Trash2 size={11} /></button>
        </div>
      ))}
    </div>
  );
}
