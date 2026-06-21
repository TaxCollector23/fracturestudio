import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, Target, GitBranch, ShieldCheck, Clock, BookOpen, Quote,
  ClipboardPaste, ScanSearch, FileCheck2, Layers, AlertTriangle, Swords,
  Link2, PenLine, GraduationCap, Globe2, Microscope, Check, X
} from "lucide-react";

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

const STEPS = [
  { icon: ClipboardPaste, n: "01", t: "Paste your draft", d: "Drop in any speech, essay, debate case, position paper, or research paper — up to 40,000 characters. Choose a mode and how deep you want the read to go." },
  { icon: ScanSearch, n: "02", t: "Fracture runs five lenses", d: "It reads for thesis, logic, evidence, structure, and revision — then searches public sources for your factual claims before it grades, so the score reflects what's actually real." },
  { icon: FileCheck2, n: "03", t: "Get a calibrated report", d: "A 0–100 score, the collapse point, claim-by-claim ratings, and finished rewrites you can paste straight in. Save it, export a PDF, or keep refining in Fracture Chat." }
];

const REPORT = [
  { icon: Target, t: "Score + 4-part breakdown", d: "An honest 0–100 with thesis, reasoning, evidence, and structure scored separately — never inflated, never lowballed." },
  { icon: AlertTriangle, t: "Collapse point", d: "The one claim everything depends on, the strongest attack on it, and the best defense." },
  { icon: Layers, t: "Claim-by-claim map", d: "Every major claim rated, with its warrant and the exact reasoning step it skips." },
  { icon: GitBranch, t: "Hidden assumption audit", d: "The unstated ideas your argument quietly relies on — and what breaks if a reader rejects them." },
  { icon: Swords, t: "Opponent attack tree", d: "How a skilled opponent or skeptical grader comes after your case, with the exact response to give." },
  { icon: Link2, t: "Evidence & citation checks", d: "Live web results for your factual claims, support status, and MLA/APA-ready citations." }
];

const AUDIENCES = [
  { icon: Swords, t: "Debaters", d: "Walk into the round knowing every crack in your case. Attack trees, crossfire questions, and weighing lines, ranked by how much damage they do." },
  { icon: GraduationCap, t: "Students & essayists", d: "Thesis sharpening, paragraph-by-paragraph structure, evidence integration, and the weakest sentence rewritten — graded the way a tough teacher would." },
  { icon: Globe2, t: "Model UN delegates", d: "Position-paper pressure tests, country-accuracy flags, and resolution clauses in real operative-clause style before committee." },
  { icon: Microscope, t: "Researchers", d: "Claim-to-citation alignment, source-quality checks, and conclusion-overreach flags so your paper holds up to review." }
];

const COMPARE = [
  ["Quotes the exact sentence that fails", true],
  ["Checks your facts against the live web before grading", true],
  ["Gives a calibrated, defensible score", true],
  ["Hands you finished, paste-ready rewrites", true],
  ["Finds the collapse point and dependency chain", true],
  ["Generic 'add more evidence' advice", false],
  ["Vague praise that fits any essay", false],
  ["Invents sources or statistics", false]
];

