import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function StudioAccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-screen items-center justify-center px-6"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="w-full max-w-lg rounded-sm border border-zinc-900 bg-zinc-950/80 p-10 text-center" id="main">
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Studio Access</p>
          <h1 className="mt-4 font-serif text-5xl italic">Enter the room.</h1>
          <p className="mt-5 text-sm leading-7 text-zinc-400">
            Lightweight gate before the workspace. Critique, citations, and rebuttals call the same secured{' '}
            <code className="text-zinc-300">/api/chat</code> route; errors show HTTP status and codes when the server sends
            them.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              className="rounded-sm border border-zinc-800 px-6 py-3 font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
              to="/"
            >
              Back
            </Link>
            <Link
              className="rounded-sm bg-white px-8 py-3 font-bold text-black transition-colors hover:bg-zinc-100"
              to="/studio/dashboard"
            >
              Continue
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
