import { Link } from "react-router-dom";
import { ArrowRight, Compass } from "lucide-react";
import AppLogo from "../components/AppLogos.jsx";

// One entry per destination: logo name, title, one-line description.
const GROUPS = [
  {
    label: "Core",
    entries: [
      { logo: "dashboard", to: "/dashboard", title: "Dashboard", body: "Your progress, goals, and what to work on next." },
      { logo: "studio", to: "/studio", title: "Studio", body: "Paste a draft and get a full Fracture audit — score, collapse point, rewrites." }
    ]
  },
  {
    label: "Prepare",
    entries: [
      { logo: "research", to: "/research", title: "Research Intelligence", body: "Topics, sources, evidence cards, and MLA / APA / Chicago citations." },
      { logo: "prepare", to: "/prep", title: "Prep Workspace", body: "Cases, argument library, inbox, flashcards, outlines, and strategy." },
      { logo: "practice", to: "/practice", title: "Practice", body: "Timed drills that train the skills behind stronger rounds." }
    ]
  },
  {
    label: "Compete & Coach",
    entries: [
      { logo: "compete", to: "/compete", title: "Compete", body: "Tournaments, rounds, judging assignments, and ballots." },
      { logo: "coach", to: "/coach", title: "Coach", body: "Team oversight — who needs help, who's behind, where the team is improving." },
      { logo: "rebuttals", to: "/rebuttals", title: "Rebuttals", body: "Build a rebuttal plan against an opponent's case." }
    ]
  },
  {
    label: "Library & Info",
    entries: [
      { logo: "past", to: "/past-work", title: "Past Work", body: "Every saved audit, searchable and ready to reopen." },
      { logo: "blog", to: "/blog", title: "Blog", body: "Coaching notes and argument-writing guides." },
      { logo: "methods", to: "/about", title: "Methods", body: "How Fracture scores, what the numbers mean, and why." }
    ]
  },
  {
    label: "Account",
    entries: [
      { logo: "settings", to: "/settings", title: "Settings", body: "Profile, role, event defaults, and preferences." }
    ]
  }
];

export default function Explore() {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
      <div className="label-mono mb-2 flex items-center gap-1.5">
        <Compass size={12} /> Navigation
      </div>
      <h1 className="font-serif text-4xl md:text-5xl mb-3">Everything in one place.</h1>
      <p className="muted text-sm max-w-xl mb-8 leading-relaxed">
        One page for the whole app — pick up where you left off, or jump straight to the tool you need.
        Press <kbd className="font-mono text-[11px] border hair rounded-sm px-1.5 py-0.5">⌘K</kbd> anytime to search.
      </p>

      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.label}>
            <div className="label-mono mb-1">{g.label}</div>
            <div className="divide-y hair border-b hair">
              {g.entries.map((e) => (
                <Link
                  key={e.to}
                  to={e.to}
                  className="group -mx-3 flex items-center gap-4 px-3 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
                >
                  <AppLogo name={e.logo} size={42} className="shrink-0 drop-shadow-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg leading-tight group-hover:text-zinc-950 dark:group-hover:text-zinc-50 transition-colors">
                      {e.title}
                    </div>
                    <p className="muted text-sm leading-snug">{e.body}</p>
                  </div>
                  <ArrowRight size={15} className="faint shrink-0 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="faint text-xs mt-8">
        Signed out? <Link to="/auth" className="text-sky-600 dark:text-sky-400 hover:underline">Sign in</Link> to keep your work across devices — or continue as a guest.
      </p>
    </div>
  );
}
