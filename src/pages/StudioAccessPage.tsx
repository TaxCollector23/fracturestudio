import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, Network, ShieldCheck, Swords } from 'lucide-react';

const launchers = [
  {
    title: 'Fracture pass',
    copy: 'Score logic, evidence, clarity, originality, and rebuttal readiness.',
    icon: ShieldCheck,
  },
  {
    title: 'Citation pass',
    copy: 'Search source metadata, format MLA or APA, and bind evidence to claims.',
    icon: BookOpen,
  },
  {
    title: 'Rebuttal pass',
    copy: 'Predict opponent moves and build crossfire questions from the case.',
    icon: Swords,
  },
  {
    title: 'Structure pass',
    copy: 'Turn the draft into thesis, claims, evidence, warrants, and impact.',
    icon: Network,
  },
];

export function StudioAccessPage() {
  return (
    <div className="min-h-screen bg-[#09090b] px-6 py-12 text-zinc-50 sm:px-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        id="main"
      >
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section>
            <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Studio Access</p>
            <h1 className="mt-4 font-serif text-6xl italic leading-none sm:text-7xl">Choose the pressure test.</h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-zinc-400">
              Open the workspace with a focused path, then switch tabs any time. The local engine always produces a usable
              report; a configured server model can deepen the run.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="bg-white px-8 py-3 text-center font-bold text-black transition-colors hover:bg-zinc-100" to="/studio/dashboard">
                Go to dashboard
              </Link>
              <Link className="border border-zinc-700 px-8 py-3 text-center font-medium text-zinc-200 hover:border-zinc-500" to="/">
                Back home
              </Link>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            {launchers.map((launcher) => {
              const Icon = launcher.icon;
              return (
                <Link className="border border-zinc-900 bg-[#0c0c0e] p-6 transition-colors hover:border-zinc-700" key={launcher.title} to="/studio/case">
                  <Icon className="h-5 w-5 text-zinc-300" />
                  <h2 className="mt-5 font-serif text-3xl italic">{launcher.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{launcher.copy}</p>
                </Link>
              );
            })}
          </section>
        </div>

        <section className="mt-12 border-t border-zinc-900 pt-10">
          <div className="border border-zinc-800 bg-[#0c0c0e] p-6">
            <ClipboardCheck className="mb-4 h-5 w-5 text-zinc-300" />
            <p className="max-w-3xl text-sm leading-7 text-zinc-400">
              Fracture Studio keeps drafts, rubric notes, source text, and opponent prep in browser storage for the active
              case. Every control opens a real workspace surface.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
