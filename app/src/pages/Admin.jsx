import { useState } from "react";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

function ScoreBadge({ score }) {
  if (score == null) return <span className="faint text-xs">—</span>;
  const color = score >= 95 ? "text-emerald-400" : score >= 80 ? "text-blue-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  return <span className={`font-mono font-bold text-lg ${color}`}>{score}</span>;
}

function UserRow({ u }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card mb-3">
      <button
        className="w-full p-5 text-left flex items-center justify-between gap-4"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold truncate">{u.fullName || "—"}</span>
            <span className="faint text-sm truncate">{u.email}</span>
            <span className="pill text-xs">{u.provider}</span>
          </div>
          <div className="faint text-xs mt-1 flex gap-4 flex-wrap">
            <span>{u.projectCount} submission{u.projectCount !== 1 ? "s" : ""}</span>
            {u.averageScore != null && <span>avg {u.averageScore}</span>}
            {u.bestScore != null && <span>best {u.bestScore}</span>}
            <span>{u.recentlyUsed}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {u.latestScore != null && <ScoreBadge score={u.latestScore} />}
          {open ? <ChevronUp size={16} className="muted" /> : <ChevronDown size={16} className="muted" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] px-5 pb-5 pt-4 space-y-4">
          {(!u.allWritings || u.allWritings.length === 0) ? (
            <p className="faint text-sm">No submissions saved yet.</p>
          ) : (
            u.allWritings.map((w, i) => (
              <div key={w.id || i} className="bg-[var(--color-surface)] rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{w.title || "Untitled"}</div>
                    <div className="faint text-xs mt-0.5">{w.wordCount} words · {w.updated ? new Date(w.updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</div>
                  </div>
                  <ScoreBadge score={w.score} />
                </div>
                {w.draft && (
                  <div className="text-xs muted leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto rounded bg-[var(--color-bg)] p-3 font-mono">
                    {w.draft.slice(0, 800)}{w.draft.length > 800 ? "\n…" : ""}
                  </div>
                )}
                {w.verdict && (
                  <p className="text-xs faint leading-relaxed italic">"{w.verdict.slice(0, 200)}{w.verdict.length > 200 ? "…" : ""}"</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!pw.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Access denied.");
      setData(json);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-5">
        <div className="card p-8 w-full max-w-sm">
          <h1 className="font-serif text-2xl mb-1">Admin</h1>
          <p className="faint text-sm mb-6">Enter the admin password to continue.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Password"
                autoFocus
                className="input w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 faint hover:text-[var(--color-text)] transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-rose-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Checking…" : "Enter"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { users = [], summary = {} } = data;

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-12">
      <div className="label-mono mb-2">Admin</div>
      <h1 className="font-serif text-4xl mb-2">User Activity</h1>
      <p className="faint text-sm mb-8">Generated {new Date(data.generated_at).toLocaleString()}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { label: "Total users", value: summary.totalUsers ?? 0 },
          { label: "Total submissions", value: summary.totalProjects ?? 0 },
          { label: "Active this week", value: summary.activeLast7Days ?? 0 },
          { label: "Avg score", value: summary.averageScore != null ? Math.round(summary.averageScore) : "—" }
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <div className="font-mono text-2xl font-bold mb-1">{value}</div>
            <div className="faint text-xs">{label}</div>
          </div>
        ))}
      </div>

      {users.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="faint">No users found. Users appear here after they sign in.</p>
        </div>
      ) : (
        <div>
          <p className="faint text-xs mb-4 font-mono">{users.length} user{users.length !== 1 ? "s" : ""} — click a row to expand submissions</p>
          {users.map((u) => <UserRow key={u.id} u={u} />)}
        </div>
      )}
    </div>
  );
}
