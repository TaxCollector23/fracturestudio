import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, Shield, Zap } from 'lucide-react';

const landingCards = [
  {
    icon: Shield,
    title: 'Methodology',
    copy: 'Interrogate each claim for weak links, hidden assumptions, and unsupported leaps before an opponent does.',
    to: '/methodology',
  },
  {
    icon: Zap,
    title: 'Manifesto',
    copy: 'Good arguments survive pressure. Fracture Studio exposes fragile reasoning while there is still time to rewrite.',
    to: '/manifesto',
  },
  {
    icon: Plus,
    title: 'Studio',
    copy: 'Critique, citations, and rebuttals in one workspace—keys stay on the server.',
    to: '/studio/access',
  },
];

export function LandingPage() {
  return (
    <motion.main
      animate={{ opacity: 1, y: 0 }}
      className="px-6 pb-24 pt-20 sm:px-12"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <section className="mx-auto flex max-w-6xl flex-col gap-10 border-b border-zinc-900 pb-20 text-center">
        <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Argument Intelligence</p>
        <h1 className="font-serif text-6xl leading-none tracking-tight sm:text-8xl lg:text-[9vw]">
          Construct logic
          <br />
          <span className="text-zinc-600 italic">that cannot break.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
          Pressure-test a draft before it meets an audience. Quote-backed critique, citation helpers, and rebuttal maps—
          with loading states and explicit errors when the model or network fails.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            className="rounded-sm bg-zinc-100 px-10 py-5 text-lg font-bold text-zinc-950 transition-colors hover:bg-white"
            to="/studio/access"
          >
            Start Drafting
          </Link>
          <Link
            className="rounded-sm border border-zinc-800 px-10 py-5 text-lg font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
            to="/methodology"
          >
            See the Method
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 py-20 md:grid-cols-3">
        {landingCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link className="group rounded-sm border border-zinc-900 bg-zinc-950/70 p-8 transition-colors hover:border-zinc-700" key={card.title} to={card.to}>
              <Icon className="mb-6 h-6 w-6 text-zinc-300 group-hover:text-zinc-100" aria-hidden />
              <h2 className="mb-3 font-serif text-3xl italic">{card.title}</h2>
              <p className="text-sm leading-7 text-zinc-400">{card.copy}</p>
              <span className="mt-4 inline-block text-xs font-semibold uppercase tracking-wide text-zinc-500 group-hover:text-zinc-300">
                Open →
              </span>
            </Link>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl border-t border-zinc-900 py-16 text-center text-sm text-zinc-500">
        <p>
          Prefer the full write-ups? Read the{' '}
          <Link className="text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/methodology">
            methodology
          </Link>{' '}
          and{' '}
          <Link className="text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/manifesto">
            manifesto
          </Link>
          , or jump straight to the{' '}
          <Link className="text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/docs">
            docs
          </Link>
          .
        </p>
      </section>
    </motion.main>
  );
}
