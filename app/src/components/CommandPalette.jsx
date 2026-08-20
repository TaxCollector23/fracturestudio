import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CornerDownLeft, LayoutDashboard, PenLine, Swords, Target, FolderOpen, Settings, BookOpen, Newspaper, Sparkles, Timer, Flag } from "lucide-react";
import { useAuth } from "../lib/useAuth.jsx";
import { listProjects } from "../lib/firebase.js";
import { loadLocalGoals } from "../lib/goals.js";
import { DRILLS } from "../lib/drills.js";

const OPEN_EVENT = "fracture:open-palette";

function pageActions() {
  return [
    { id: "nav-dashboard", label: "Go to Dashboard", hint: "Progress, goals, recommendations", icon: LayoutDashboard, run: (n) => n("/dashboard"), search: "dashboard home progress skills goals" },
    { id: "nav-studio", label: "Open the Studio", hint: "Run a Fracture audit", icon: PenLine, run: (n) => n("/studio"), search: "studio audit fracture draft" },
    { id: "nav-practice", label: "Browse drills", hint: "Practice a skill", icon: Timer, run: (n) => n("/practice"), search: "practice drills train" },
    { id: "nav-rebuttals", label: "Build a rebuttal plan", hint: "Opponent prep", icon: Swords, run: (n) => n("/rebuttals"), search: "rebuttal opponent prep debate" },
    { id: "nav-past", label: "Past Work", hint: "Saved audits", icon: FolderOpen, run: (n) => n("/past-work"), search: "past saved history audits" },
    { id: "nav-settings", label: "Settings & profile", hint: "Defaults, role, event", icon: Settings, run: (n) => n("/settings"), search: "settings prefs profile role" },
    { id: "nav-about", label: "How Fracture works", hint: "Methods & scoring", icon: BookOpen, run: (n) => n("/about"), search: "about methods scoring docs" },
    { id: "nav-blog", label: "Blog", hint: "Coaching notes", icon: Newspaper, run: (n) => n("/blog"), search: "blog articles" }
  ];
}

function quickActions() {
  return [
    { id: "new-audit", label: "Start a new audit", hint: "Paste a draft in the Studio", icon: Sparkles, run: (n) => n("/studio"), search: "new audit draft paste" },
    { id: "new-goal", label: "Create a goal", hint: "Set a target and get a training plan", icon: Flag, run: (n) => n("/dashboard?goal=1"), search: "goal target tournament plan" },
    { id: "drill", label: "Pick a drill to practice", hint: "Timed practice on a skill", icon: Target, run: (n) => n("/practice"), search: "drill practice skill train" }
  ];
}

function matches(q, text) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

export default function CommandPalette() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [projects, setProjects] = useState(null);
  const inputRef = useRef(null);

  // Global open: Cmd/Ctrl+K, or the nav search button (custom event).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Reset + lazily load data each time it opens.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setIdx(0);
    if (user && projects === null) {
      listProjects(user.id).then(setProjects).catch(() => setProjects([]));
    }
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const goals = useMemo(() => {
    if (user) return null; // goals load async via dashboard; skip in palette for signed-in
    return loadLocalGoals().filter((g) => g.status !== "done" && g.status !== "archived").slice(0, 4);
  }, [user, open]);

  const items = useMemo(() => {
    const list = [];
    for (const a of quickActions()) list.push({ ...a, group: "Actions" });
    for (const a of pageActions()) list.push({ ...a, group: "Go to" });
    if (user && projects) {
      for (const p of projects.slice(0, 6)) {
        list.push({
          id: "project-" + p.id,
          label: p.title || "Untitled draft",
          hint: `Saved audit · ${p.score != null ? p.score + "/100" : "no score"}`,
          icon: FolderOpen,
          run: (n) => { sessionStorage.setItem("fracture_continue", JSON.stringify({ draft: p.draft, audit: p.audit, mode: p.mode })); n("/studio"); },
          search: `saved ${p.title || ""} ${p.draft || ""}`.slice(0, 400)
        });
      }
    }
    if (!user && goals) {
      for (const g of goals) {
        list.push({ id: "goal-" + g.id, label: `Goal: ${g.text}`, hint: g.targetDate ? `Target ${g.targetDate}` : "Active goal", icon: Flag, run: (n) => n("/dashboard"), search: `goal ${g.text}` });
      }
    }
    for (const d of DRILLS.slice(0, 6)) {
      list.push({ id: "drill-" + d.id, label: `Drill: ${d.title}`, hint: `${d.minutes} min · ${d.difficulty}`, icon: Target, run: (n) => n(`/practice?drill=${d.id}`), search: `drill ${d.title} ${d.skills.join(" ")} ${d.tagline}` });
    }
    return list;
  }, [user, projects, goals]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items.slice(0, 14);
    return items.filter((i) => matches(q, `${i.label} ${i.hint} ${i.search || ""}`)).slice(0, 14);
  }, [items, q]);

  useEffect(() => setIdx(0), [q]);

  if (!open) return null;

  function run(item) {
    setOpen(false);
    item.run(navigate);
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[16vh] px-4" onClick={() => setOpen(false)}>
      <div className="card w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b hair">
          <Search size={16} className="faint shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && filtered[idx]) run(filtered[idx]);
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search pages, saved work, drills, goals…"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-600"
          />
          <kbd className="hidden sm:inline-flex text-[10px] font-mono faint border hair rounded-sm px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 && <p className="px-4 py-6 text-sm faint text-center">No matches — try “drill”, “saved”, or a page name.</p>}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              onClick={() => run(item)}
              onMouseEnter={() => setIdx(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === idx ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}
            >
              <item.icon size={16} className="faint shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{item.label}</div>
                <div className="text-xs faint truncate">{item.hint}</div>
              </div>
              {i === idx && <CornerDownLeft size={13} className="faint shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}
