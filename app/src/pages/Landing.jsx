import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Target, GitBranch, ShieldCheck, Clock, BookOpen, Quote } from "lucide-react";

const up = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10%" },
  transition: { duration: 0.7, delay, ease: "easeOut" }
});

const FEATURES = [
  { icon: Target, title: "Collapse-point detection", body: "Fracture finds the single load-bearing claim your whole argument rests on — and shows exactly what breaks if it falls." },
  { icon: GitBranch, title: "Argument dependency map", body: "See how every claim, warrant, and assumption connects, so you fix the cause, not the symptom." },
  { icon: ShieldCheck, title: "Live evidence checks", body: "Before grading, Fracture searches the web for your factual claims and scores you on what's actually verifiable." },
  { icon: Clock, title: "Full audit in under a minute", body: "Paste a draft and get a calibrated score, priority fixes, and rewrites you can paste straight back in." },
  { icon: BookOpen, title: "Six analysis modes", body: "Argument, speech, essay, research paper, rubric grading, and Model UN — each with its own rubric." }
];

export default function Landing() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative pt-24 pb-40 px-6 flex flex-col items-center text-center">
        <div className="absolute inset-0 text-zinc-300 dark:text-zinc-800 bg-grid opacity-[0.06] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white dark:to-zinc-950 pointer-events-none" />
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center">
          <motion.div {...up(0)} className="pill mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Fracture Engine is live
          </motion.div>
          <motion.h1 {...up(0.1)} className="font-serif text-5xl md:text-[7vw] leading-[0.95] tracking-tight mb-8 text-zinc-950 dark:text-white">
            Stress-test every claim.<br />
            <span className="italic">Strengthen every conclusion.</span>
          </motion.h1>
          <motion.p {...up(0.2)} className="text-lg muted max-w-2xl mb-10 leading-relaxed">
            An elite workspace for debaters, writers, and Model UN delegates. Fracture Studio uses adversarial AI to dismantle your logic before your opponents — or your grader — can.
          </motion.p>
          <motion.div {...up(0.3)} className="flex flex-wrap gap-3 justify-center">
            <Link to="/studio" className="btn-solid">Start Drafting <ArrowRight size={16} /></Link>
            <Link to="/about" className="btn-ghost">How it works</Link>
          </motion.div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 pb-32 max-w-6xl mx-auto">
        <motion.h2 {...up(0)} className="font-serif text-3xl md:text-5xl mb-3">Everything an argument needs to survive.</motion.h2>
        <motion.p {...up(0.05)} className="muted mb-12 max-w-2xl">Not a grammar checker. A reasoning engine that reads like a coach, a judge, and a fact-checker working together.</motion.p>
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...up(i * 0.06)} className="card card-hover p-7 group">
              <f.icon size={22} className="text-zinc-500 group-hover:text-zinc-950 dark:group-hover:text-zinc-100 transition-colors mb-5" />
              <h3 className="font-serif text-xl mb-2">{f.title}</h3>
              <p className="muted text-sm leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
          <motion.div {...up(0.3)} className="card p-7 flex flex-col justify-between bg-zinc-950 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-950 border-transparent">
            <Quote size={22} className="opacity-60 mb-5" />
            <div>
              <h3 className="font-serif text-xl mb-2">Ready to fracture a draft?</h3>
              <Link to="/studio" className="inline-flex items-center gap-2 text-sm font-medium mt-2">Open the Studio <ArrowRight size={15} /></Link>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t hair px-6 py-10 text-center">
        <p className="faint text-xs font-mono uppercase tracking-widest">Fracture Studio — Argument Analysis Engine</p>
      </footer>
    </div>
  );
}
