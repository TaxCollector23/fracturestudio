import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert, Library, Inbox, Timer, BookOpen, Layers, HelpCircle, Compass,
  Clock, ArrowRight, Sparkles
} from "lucide-react";
import { listItems } from "../lib/prep.js";
import { useAuth } from "../lib/useAuth.jsx";

const HUBS = [
  { to: "/prep/cases", icon: ShieldAlert, title: "Case Builder", body: "Structured contentions with claim, warrant, evidence, impact — plus a live completeness check, versions, and AI stress tests." },
  { to: "/prep/library", icon: Library, title: "Argument Library", body: "Evidence, blocks, response trees, and cross-ex questions — searchable, tagged, reusable across every case." },
  { to: "/prep/inbox", icon: Inbox, title: "Research Inbox", body: "Capture quotes, sources, and ideas fast; move them into evidence, blocks, trees, or topics later." },
  { to: "/prep/round", icon: Timer, title: "Round Prep", body: "Timed, distraction-free prep with a persistent clock, predictions, and responses. Nothing locks when time ends." },
  { to: "/prep/topics", icon: BookOpen, title: "Knowledge Base", body: "Topic workspaces: definitions, pro/con arguments, strategies, questions — with related items surfaced by tag." },
  { to: "/prep/flashcards", icon: Layers, title: "Flashcards", body: "Spaced-repetition cards for arguments, evidence, and responses — generate a deck straight from your library." },
  { to: "/prep/outlines", icon: Clock, title: "Speech Timer", body: "Section-by-section time allocation with a rehearsal clock and over/under tracking. Save templates per event." },
  { to: "/prep/strategy", icon: Compass, title: "Strategy", body: "Compare approaches with benefits and risks — structured thinking before the round starts." }
];

const WORKFLOW = ["Research", "Collect", "Organize", "Build", "Stress test", "Prepare responses", "Practice", "Enter round"];

export default function PrepHub() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [cases, evidence, blocks, inbox] = await Promise.all([
          listItems("cases"), listItems("evidence"), listItems("blocks"), listItems("inbox")
        ]);
        if (mounted) setStats({ cases: cases.length, evidence: evidence.length, blocks: blocks.length, inbox: inbox.filter((i) => i.status === "unprocessed").length });
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2">Prep Workspace</div>
      <h1 className="font-serif text-4xl md:text-5xl mb-3">Before the round starts.</h1>
      <p className="muted text-sm max-w-2xl mb-5 leading-relaxed">
        Everything between research and the round: build the case, stress-test it, collect evidence and blocks,
        prepare responses, then time your prep and your speech. Every piece connects — evidence links into cases,
        blocks attach to arguments, inbox items become cards, and library content feeds flashcards.
      </p>

      {!user && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm muted">Working as a guest — content saves on this device. Sign in to keep your prep workspace across devices.</p>
          <Link to="/auth" className="btn-solid py-2 px-4 text-xs">Sign in</Link>
        </div>
      )}

      <Link to="/research" className="card card-hover p-4 mb-6 flex flex-wrap items-center justify-between gap-3 group">
        <div className="flex items-center gap-3">
          <Library size={18} className="text-zinc-500 group-hover:text-zinc-950 dark:group-hover:text-zinc-100 transition-colors" />
          <div>
            <h3 className="font-serif text-lg leading-tight">Research Intelligence & Citation Engine</h3>
            <p className="muted text-xs mt-0.5">Structured sources with MLA / APA / Chicago / debate citations, evidence cards, research gaps, and a bibliography builder.</p>
          </div>
        </div>
        <span className="text-xs muted group-hover:text-zinc-950 dark:group-hover:text-zinc-100 inline-flex items-center gap-1">Open research <ArrowRight size={12} /></span>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 mb-8">
        {WORKFLOW.map((w, i) => (
          <span key={w} className="inline-flex items-center gap-1.5">
            <span className="pill">{w}</span>
            {i < WORKFLOW.length - 1 && <ArrowRight size={12} className="faint" />}
          </span>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {HUBS.map((h) => (
          <Link key={h.to} to={h.to} className="card card-hover p-5 flex flex-col group">
            <div className="flex items-center justify-between mb-3">
              <h.icon size={20} className="text-zinc-500 group-hover:text-zinc-950 dark:group-hover:text-zinc-100 transition-colors" />
              <span className="faint opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight size={14} /></span>
            </div>
            <h3 className="font-serif text-lg mb-1.5">{h.title}</h3>
            <p className="muted text-sm leading-relaxed">{h.body}</p>
          </Link>
        ))}
      </div>

      {stats && (
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4"><div className="font-serif text-3xl">{stats.cases}</div><div className="label-mono mt-1">Cases</div></div>
          <div className="card p-4"><div className="font-serif text-3xl">{stats.evidence}</div><div className="label-mono mt-1">Evidence cards</div></div>
          <div className="card p-4"><div className="font-serif text-3xl">{stats.blocks}</div><div className="label-mono mt-1">Blocks</div></div>
          <Link to="/prep/inbox" className="card card-hover p-4 block"><div className="font-serif text-3xl">{stats.inbox}</div><div className="label-mono mt-1">Inbox items <Sparkles size={11} className="inline text-amber-500" /></div></Link>
        </div>
      )}
    </div>
  );
}
