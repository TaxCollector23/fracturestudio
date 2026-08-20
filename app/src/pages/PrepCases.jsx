import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ArrowLeft, Plus, ChevronDown, ChevronRight, Copy, Trash2, ArrowUp, ArrowDown,
  ShieldAlert, Save, History, Link2, Loader2, Swords, FileText, CheckCircle2,
  AlertTriangle, FlaskConical, FolderPlus, MessageSquarePlus
} from "lucide-react";
import {
  newCase, newSection, listItems, createItem, updateItem, removeItem,
  checkCase, filterByQuery, timeAgo, fmtSeconds
} from "../lib/prep.js";
import { streamText } from "../lib/api.js";
import { useCollection, EmptyState, ErrorNote, LoadingBlock, Modal, Field, TagEditor, SearchBar, Pill } from "../components/PrepKit.jsx";
import { cx } from "../lib/ui.js";

export default function PrepCases() {
  const [params, setParams] = useSearchParams();
  const activeId = params.get("id");
  const { items, err, setItems } = useCollection("cases");

  async function createCase() {
    const caze = newCase({ title: "Untitled case" });
    const id = await createItem("cases", caze);
    setItems((prev) => [{ ...caze, id }, ...(prev || [])]);
    setParams({ id }, { replace: true });
  }

  if (activeId) {
    const caze = (items || []).find((c) => c.id === activeId) || null;
    return <CaseEditor
      key={activeId}
      caze={caze}
      loading={!items}
      onBack={() => setParams({}, { replace: true })}
      onChange={(next) => setItems((prev) => (prev || []).map((c) => (c.id === next.id ? next : c)))}
      onDelete={async () => { await removeItem("cases", activeId); setParams({}, { replace: true }); }}
    />;
  }

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-8 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="label-mono mb-2"><Link to="/prep" className="hover:text-zinc-950 dark:hover:text-zinc-50">Prep</Link> / Case Builder</div>
          <h1 className="font-serif text-4xl md:text-5xl">Build the case.</h1>
          <p className="muted mt-3 max-w-xl text-sm">Structured contentions — claim, warrant, evidence, impact — with notes, responses, and a live completeness check.</p>
        </div>
        <button onClick={createCase} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> New case</button>
      </div>

      {err && <ErrorNote msg={err} />}
      {!items && <LoadingBlock />}
      {items && items.length === 0 && (
        <EmptyState icon={ShieldAlert} title="No cases yet"
          body="A case is your organized argument — resolution, thesis, and contentions with claim, warrant, evidence, and impact. The completeness checker tells you what's missing."
          action={<button onClick={createCase} className="btn-solid py-2 px-4 text-sm"><Plus size={14} /> New case</button>} />
      )}

      {items && items.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((c) => {
            const health = checkCase(c, []);
            return (
              <button key={c.id} onClick={() => setParams({ id: c.id }, { replace: true })}
                className="card card-hover p-5 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="pill capitalize">{c.side === "neg" ? "Neg" : "Aff"} {c.event && `· ${c.event}`}</span>
                  <span className={cx("font-mono text-sm", health.score >= 80 ? "text-green-600 dark:text-green-400" : health.score >= 55 ? "text-amber-600 dark:text-amber-400" : "text-red-500")}>
                    {c.sections?.length ? `${health.score}% health` : "empty"}
                  </span>
                </div>
                <h3 className="font-serif text-lg leading-snug mb-1">{c.title || "Untitled case"}</h3>
                {c.resolution && <p className="faint text-xs line-clamp-2 mb-3">{c.resolution}</p>}
                <div className="flex items-center gap-3 text-xs faint">
                  <span>{c.sections?.length || 0} sections</span>
                  <span>{timeAgo(c.updatedAt)}</span>
                  {health.counts.errors > 0 && <span className="text-red-500">{health.counts.errors} issue{health.counts.errors === 1 ? "" : "s"}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Editor
──────────────────────────────────────────────────────────────────────────── */

function CaseEditor({ caze, loading, onBack, onChange, onDelete }) {
  const [draft, setDraft] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [showHealth, setShowHealth] = useState(true);
  const [versionLabel, setVersionLabel] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [stress, setStress] = useState(null); // {busy, raw, findings[], sectionId}
  const [focusSection, setFocusSection] = useState(null);

  const { err: evErr, items: evItems } = useCollection("evidence");
  useEffect(() => { if (evItems) setEvidence(evItems); }, [evItems]);

  // Load case into local draft once.
  useEffect(() => {
    if (caze) setDraft(JSON.parse(JSON.stringify(caze)));
    else if (!loading) setDraft(newCase());
  }, [caze, loading]);

  // Debounced autosave of the draft.
  useEffect(() => {
    if (!draft || !caze) return;
    const t = setTimeout(() => {
      if (caze.id) updateItem("cases", caze.id, draft).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [draft, caze]);

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  const health = useMemo(() => checkCase(draft, evidence), [draft, evidence]);

  function patchSection(id, p) {
    setDraft((d) => ({ ...d, sections: (d.sections || []).map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  }
  function addSection(kind = "contention") {
    setDraft((d) => ({ ...d, sections: [...(d.sections || []), newSection({ kind })] }));
    setFocusSection(newSection({ kind }).id);
  }
  function duplicateSection(id) {
    setDraft((d) => {
      const s = d.sections.find((x) => x.id === id);
      if (!s) return d;
      return { ...d, sections: [...d.sections, newSection({ ...s, id: undefined, title: s.title + " (copy)" })] };
    });
  }
  function moveSection(id, dir) {
    setDraft((d) => {
      const idx = d.sections.findIndex((x) => x.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= d.sections.length) return d;
      const next = [...d.sections];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, sections: next };
    });
  }
  function removeSection(id) {
    setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== id) }));
  }

  async function saveVersion() {
    if (!draft) return;
    const label = versionLabel.trim() || `Version ${(draft.versions?.length || 0) + 1}`;
    const versions = [...(draft.versions || []), {
      label, ts: new Date().toISOString(),
      snapshot: { title: draft.title, resolution: draft.resolution, thesis: draft.thesis, side: draft.side, sections: draft.sections }
    }].slice(-12);
    patch({ versions });
    setVersionLabel("");
    setShowVersions(true);
  }

  function restoreVersion(v) {
    setDraft((d) => ({ ...d, ...v.snapshot, versions: d.versions }));
  }

  async function runStressTest(sectionId) {
    setStress({ busy: true, raw: "", findings: null, sectionId: sectionId || null });
    let text = "";
    const target = sectionId ? draft.sections.find((s) => s.id === sectionId) : null;
    const body = target
      ? JSON.stringify({ title: target.title, claim: target.claim, warrant: target.warrant, impact: target.impact })
      : JSON.stringify({ resolution: draft.resolution, thesis: draft.thesis, sections: (draft.sections || []).map((s) => ({ title: s.title, claim: s.claim, warrant: s.warrant, impact: s.impact })) });
    const prompt = `Stress-test this ${target ? "argument" : "case"} for competitive debate. Find real weaknesses only — no padding. Return ONLY a JSON array where each item has: "weakness" (the flaw, one sentence), "type" (e.g. missing warrant / unsupported assumption / internal contradiction / weak link / weak impact / evidence challenge), "likelyResponse" (the exact attack an opponent would make), and "action" (one concrete fix). Max 6 items.`;
    try {
      await streamText("chat", { message: prompt, draft: body.slice(0, 9000) }, {
        onDelta: (d) => { text += d; setStress({ busy: true, raw: text, findings: null }); }
      });
      setStress({ busy: false, raw: text, findings: parseFindings(text) });
    } catch (e) {
      setStress({ busy: false, raw: "", findings: null, error: e?.message || "Stress test unavailable right now." });
    }
  }

  function saveFindingAsNote(f, sectionId) {
    if (!sectionId) return;
    patchSection(sectionId, { notes: `${draft.sections.find((s) => s.id === sectionId)?.notes || ""}\n\n[Stress test] ${f.action || f.weakness}`.trim() });
  }
  function saveFindingAsResponse(f, sectionId) {
    if (!sectionId) return;
    patchSection(sectionId, { responses: [...(draft.sections.find((s) => s.id === sectionId)?.responses || []), { id: "r" + Date.now(), trigger: f.likelyResponse || f.weakness, response: f.action || "", category: f.type || "" }] });
  }
  async function sendFindingToInbox(f) {
    await createItem("inbox", { kind: "note", content: `[Stress test] ${f.weakness} — ${f.action}`, status: "unprocessed" });
  }

  if (loading) return <div className="max-w-5xl mx-auto px-5 py-10"><LoadingBlock /></div>;

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <button onClick={onBack} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1 mb-4"><ArrowLeft size={13} /> All cases</button>

      {!caze ? (
        <EmptyState icon={ShieldAlert} title="Case not found"
          body="This case may have been deleted. Go back to the list and open another one."
          action={<button onClick={onBack} className="btn-solid py-2 px-4 text-sm">Back to cases</button>} />
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
          {/* ── Editor ── */}
          <section className="space-y-4">
            <div className="card p-5">
              <input value={draft.title} onChange={(e) => patch({ title: e.target.value })}
                placeholder="Case title (e.g. Affirmative — Later School Start Times)"
                className="w-full bg-transparent font-serif text-2xl focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-600" />
              <textarea value={draft.resolution} onChange={(e) => patch({ resolution: e.target.value })}
                placeholder="Resolution"
                className="field mt-3 !py-2 text-sm" rows={1} />
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Side"><select value={draft.side} onChange={(e) => patch({ side: e.target.value })} className="field !py-2"><option value="aff">Aff</option><option value="neg">Neg</option><option value="speech">Speech</option></select></Field>
                <Field label="Event"><input value={draft.event} onChange={(e) => patch({ event: e.target.value })} placeholder="e.g. LD, PF, Policy" className="field !py-2" /></Field>
              </div>
              <div className="mt-3"><Field label="Topic / tags"><TagEditor tags={draft.tags} onChange={(tags) => patch({ tags })} /></Field></div>
            </div>

            <div className="card p-5">
              <div className="label-mono mb-1.5">Thesis</div>
              <textarea value={draft.thesis} onChange={(e) => patch({ thesis: e.target.value })}
                placeholder="One sentence: what you must prove."
                className="field !py-2 text-sm" rows={2} />
            </div>

            {/* Sections */}
            {(draft.sections || []).map((s, i) => (
              <SectionCard key={s.id} s={s} index={i} total={draft.sections.length}
                evidence={evidence}
                focused={focusSection === s.id}
                onChange={(p) => patchSection(s.id, p)}
                onDuplicate={() => duplicateSection(s.id)}
                onMove={(dir) => moveSection(s.id, dir)}
                onRemove={() => removeSection(s.id)}
                onStress={() => runStressTest(s.id)}
                onLinkEvidence={(id) => patchSection(s.id, { evidenceIds: [...new Set([...(s.evidenceIds || []), id])] })}
                onUnlinkEvidence={(id) => patchSection(s.id, { evidenceIds: (s.evidenceIds || []).filter((x) => x !== id) })}
              />
            ))}

            <div className="flex gap-2">
              <button onClick={() => addSection("contention")} className="btn-solid !py-2.5 text-sm flex-1"><Plus size={14} /> Add contention</button>
              <button onClick={() => addSection("note")} className="btn-ghost !py-2.5 text-sm"><FileText size={14} /> Add note</button>
            </div>
          </section>

          {/* ── Sidebar: health, versions, stress ── */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            {/* Completeness */}
            <div className="card p-5">
              <button onClick={() => setShowHealth((v) => !v)} className="w-full flex items-center justify-between">
                <span className="label-mono">Case health</span>
                <span className="font-serif text-2xl">{draft.sections?.length ? health.score : "—"}<span className="text-sm faint">%</span></span>
              </button>
              {draft.sections?.length > 0 && (
                <>
                  <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden my-3">
                    <div className={cx("h-full rounded-full transition-all", health.score >= 80 ? "bg-green-500" : health.score >= 55 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${health.score}%` }} />
                  </div>
                  {showHealth && (
                    <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                      {health.issues.length === 0 && <li className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5"><CheckCircle2 size={13} /> No issues found.</li>}
                      {health.issues.map((issue, i) => (
                        <li key={i}>
                          <button onClick={() => issue.sectionId && setFocusSection(issue.sectionId)}
                            className="w-full text-left text-xs flex items-start gap-1.5 rounded-sm px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                            {issue.severity === "error" ? <AlertTriangle size={12} className="text-red-500 shrink-0 mt-0.5" /> : issue.severity === "warn" ? <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" /> : <CheckCircle2 size={12} className="text-zinc-400 shrink-0 mt-0.5" />}
                            <span><span className="font-medium">{issue.label}.</span> <span className="muted">{issue.detail}</span></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {draft.sections?.length === 0 && <p className="faint text-xs mt-2">Add contentions to start the check.</p>}
            </div>

            {/* Stress test */}
            <div className="card p-5">
              <div className="label-mono mb-2">Argument stress test</div>
              <p className="faint text-xs mb-3">Sends the case (or a single contention) to the engine for structured weaknesses, likely responses, and actions.</p>
              <button onClick={() => runStressTest()} disabled={stress?.busy} className="btn-ghost w-full !py-2 text-xs">
                {stress?.busy ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />} Stress-test the whole case
              </button>
              {stress?.busy && (
                <div className="mt-3 rounded-sm bg-zinc-50 dark:bg-zinc-900/50 border hair p-3">
                  <p className="muted text-xs leading-relaxed whitespace-pre-wrap">{stress.raw || "Analyzing…"}</p>
                </div>
              )}
              {stress?.error && <p className="text-red-500 text-xs mt-2">{stress.error}</p>}
              {stress?.findings && (
                <div className="mt-3 space-y-2">
                  {stress.findings.map((f, i) => (
                    <div key={i} className="rounded-sm border hair p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-red-500 shrink-0" /><span className="text-xs font-medium">{f.type || "Weakness"}</span></div>
                      <p className="text-xs muted leading-relaxed">{f.weakness}</p>
                      {f.likelyResponse && <p className="text-xs"><span className="label-mono">Likely response:</span> <span className="muted">{f.likelyResponse}</span></p>}
                      {f.action && <p className="text-xs"><span className="label-mono">Action:</span> <span className="muted">{f.action}</span></p>}
                      {stress.sectionId && (
                        <div className="flex gap-1.5 pt-1">
                          <button onClick={() => saveFindingAsResponse(f, stress.sectionId)} className="pill text-[10px]"><MessageSquarePlus size={10} /> Add as response</button>
                          <button onClick={() => saveFindingAsNote(f, stress.sectionId)} className="pill text-[10px]"><FileText size={10} /> Save as note</button>
                          <button onClick={() => sendFindingToInbox(f)} className="pill text-[10px]"><FolderPlus size={10} /> Send to inbox</button>
                        </div>
                      )}
                      {!stress.sectionId && <p className="faint text-[11px]">Run a single-contention stress test to save findings as notes or responses.</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Versions */}
            <div className="card p-5">
              <button onClick={() => setShowVersions((v) => !v)} className="w-full flex items-center gap-2">
                <History size={14} /> <span className="text-sm font-medium">Versions</span>
                <span className="faint text-xs ml-auto">{draft.versions?.length || 0}</span>
              </button>
              {showVersions && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)}
                      placeholder="Label (e.g. Tournament version)" className="field !py-1.5 text-xs flex-1" />
                    <button onClick={saveVersion} className="btn-solid !py-1.5 !px-3 text-xs"><Save size={12} /> Save</button>
                  </div>
                  <ul className="space-y-1.5">
                    {(draft.versions || []).slice().reverse().map((v, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0"><span className="font-medium truncate">{v.label}</span><span className="faint ml-2">{timeAgo(v.ts)}</span></div>
                        <button onClick={() => restoreVersion(v)} className="pill text-[10px]">Restore</button>
                      </li>
                    ))}
                    {(draft.versions || []).length === 0 && <li className="faint text-xs">Checkpoint important states — before a tournament, after a practice revision.</li>}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Section card
──────────────────────────────────────────────────────────────────────────── */

function SectionCard({ s, index, total, evidence, focused, onChange, onDuplicate, onMove, onRemove, onStress, onLinkEvidence, onUnlinkEvidence }) {
  const [collapsed, setCollapsed] = useState(s.collapsed);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState("");
  const linked = (s.evidenceIds || []).map((id) => evidence.find((e) => e.id === id)).filter(Boolean);

  const linkedNames = linked.map((e) => normId(e.id));

  return (
    <section className={cx("card p-5 scroll-mt-24", focused && "ring-2 ring-amber-400/70")}>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => { setCollapsed(!collapsed); onChange({ collapsed: !collapsed }); }} className="faint hover:text-zinc-950 dark:hover:text-zinc-50">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="label-mono">Section {index + 1}</span>
        <input value={s.title} onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Contention title" className="flex-1 bg-transparent font-serif text-lg focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-600" />
        <div className="flex items-center gap-1 faint">
          <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up" className="hover:text-zinc-950 dark:hover:text-zinc-50 disabled:opacity-30"><ArrowUp size={14} /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move down" className="hover:text-zinc-950 dark:hover:text-zinc-50 disabled:opacity-30"><ArrowDown size={14} /></button>
          <button onClick={onDuplicate} title="Duplicate" className="hover:text-zinc-950 dark:hover:text-zinc-50"><Copy size={14} /></button>
          <button onClick={onRemove} title="Delete" className="hover:text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {s.kind !== "note" ? (
            <>
              <MiniField label="Claim" value={s.claim} onChange={(v) => onChange({ claim: v })} placeholder="What are you asserting?" invalid={!s.claim.trim()} />
              <MiniField label="Warrant" value={s.warrant} onChange={(v) => onChange({ warrant: v })} placeholder="Why does the evidence prove the claim?" invalid={s.claim.trim() && !s.warrant.trim()} />
              <MiniField label="Impact" value={s.impact} onChange={(v) => onChange({ impact: v })} placeholder="Why does it matter, and to whom?" invalid={s.claim.trim() && !s.impact.trim()} />

              {/* Evidence links */}
              <div>
                <div className="label-mono mb-1.5">Evidence</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {linked.map((e) => (
                    <Pill key={e.id} tone="blue" onClick={() => onUnlinkEvidence(e.id)} title="Click to unlink">
                      {e.source || e.text?.slice(0, 28) || "Card"} <Trash2 size={10} />
                    </Pill>
                  ))}
                  <button onClick={() => setLinkOpen(true)} className="pill"><Link2 size={10} /> {linked.length ? "Link more" : "Link evidence"}</button>
                </div>
              </div>

              {/* Responses */}
              <ResponsesEditor responses={s.responses} onChange={(responses) => onChange({ responses })} />
            </>
          ) : (
            <textarea value={s.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Free note for this part of the case…" className="field text-sm leading-relaxed" rows={4} />
          )}
          {s.kind === "contention" && (
            <button onClick={onStress} className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-flex items-center gap-1">
              <Swords size={12} /> Stress-test this contention
            </button>
          )}
        </div>
      )}

      {linkOpen && (
        <Modal title="Link evidence" onClose={() => setLinkOpen(false)} wide>
          <SearchBar value={linkQuery} onChange={setLinkQuery} placeholder="Search your evidence…" />
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {filterByQuery(evidence, linkQuery).length === 0 && <p className="faint text-xs">No evidence found. Add cards in the Argument Library first.</p>}
            {filterByQuery(evidence, linkQuery).map((e) => (
              <button key={e.id} onClick={() => { onLinkEvidence(e.id); setLinkOpen(false); }}
                className="w-full text-left rounded-sm border hair p-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <p className="text-sm line-clamp-2">{e.text}</p>
                <p className="faint text-xs mt-1">{e.source || "No source"} {linkedNames.includes(e.id) && "· linked"}</p>
              </button>
            ))}
          </div>
          <Link to="/prep/library" className="text-xs faint hover:text-zinc-950 dark:hover:text-zinc-50 inline-block mt-3">Open the Argument Library →</Link>
        </Modal>
      )}
    </section>
  );
}

function normId(id) { return String(id || ""); }

function MiniField({ label, value, onChange, placeholder, invalid }) {
  return (
    <div>
      <div className="label-mono mb-1 flex items-center gap-1.5">
        {label}
        {invalid && <span className="text-[10px] text-red-500 font-mono normal-case">missing</span>}
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={cx("field !py-2 text-sm leading-relaxed", invalid && "border-red-400/70 dark:border-red-800/70")} rows={2} />
    </div>
  );
}

function ResponsesEditor({ responses, onChange }) {
  const [adding, setAdding] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [response, setResponse] = useState("");
  const list = responses || [];

  function add() {
    if (!trigger.trim() && !response.trim()) return;
    onChange([...list, { id: "r" + Date.now().toString(36), trigger: trigger.trim(), response: response.trim(), category: "" }]);
    setTrigger(""); setResponse(""); setAdding(false);
  }

  return (
    <div>
      <div className="label-mono mb-1.5">Likely responses</div>
      {list.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {list.map((r) => (
            <li key={r.id} className="rounded-sm border hair px-3 py-2">
              <div className="text-xs"><span className="label-mono">They say:</span> <span className="muted">{r.trigger || "—"}</span></div>
              <div className="text-xs mt-1"><span className="label-mono">You say:</span> <span className="muted">{r.response || "—"}</span></div>
              {r.category && <div className="text-[10px] font-mono faint mt-1">{r.category}</div>}
              <button onClick={() => onChange(list.filter((x) => x.id !== r.id))} className="text-[10px] faint hover:text-red-500 mt-1">remove</button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="space-y-2 rounded-sm border hair p-3">
          <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="They say… (e.g. No link)" className="field !py-1.5 text-xs" />
          <textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="You say…" className="field !py-1.5 text-xs" rows={2} />
          <div className="flex gap-2">
            <button onClick={add} className="btn-solid !py-1 !px-3 text-xs">Add</button>
            <button onClick={() => setAdding(false)} className="btn-ghost !py-1 !px-3 text-xs">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="pill"><MessageSquarePlus size={10} /> Add response</button>
      )}
    </div>
  );
}

// Best-effort JSON array extraction from a streamed model response.
function parseFindings(raw) {
  try { return JSON.parse(raw); } catch (_) {}
  const start = raw.indexOf("[");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === "\"") { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "[") depth += 1;
    if (ch === "]") { depth -= 1; if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)); } catch (_) { return null; } } }
  }
  return null;
}
