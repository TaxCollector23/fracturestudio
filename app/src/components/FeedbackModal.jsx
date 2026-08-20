import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, Check, X } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { saveFeedbackIssue } from "../lib/firebase.js";
import { ISSUE_TYPES } from "../lib/feedback.js";

const OPEN_EVENT = "fracture:open-feedback";
const LOCAL_PENDING = "fracture_feedback_pending";

function captureContext() {
  return {
    page: window.location.pathname,
    url: window.location.href.slice(0, 500),
    userAgent: navigator.userAgent.slice(0, 200),
    ts: new Date().toISOString()
  };
}

export default function FeedbackModal() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [extra, setExtra] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const textRef = useRef(null);

  useEffect(() => {
    const onOpen = (e) => {
      const detail = e.detail || {};
      setType(detail.type || "bug");
      setExtra(detail.context || "");
      setMessage(detail.message || "");
      setSent(false);
      setError(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => textRef.current?.focus(), 30);
  }, [open]);

  async function submit() {
    if (!message.trim() || busy) return;
    setBusy(true); setError(null);
    const issue = {
      type,
      message: message.trim(),
      extra: extra.trim(),
      context: { ...captureContext(), mode: extra || undefined }
    };
    try {
      if (user) {
        await saveFeedbackIssue(user.id, issue);
      } else {
        const pending = JSON.parse(localStorage.getItem(LOCAL_PENDING) || "[]");
        pending.push({ ...issue, ts: new Date().toISOString() });
        localStorage.setItem(LOCAL_PENDING, JSON.stringify(pending));
      }
      setSent(true);
    } catch (e) {
      setError("Could not send — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  // Floating trigger is hidden on the landing page (keeps the marketing page clean).
  const showTrigger = location.pathname !== "/";

  return (
    <>
      {showTrigger && (
        <button
          onClick={() => setOpen(true)}
          title="Report a bug, confusing feature, or incorrect feedback"
          className="fixed bottom-4 right-4 z-[80] inline-flex items-center gap-1.5 rounded-full border hair bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-3.5 py-2 text-xs font-medium muted hover:text-zinc-950 dark:hover:text-zinc-50 shadow-lg transition-colors"
        >
          <MessageSquare size={14} /> Feedback
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-serif text-xl">Send feedback</h3>
                <p className="faint text-xs mt-1">Bugs, confusing features, requests, and corrections all land in the same place.</p>
              </div>
              <button onClick={() => setOpen(false)} className="faint hover:text-zinc-950 dark:hover:text-zinc-50"><X size={18} /></button>
            </div>

            {sent ? (
              <div className="text-center py-8">
                <Check size={28} className="text-green-500 mx-auto mb-3" />
                <p className="text-sm muted">Thanks — noted{user ? "" : " on this device"}.</p>
                <button onClick={() => setOpen(false)} className="btn-ghost mt-5 py-2 px-4 text-xs">Close</button>
              </div>
            ) : (
              <>
                <div className="space-y-1 mb-4">
                  <label className="label-mono mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ISSUE_TYPES.map((t) => (
                      <button key={t.id} onClick={() => setType(t.id)}
                        className={`rounded-sm border px-3 py-2 text-xs text-left transition-colors ${type === t.id ? "border-zinc-500 bg-zinc-100 dark:bg-zinc-900" : "hair hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={textRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, or what would help? One or two sentences is plenty."
                  className="field min-h-[90px] resize-y leading-relaxed mb-3"
                />
                <input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder={type === "incorrect-feedback" ? "Optional: which report / line was wrong?" : "Optional: where were you? (page, mode)"}
                  className="field mb-4"
                />
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="btn-ghost py-2 px-4 text-xs">Cancel</button>
                  <button onClick={submit} disabled={busy || !message.trim()} className="btn-solid py-2 px-4 text-xs">
                    {busy ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function openFeedbackModal({ type, context, message } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { type, context, message } }));
}
