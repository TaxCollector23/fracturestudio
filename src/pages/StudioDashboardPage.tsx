import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function StudioDashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-50 sm:px-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        id="main"
      >
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Dashboard</p>
            <h1 className="mt-3 font-serif text-5xl italic">Workspace</h1>
          </div>
          <Link className="rounded-sm bg-white px-6 py-3 font-bold text-black transition-colors hover:bg-zinc-100" to="/studio/case">
            New Case
          </Link>
        </div>

        <div className="rounded-sm border border-zinc-900 bg-zinc-950/70 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Current mode</p>
          <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">
            Open a case to run critique, citations, or rebuttals. The output panel shows loading text, then either model
            output or a single explicit error string (network, HTTP, or empty completion).
          </p>
          <p className="mt-6 text-sm text-zinc-500">
            Tip: after deploy, confirm <code className="text-zinc-300">POST /api/chat</code> from the browser network tab
            returns 200 on a tiny test prompt.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
