import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Download, Save, MessageSquare, Send, Loader2 } from "lucide-react";
import { analyze, streamText, exportPdf, summarizeTitle } from "../lib/api.js";
import { loadPrefs, savePrefs, FORMATS, DEPTHS } from "../lib/prefs.js";
import { useAuth } from "../lib/useAuth.jsx";
import { saveProject } from "../lib/firebase.js";

function scoreLabel(s) {
  if (s == null) return "";
  if (s >= 95) return "Outstanding";
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Solid";
  if (s >= 50) return "Needs work";
  return "Breaks down";
}

export default function Studio() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [essay, setEssay] = useState("");
  const [prefs, setPrefs] = useState(loadPrefs());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ progress: 0, message: "" });
  const [sections, setSections] = useState([]);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => savePrefs(prefs), [prefs]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));

  async function run() {
    if (!essay.trim() || running) return;
    setRunning(true); setError(null); setSections([]); setAudit(null); setSaved(false);
    setProgress({ progress: 4, message: "Preparing the audit" });
    let gotAudit = false;
    let gotSections = false;
    try {
      await analyze({ essay, preferences: prefs }, {
        onProgress: (p) => setProgress(p),
        onReportSection: (s) => { gotSections = true; setSections((prev) => [...prev, s]); },
        onAudit: (a) => { gotAudit = true; setAudit(a); }
      });
      // The stream can end cleanly without ever producing a report when every free
      // model is unavailable. Don't reset to an empty panel silently — say what happened.
      if (!gotAudit && !gotSections) {
        setError("The free models are overloaded right now and didn't return a report. Wait a moment and press Fracture It again.");
      }
    } catch (e) {
      setError(e?.message || "The audit could not complete. Try again.");
    } finally {
      setRunning(false);
      setProgress({ progress: 100, message: "Ready" });
    }
  }

  const [saving, setSaving] = useState(false);
  async function save() {
    if (!audit || saving) return;
    if (!user) { navigate("/auth"); return; }
    setSaving(true);
    try {
      const summary = await summarizeTitle(essay).catch(() => "");
      const title = summary || (audit.thesis?.quote || "").slice(0, 70) || essay.trim().slice(0, 60) || "Untitled draft";
      await saveProject(user.id, {
        title,
        draft: essay,
        audit,
        score: audit.overall_score ?? null,
        mode: prefs.analysisFormat
      });
      setSaved(true);
    } catch (e) { setError("Could not save: " + (e?.message || "")); }
    finally { setSaving(false); }
  }

  async function sendChat() {
    const q = chatInput.trim();
    if (!q || chatBusy) return;
    setChatInput("");
    setChatMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setChatBusy(true);
    try {
      await streamText("chat", { message: q, draft: essay, report: audit, history: chatMsgs.slice(-8) }, {
        onDelta: (d) => setChatMsgs((m) => {
          const copy = [...m]; copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + d }; return copy;
        })
      });
    } catch (e) {
      setChatMsgs((m) => { const copy = [...m]; copy[copy.length - 1] = { role: "assistant", content: "Chat error: " + (e?.message || "") }; return copy; });
    } finally { setChatBusy(false); }
  }

  const score = audit?.overall_score;

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      <header className="mb-8">
        <div className="label-mono mb-2">Studio / Argument Audit</div>
        <h1 className="font-serif text-4xl md:text-5xl">Fracture the draft. <span className="italic muted">Plan the repair.</span></h1>
      </header>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input */}
        <section className="card p-5 flex flex-col">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[160px]">
              <label className="label-mono mb-1.5">Mode</label>
              <select value={prefs.analysisFormat} onChange={(e) => setPref("analysisFormat", e.target.value)} className="field">
                {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="label-mono mb-1.5">Depth</label>
              <select value={prefs.depthLevel} onChange={(e) => setPref("depthLevel", e.target.value)} className="field">
                {DEPTHS.map((d) => <option key={d.id} value={d.id}>{d.label} — {d.hint}</option>)}
              </select>
            </div>
          </div>

          <textarea value={essay} onChange={(e) => setEssay(e.target.value)}
            placeholder="Paste your speech, essay, debate case, position paper, or research paper here…"
            className="field flex-1 min-h-[340px] resize-y leading-relaxed font-sans" />

          <div className="flex items-center justify-between mt-4">
            <span className="faint text-xs font-mono">{essay.trim() ? essay.trim().length.toLocaleString() : 0} chars</span>
            <div className="flex gap-2">
              <button onClick={() => { setEssay(""); setSections([]); setAudit(null); }} className="btn-ghost py-2.5 px-4">Clear</button>
              <button onClick={run} disabled={running || !essay.trim()} className="btn-solid py-2.5 px-5">
                {running ? <><Loader2 size={15} className="animate-spin" /> Fracturing…</> : <><Sparkles size={15} /> Fracture It</>}
              </button>
            </div>
          </div>

          {running && (
            <div className="mt-4">
              <div className="h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-950 dark:bg-zinc-100 transition-all duration-500" style={{ width: `${progress.progress}%` }} />
              </div>
              <p className="faint text-xs mt-2 font-mono">{progress.message}</p>
            </div>
          )}
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        </section>

        {/* Output */}
        <section className="card p-5 min-h-[460px]">
          {!sections.length && !running && (
            <div className="h-full flex flex-col items-center justify-center text-center py-20">
              <Sparkles size={28} className="faint mb-4" />
              <p className="muted max-w-xs">Your Fracture report will appear here — score, collapse point, claim-by-claim analysis, evidence checks, and a revision plan.</p>
            </div>
          )}

          {(score != null) && (
            <div className="flex items-end justify-between mb-6 pb-5 border-b hair">
              <div>
                <div className="label-mono mb-1">Overall score</div>
                <div className="font-serif text-6xl leading-none">{score}<span className="text-2xl muted">/100</span></div>
              </div>
              <div className="text-right">
                <div className="font-serif text-2xl italic">{scoreLabel(score)}</div>
                <div className="flex gap-2 mt-3">
                  <button onClick={save} disabled={saving} className="btn-ghost py-2 px-3 text-xs"><Save size={13} /> {saving ? "Saving…" : saved ? "Saved" : "Save"}</button>
                  <button onClick={() => exportPdf({ audit, sources: audit?.source_verification_report, draft: essay, citation_style: prefs.citationStyle })} className="btn-ghost py-2 px-3 text-xs"><Download size={13} /> PDF</button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {sections.map((s, i) => (
              <div key={i} className="animate-fadeUp">
                <h3 className="font-serif text-lg mb-1.5">{s.title}</h3>
                <p className="muted text-sm leading-relaxed whitespace-pre-line">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Chat */}
      {audit && (
        <section className="card mt-6 overflow-hidden">
          <button onClick={() => setChatOpen((o) => !o)} className="w-full flex items-center gap-2 px-5 py-4 text-left">
            <MessageSquare size={16} /> <span className="font-serif text-lg">Fracture Chat</span>
            <span className="faint text-xs ml-auto">{chatOpen ? "Hide" : "Ask about this draft"}</span>
          </button>
          {chatOpen && (
            <div className="px-5 pb-5">
              <div className="max-h-72 overflow-y-auto space-y-3 mb-3">
                {chatMsgs.map((m, i) => (
                  <div key={i} className={`text-sm leading-relaxed ${m.role === "user" ? "text-zinc-950 dark:text-zinc-50 font-medium" : "muted whitespace-pre-line"}`}>
                    <span className="label-mono mr-2 align-middle">{m.role === "user" ? "You" : "Fracture"}</span>{m.content || (chatBusy && i === chatMsgs.length - 1 ? "…" : "")}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="e.g. rewrite my intro to be punchier" className="field flex-1" />
                <button onClick={sendChat} disabled={chatBusy} className="btn-solid px-4">{chatBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
