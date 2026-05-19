import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gauge, Moon, RefreshCw, Settings as SettingsIcon, SlidersHorizontal, Sun, TerminalSquare } from 'lucide-react';

const preferenceGroups = [
  {
    title: 'Interface',
    description: 'Keep the workspace quiet, dense, and fast to scan.',
    items: ['Dark and light mode are available from the floating control.', 'Every page keeps direct access to Home and Studio.', 'Typed output is shown as plain report text.'],
  },
  {
    title: 'Engine Defaults',
    description: 'Choose the mode before running analysis so the app starts blank.',
    items: ['No example claim is preloaded.', 'Feedback waits for a deliberate run command.', 'Speed mode stays available for rapid debate prep.'],
  },
  {
    title: 'Output Style',
    description: 'Reports are built for users, not raw model dumps.',
    items: ['No markdown tables in visible AI output.', 'No decorative emoji in engine responses.', 'Double-click a report to ask Fracture Chat about it.'],
  },
];

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] px-6 py-10 text-zinc-50 sm:px-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="flex flex-col gap-6 border-b border-zinc-900 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-zinc-100 text-zinc-950">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <p className="mt-7 text-xs uppercase tracking-[0.45em] text-zinc-500">Settings</p>
            <h1 className="mt-3 font-serif text-5xl italic leading-none sm:text-6xl">Studio preferences.</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400">
              Fracture is set up as a local-first studio surface. The controls here describe how the product behaves without adding account friction.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex items-center justify-center gap-2 border border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100" to="/">
              <RefreshCw className="h-4 w-4" />
              Home
            </Link>
            <Link className="inline-flex items-center justify-center gap-2 bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950" to="/studio/dashboard">
              <TerminalSquare className="h-4 w-4" />
              Studio
            </Link>
          </div>
        </div>

        <section className="grid gap-5 py-8 lg:grid-cols-3">
          {preferenceGroups.map((group) => (
            <article className="border border-zinc-800 bg-[#0c0c0e] p-5 sm:p-6" key={group.title}>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-950 text-zinc-200">
                {group.title === 'Interface' ? <SlidersHorizontal className="h-4 w-4" /> : group.title === 'Engine Defaults' ? <Gauge className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-zinc-500">{group.title}</p>
              <h2 className="mt-3 font-serif text-3xl italic text-zinc-100">{group.description}</h2>
              <div className="mt-6 grid gap-3">
                {group.items.map((item) => (
                  <div className="border border-zinc-900 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300" key={item}>{item}</div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="border border-zinc-800 bg-[#0c0c0e] p-5 sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Theme Control</p>
              <h2 className="mt-3 font-serif text-4xl italic text-zinc-100">Use the floating switch for light or dark mode.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                The toggle stays available on every routed page with Home and Studio shortcuts beside it.
              </p>
            </div>
            <div className="flex items-center gap-3 border border-zinc-900 bg-zinc-950/70 p-3">
              <Sun className="h-5 w-5 text-zinc-400" />
              <div className="h-2 w-24 rounded-full bg-white" />
              <Moon className="h-5 w-5 text-zinc-400" />
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
