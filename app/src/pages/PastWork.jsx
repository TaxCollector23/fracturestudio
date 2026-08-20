import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderOpen, Loader2, ArrowRight, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { listProjects } from "../lib/firebase.js";
import { FORMATS } from "../lib/prefs.js";
import { auditSkillScores, skillById } from "../lib/skills.js";

const modeLabel = (id) => FORMATS.find((f) => f.id === id)?.label || "Argument / Debate";

// Quick structured round summary from one audit: top strengths + weaknesses.
function skillStrip(audit, mode) {
  const scores = auditSkillScores(audit, mode);
  const ranked = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length) return null;
  return {
    strengths: ranked.slice(0, 2),
    weaknesses: ranked.slice(-2).reverse()
  };
}

function openInStudio(navigate, it) {
  sessionStorage.setItem("fracture_continue", JSON.stringify({ draft: it.draft, audit: it.audit, mode: it.mode }));
  navigate("/studio");
}

export default function PastWork() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!user) { setItems([]); return; }
    listProjects(user.id).then(setItems).catch((e) => { setErr(e?.message || "Could not load."); setItems([]); });
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Saved Workspace</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-8">Past Work</h1>

      {!ready && <Loader2 className="animate-spin faint" />}
      {ready && !user && (
        <div className="card p-10 text-center">
          <FolderOpen size={26} className="faint mx-auto mb-4" />
          <p className="muted mb-5">Sign in to save audits and reopen them later.</p>
          <Link to="/auth" className="btn-solid inline-flex">Sign in</Link>
        </div>
      )}
      {err && <p className="text-red-500 text-sm">{err}</p>}

      {user && items && items.length === 0 && (
        <div className="card p-10 text-center">
          <Sparkles size={26} className="faint mx-auto mb-4" />
          <p className="muted mb-5 max-w-sm mx-auto text-sm leading-relaxed">
            Saved audits live here — each one also feeds your skill profile and the recommendations on your Dashboard.
          </p>
          <Link to="/studio" className="btn-solid inline-flex">Run your first audit <ArrowRight size={14} /></Link>
        </div>
      )}

      {user && items && items.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((it) => (
            <button key={it.id} onClick={() => setActive(it)} className="card card-hover p-5 text-left flex flex-col h-44">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm muted">{modeLabel(it.mode)}</span>
                {it.score != null && <span className="font-serif text-2xl">{it.score}</span>}
              </div>
              <h3 className="font-serif text-lg leading-snug line-clamp-3">{it.title || "Untitled draft"}</h3>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur flex items-center justify-center p-6" onClick={() => setActive(null)}>
          <div className="card max-w-2xl w-full p-7 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl">{active.title}</h2>
              {active.score != null && <span className="font-serif text-4xl">{active.score}<span className="text-lg muted">/100</span></span>}
            </div>
            {active.audit?.verdict && <p className="muted text-sm leading-relaxed mb-4 whitespace-pre-line">{active.audit.verdict}</p>}

            {(() => {
              const strip = skillStrip(active.audit, active.mode);
              if (!strip) return null;
              return (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-sm border hair p-3">
                    <div className="label-mono mb-1.5 flex items-center gap-1"><TrendingUp size={11} /> Strongest</div>
                    <ul className="space-y-1">
                      {strip.strengths.map(([id, v]) => (
                        <li key={id} className="text-xs"><span className="font-medium">{skillById(id).label}</span> <span className="font-mono faint">{v.score}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-sm border hair p-3">
                    <div className="label-mono mb-1.5 flex items-center gap-1"><AlertTriangle size={11} /> Weakest</div>
                    <ul className="space-y-1">
                      {strip.weaknesses.map(([id, v]) => (
                        <li key={id} className="text-xs"><span className="font-medium">{skillById(id).label}</span> <span className="font-mono faint">{v.score}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 mb-4">
              <button onClick={() => openInStudio(navigate, active)} className="btn-solid py-2 px-3.5 text-xs">
                Continue in Studio <ArrowRight size={13} />
              </button>
            </div>
            <div className="label-mono mb-1">Draft</div>
            <p className="faint text-sm leading-relaxed whitespace-pre-line">{active.draft}</p>
          </div>
        </div>
      )}
    </div>
  );
}
