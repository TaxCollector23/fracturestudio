import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Inbox, Plus, ExternalLink, Trash2, Archive, ArrowRight, Loader2,
  Quote, Lightbulb, Link2, HelpCircle, FileText, MessageSquare
} from "lucide-react";
import {
  newInboxItem, newEvidence, newBlock, newResponseTree, newTopic,
  createItem, updateItem, removeItem, filterByQuery, timeAgo
} from "../lib/prep.js";
import { newSource } from "../lib/research.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Modal, Field, Pill } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

const KINDS = [
  { id: "note", label: "Note", icon: FileText },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "source", label: "Source", icon: Link2 },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "argument", label: "Argument", icon: MessageSquare },
  { id: "question", label: "Question", icon: HelpCircle }
];

const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[0];

const MOVE_TARGETS = [
  { id: "evidence", label: "Evidence card", hint: "Becomes a searchable quote with source" },
  { id: "source", label: "Source record", hint: "Becomes a library source you can cite" },
  { id: "block", label: "Block", hint: "Becomes a reusable answer with a tag" },
  { id: "tree", label: "Response tree", hint: "Becomes an 'if they say X, say Y' trigger" },
  { id: "topic", label: "Knowledge topic", hint: "Adds to a topic's notes" }
];

export default function PrepInbox() {
  const { items, err, setItems } = useCollection("inbox");
  const cases = useCollection("cases");
  const [status, setStatus] = useState("unprocessed");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("note");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null); // { item, target }

  const list = useMemo(() => {
    let out = filterByQuery(items || [], query).filter((i) => i.status === status);
    return out.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [items, query, status]);

  const counts = useMemo(() => {
    const c = { unprocessed: 0, organized: 0, archived: 0 };
    for (const i of items || []) c[i.status] = (c[i.status] || 0) + 1;
    return c;
  }, [items]);

  async function capture() {
    if (!content.trim() || capturing) return;
    setCapturing(true);
    try {
      const id = await createItem("inbox", newInboxItem({ kind, content: content.trim(), url: url.trim() }));
      setItems((prev) => [{ id, kind, content: content.trim(), url: url.trim(), status: "unprocessed" }, ...(prev || [])]);
      setContent(""); setUrl(""); setKind("note");
    } finally { setCapturing(false); }
  }

  async function setStatusOf(item, next) {
    await updateItem("inbox", item.id, { status: next }).catch(() => {});
    setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, status: next } : i)));
  }

  async function move(item, target) {
    const contentText = item.content;
    const url = item.url || "";
    let createdId = null;
    let label = target;
    try {
      if (target === "evidence") {
        createdId = await createItem("evidence", newEvidence({ text: contentText, url, source: "", note: `From inbox${url ? " · " + url : ""}` }));
        label = "Evidence card";
      } else if (target === "source") {
        createdId = await createItem("sources", newSource({ title: contentText.slice(0, 80), url, description: item.kind === "source" ? "From research inbox" : "" }));
        label = "Source record";
      } else if (target === "block") {
        createdId = await createItem("blocks", newBlock({ tag: contentText.slice(0, 40), theirArgument: "", myResponse: contentText, explanation: "" }));
        label = "Block";
      } else if (target === "tree") {
        createdId = await createItem("responses", newResponseTree({ trigger: contentText, branches: [] }));
        label = "Response tree";
      } else if (target === "topic") {
        createdId = await createItem("topics", newTopic({ name: contentText.slice(0, 60), notes: contentText }));
        label = "Topic";
      }
      await updateItem("inbox", item.id, { status: "organized", movedTo: { kind: target, id: createdId, label } });
    } catch (e) { return; }
    setItems((prev) => (prev || []).map((i) => (i.id === item.id ? { ...i, status: "organized", movedTo: { kind: target, id: createdId, label } } : i)));
    setMoveTarget(null);
  }

  const statusTabs = [
    { id: "unprocessed", label: `Inbox (${counts.unprocessed})` },
    { id: "organized", label: `Organized (${counts.organized})` },
    { id: "archived", label: `Archived (${counts.archived})` }
  ];

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Research Inbox</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-2">Capture fast. Organize later.</h1>
      <p className="muted text-sm mb-6 max-w-xl">Dump quotes, sources, ideas, and questions here mid-research. When you're ready, move items into evidence cards, blocks, response trees, or topics — the inbox keeps the trail.</p>

      {err && <ErrorNote msg={err} />}

      {/* Quick capture */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-start gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="field !w-auto !py-2 text-xs">
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={(e) => e.key === "Enter" && capture()}
            placeholder="Paste a quote, note, idea, link…" className="field flex-1 !py-2 text-sm" />
          <button onClick={capture} disabled={capturing || !content.trim()} className="btn-solid !py-2 !px-4 text-xs">
            {capturing ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Capture
          </button>
        </div>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Optional source URL" className="field !py-1.5 text-xs mt-2" />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 border-b hair pb-3 mb-4">
        {statusTabs.map((t) => (
          <button key={t.id} onClick={() => setStatus(t.id)}
            className={cx("px-3 py-1.5 rounded-sm text-sm transition-colors", status === t.id ? "bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950" : "text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50")}>
            {t.label}
          </button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="field !py-1.5 text-xs ml-auto max-w-[180px]" />
      </div>

      {!items && <LoadingBlock />}
      {items && list.length === 0 && (
        <EmptyState icon={Inbox} title={status === "unprocessed" ? "Inbox is clear" : status === "organized" ? "Nothing organized yet" : "Nothing archived"}
          body={status === "unprocessed"
            ? "This is the fast-capture tray — drop anything research-shaped here while you're in flow, then organize it in one pass."
            : "Items you've moved into the library appear here, so you always know where your research went."} />
      )}

      <div className="space-y-2">
        {list.map((item) => {
          const K = kindOf(item.kind);
          return (
            <div key={item.id} className="card p-4 flex items-start gap-3">
              <K.icon size={16} className="faint shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs faint">
                  <span className="font-mono uppercase">{item.kind}</span>
                  <span>{timeAgo(item.createdAt)}</span>
                  {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1"><ExternalLink size={10} /> {item.url.slice(0, 40)}</a>}
                  {item.movedTo && <span className="text-green-600 dark:text-green-400">→ {item.movedTo.label}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {status === "unprocessed" && (
                  <button onClick={() => setMoveTarget({ item, target: "" })} className="btn-ghost !py-1.5 !px-3 text-xs">Move…</button>
                )}
                {status !== "archived" && (
                  <button onClick={() => setStatusOf(item, "archived")} className="faint hover:text-zinc-950 dark:hover:text-zinc-50" title="Archive"><Archive size={14} /></button>
                )}
                {status === "archived" && (
                  <button onClick={() => setStatusOf(item, "unprocessed")} className="faint hover:text-zinc-950 dark:hover:text-zinc-50 text-xs">Restore</button>
                )}
                <button onClick={async () => { await removeItem("inbox", item.id); setItems((prev) => (prev || []).filter((i) => i.id !== item.id)); }} className="faint hover:text-red-500" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {moveTarget && (
        <Modal title="Move to…" onClose={() => setMoveTarget(null)}>
          <p className="faint text-xs mb-3 line-clamp-2">“{moveTarget.item.content.slice(0, 90)}”</p>
          <div className="space-y-2">
            {MOVE_TARGETS.map((t) => (
              <button key={t.id} onClick={() => move(moveTarget.item, t.id)}
                className="w-full text-left rounded-sm border hair p-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors flex items-center gap-3">
                <ArrowRight size={14} className="faint shrink-0" />
                <div><div className="text-sm font-medium">{t.label}</div><div className="faint text-xs">{t.hint}</div></div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
