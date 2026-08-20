import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { analyze, exportPdf, summarizeTitle } from "./api.js";
import { loadPrefs, savePrefs } from "./prefs.js";
import { useAuth } from "./useAuth.jsx";
import { saveProject } from "./firebase.js";

const CONTINUE_KEY = "fracture_continue";
const REBUTTAL_DRAFT_KEY = "fracture_rebuttal_draft";
const DRAFT_AUTOSAVE_KEY = "fracture_draft_autosave";

/**
 * Owns the Studio audit flow: draft input, preferences, the streaming run,
 * the finished report, and the save / export / hand-off actions.
 *
 * The page renders from this hook's state; no business logic lives in JSX.
 */
export function useAudit() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [essay, setEssay] = useState("");
  const [rubric, setRubric] = useState("");
  const [prefs, setPrefs] = useState(loadPrefs());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ progress: 0, message: "" });
  const [sections, setSections] = useState([]);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const essayRef = useRef(null);

  useEffect(() => savePrefs(prefs), [prefs]);

  // Continue a saved audit from Past Work / the command palette.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CONTINUE_KEY);
      if (raw) {
        sessionStorage.removeItem(CONTINUE_KEY);
        const data = JSON.parse(raw);
        if (data.draft) setEssay(data.draft);
        if (data.audit) setAudit(data.audit);
        if (data.mode) setPrefs((p) => ({ ...p, analysisFormat: data.mode }));
        return;
      }
      // Otherwise restore the locally-autosaved draft so a refresh or a
      // round-trip through /auth never loses the work.
      const auto = localStorage.getItem(DRAFT_AUTOSAVE_KEY);
      if (auto) {
        const d = JSON.parse(auto);
        if (d?.draft?.trim()) setEssay(d.draft);
      }
    } catch (_) {}
  }, []);

  // Autosave the draft locally (debounced) so it survives refresh/navigation.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (essay.trim()) localStorage.setItem(DRAFT_AUTOSAVE_KEY, JSON.stringify({ draft: essay, ts: Date.now() }));
      } catch (_) {}
    }, 600);
    return () => clearTimeout(t);
  }, [essay]);

  const setPref = useCallback((k, v) => setPrefs((p) => ({ ...p, [k]: v })), []);

  // Rubric mode appends the pasted rubric to the draft before analysis.
  const payload = () => {
    if (prefs.analysisFormat === "rubric" && rubric.trim()) {
      return `${essay.trim()}\n\n--- RUBRIC ---\n\n${rubric.trim()}`;
    }
    return essay;
  };

  async function run() {
    const text = payload();
    if (!text.trim() || running) return;
    setRunning(true); setError(null); setSections([]); setAudit(null); setSaved(false);
    setProgress({ progress: 4, message: "Preparing the audit" });
    let gotAudit = false;
    let gotSections = false;
    let tokens = 0;
    try {
      await analyze({ essay: text, preferences: prefs }, {
        onProgress: (p) => setProgress((prev) => ({
          progress: Math.max(prev.progress, p.progress),
          message: p.message || prev.message
        })),
        onModelDelta: () => {
          tokens += 1;
          if (tokens % 2 === 0) {
            setProgress((prev) => {
              if (prev.progress >= 88) return prev;
              const target = Math.min(88, 22 + tokens * 0.18);
              return { progress: Math.max(prev.progress, target), message: prev.message };
            });
          }
        },
        onReportSection: (s) => { gotSections = true; setSections((prev) => [...prev, s]); },
        onAudit: (a) => { gotAudit = true; setAudit(a); }
      });
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

  function jumpToQuote(quote) {
    const el = essayRef.current;
    if (!el || !quote) return;
    const hay = essay.toLowerCase();
    const needle = quote.toLowerCase().trim();
    const idx = hay.indexOf(needle);
    if (idx < 0) return;
    el.focus();
    el.setSelectionRange(idx, idx + needle.length);
    // Rough scroll so the selection is visible inside the textarea.
    const line = hay.slice(0, idx).split("\n").length - 1;
    el.scrollTop = Math.max(0, line * 22);
  }

  function clear() {
    setEssay(""); setRubric(""); setSections([]); setAudit(null); setError(null); setSaved(false);
    try { localStorage.removeItem(DRAFT_AUTOSAVE_KEY); } catch (_) {}
  }

  async function save() {
    if (!audit || saving) return;
    if (!user) {
      // Preserve the whole run so signing in lands back on this report instead
      // of an empty Studio.
      try {
        sessionStorage.setItem(CONTINUE_KEY, JSON.stringify({ draft: essay, audit, mode: prefs.analysisFormat }));
      } catch (_) {}
      navigate("/auth");
      return;
    }
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

  function copyReport() {
    const text = sections.map((s) => `${s.title.toUpperCase()}\n${s.body}`).join("\n\n");
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function buildRebuttals() {
    // Trim the audit so it fits comfortably in sessionStorage.
    const trimmed = audit ? { ...audit, source_verification_report: undefined } : null;
    sessionStorage.setItem(REBUTTAL_DRAFT_KEY, JSON.stringify({ draft: essay, audit: trimmed }));
    navigate("/rebuttals");
  }

  return {
    essay, setEssay,
    rubric, setRubric,
    prefs, setPref,
    running, progress, sections, audit, error, saved, saving,
    essayRef, payload, run, jumpToQuote, clear, save, copyReport, buildRebuttals
  };
}
