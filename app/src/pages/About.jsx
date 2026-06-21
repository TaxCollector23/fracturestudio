import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const up = (d = 0) => ({
  initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-10%" }, transition: { duration: 0.6, delay: d }
});

const LENSES = [
  { n: "01", t: "Claim & thesis", d: "Is the central claim clear, arguable, and actually proven by the body? Does every paragraph connect back to it?" },
  { n: "02", t: "Logic & reasoning", d: "Where does the reasoning not follow — unsupported jumps, contradictions, conclusions stronger than the evidence allows?" },
  { n: "03", t: "Evidence & support", d: "Are the load-bearing claims backed? Before grading, Fracture checks your factual claims against the live web." },
  { n: "04", t: "Structure & flow", d: "Does the intro set up the argument, does each paragraph do one job, does the conclusion earn its place?" },
  { n: "05", t: "Revision & tone", d: "The findings become the fewest, highest-impact moves — direct, fair, and paste-ready." }
];

const BANDS = [
  ["95–100", "Outstanding — no critical, major, or moderate issues."],
  ["85–94", "Excellent with a few real, fixable gaps."],
  ["70–84", "Solid, but at least one major weakness a reader would act on."],
  ["50–69", "Serious structural, reasoning, or evidence problems."],
  ["< 50", "The central argument does not hold."]
];

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-12">
      <motion.div {...up(0)}>
        <div className="label-mono mb-2">Methods</div>
        <h1 className="font-serif text-4xl md:text-6xl mb-4 leading-tight">How Fracture reads your writing.</h1>
        <p className="muted text-lg leading-relaxed max-w-2xl">Fracture is not a grammar checker. It runs five analytical lenses over your draft, checks your evidence against the live web, then scores you the way a coach, a judge, and a fact-checker would together.</p>
      </motion.div>

      <motion.div {...up(0.1)} className="grid md:grid-cols-2 gap-4 mt-12">
        {LENSES.map((l) => (
          <div key={l.n} className="card p-6">
            <div className="font-mono text-xs faint mb-3">{l.n}</div>
            <h3 className="font-serif text-xl mb-2">{l.t}</h3>
            <p className="muted text-sm leading-relaxed">{l.d}</p>
          </div>
        ))}
      </motion.div>

      <motion.div {...up(0.15)} className="mt-12">
        <h2 className="font-serif text-3xl mb-5">How scoring works</h2>
        <div className="card divide-y hair">
          {BANDS.map(([range, desc]) => (
            <div key={range} className="flex items-center gap-5 p-4">
              <div className="font-serif text-2xl w-24 shrink-0">{range}</div>
              <div className="muted text-sm">{desc}</div>
            </div>
          ))}
        </div>
        <p className="faint text-sm mt-4">A perfect 100 is reachable — Fracture never invents flaws to avoid a high score, and never inflates past real problems.</p>
      </motion.div>

      <motion.div {...up(0.2)} className="mt-12 text-center card p-10">
        <h2 className="font-serif text-3xl mb-3">Put a draft through it.</h2>
        <Link to="/studio" className="btn-solid inline-flex mt-2">Open the Studio</Link>
      </motion.div>
    </div>
  );
}