const FAQ = [
  { q: "Is this just a grammar checker?", a: "No. Fracture grades reasoning first — thesis, warrants, assumptions, evidence, and structure. Grammar and style are flagged, but they never dominate a report when the logic is what needs work." },
  { q: "Can a draft actually score 100?", a: "Yes. If the writing is genuinely strong for its level — clear arguable thesis, reasoning that holds, supported claims, sound structure, no real issues — Fracture awards it. It never invents flaws to avoid a perfect score." },
  { q: "Where does the evidence checking come from?", a: "Before grading, Fracture searches public web pages for your factual claims, compares them to the retrieved text, and reports support status with links. Everything is marked tentative — open the source before you rely on it." },
  { q: "Do you store my writing?", a: "Only when you choose to Save. Saved drafts and reports live in your account so you can reopen them in Past Work. Nothing is saved unless you sign in and save it yourself." }
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
            <span className="italic font-normal text-zinc-500 dark:text-zinc-600">Strengthen every conclusion.</span>
          </motion.h1>
          <motion.p {...up(0.2)} className="text-lg muted max-w-2xl mb-10 leading-relaxed">
            An elite workspace for debaters, writers, and Model UN delegates. Fracture Studio uses adversarial AI to dismantle your logic before your opponents can.
          </motion.p>
          <motion.div {...up(0.3)} className="flex flex-wrap gap-3 justify-center">
            <Link to="/studio" className="btn-solid">Start Drafting <ArrowRight size={16} /></Link>
            <Link to="/about" className="btn-ghost">How it works</Link>
          </motion.div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 pb-28 max-w-6xl mx-auto">
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

      {/* How it works */}
      <section className="border-t hair px-6 py-28 max-w-6xl mx-auto">
        <motion.div {...up(0)} className="label-mono mb-3">The process</motion.div>
        <motion.h2 {...up(0.05)} className="font-serif text-3xl md:text-5xl mb-14 max-w-3xl">From rough draft to defensible argument in three moves.</motion.h2>
        <div className="grid md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <motion.div key={s.n} {...up(i * 0.1)} className="relative">
              <div className="font-mono text-xs faint mb-4">{s.n}</div>
              <s.icon size={24} className="mb-4" />
              <h3 className="font-serif text-2xl mb-2">{s.t}</h3>
              <p className="muted text-sm leading-relaxed">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What's in every report */}
      <section className="border-t hair px-6 py-28 max-w-6xl mx-auto">
        <motion.div {...up(0)} className="label-mono mb-3">Inside the report</motion.div>
        <motion.h2 {...up(0.05)} className="font-serif text-3xl md:text-5xl mb-3 max-w-3xl">Every audit is a complete teardown.</motion.h2>
        <motion.p {...up(0.1)} className="muted mb-12 max-w-2xl">Not a paragraph of feedback — a structured report you can act on line by line.</motion.p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT.map((r, i) => (
            <motion.div key={r.t} {...up((i % 3) * 0.06)} className="card p-6">
              <r.icon size={20} className="text-zinc-500 mb-4" />
              <h3 className="font-serif text-lg mb-1.5">{r.t}</h3>
              <p className="muted text-sm leading-relaxed">{r.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Audiences */}
      <section className="border-t hair px-6 py-28 max-w-6xl mx-auto">
        <motion.div {...up(0)} className="label-mono mb-3">Built for serious work</motion.div>
        <motion.h2 {...up(0.05)} className="font-serif text-3xl md:text-5xl mb-14 max-w-3xl">Tuned to how you actually compete and write.</motion.h2>
        <div className="grid md:grid-cols-2 gap-4">
          {AUDIENCES.map((a, i) => (
            <motion.div key={a.t} {...up((i % 2) * 0.08)} className="card card-hover p-7 flex gap-5">
              <a.icon size={24} className="shrink-0 mt-1" />
              <div>
                <h3 className="font-serif text-2xl mb-2">{a.t}</h3>
                <p className="muted text-sm leading-relaxed">{a.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="border-t hair px-6 py-28 max-w-4xl mx-auto">
        <motion.div {...up(0)} className="label-mono mb-3">Why not just a chatbot</motion.div>
        <motion.h2 {...up(0.05)} className="font-serif text-3xl md:text-5xl mb-12">The difference is specificity.</motion.h2>
        <div className="card divide-y hair">
          {COMPARE.map(([text, yes]) => (
            <motion.div key={text} {...up(0)} className="flex items-center gap-4 p-4">
              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${yes ? "bg-green-500/15 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {yes ? <Check size={14} /> : <X size={14} />}
              </span>
              <span className={`text-sm ${yes ? "" : "muted line-through decoration-zinc-600"}`}>{text}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t hair px-6 py-28 max-w-4xl mx-auto">
        <motion.div {...up(0)} className="label-mono mb-3">Questions</motion.div>
        <motion.h2 {...up(0.05)} className="font-serif text-3xl md:text-5xl mb-12">Good to know.</motion.h2>
        <div className="space-y-4">
          {FAQ.map((f, i) => (
            <motion.div key={f.q} {...up(i * 0.05)} className="card p-6">
              <h3 className="font-serif text-xl mb-2">{f.q}</h3>
              <p className="muted text-sm leading-relaxed">{f.a}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t hair px-6 py-28 text-center">
        <motion.h2 {...up(0)} className="font-serif text-4xl md:text-6xl mb-4">Find the fracture before they do.</motion.h2>
        <motion.p {...up(0.05)} className="muted mb-8 max-w-xl mx-auto">Paste a draft and get an honest, surgical read in under a minute.</motion.p>
        <motion.div {...up(0.1)}>
          <Link to="/studio" className="btn-solid">Open the Studio <ArrowRight size={16} /></Link>
        </motion.div>
      </section>

      <footer className="border-t hair px-6 py-10 text-center">
        <p className="faint text-xs font-mono uppercase tracking-widest">Fracture Studio — Argument Analysis Engine</p>
      </footer>
    </div>
  );
}
