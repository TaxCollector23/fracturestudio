import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, Network, PenTool, ShieldCheck, Swords } from 'lucide-react';

const templates = [
  {
    title: 'Debate case',
    copy: 'Build claim, warrant, impact, blocks, and crossfire prep.',
    icon: Swords,
  },
  {
    title: 'Analytical essay',
    copy: 'Stress-test thesis precision, paragraph proof, and quote integration.',
    icon: PenTool,
  },
  {
    title: 'Research brief',
    copy: 'Link sources to claims and catch citation gaps before submission.',
    icon: BookOpen,
  },
  {
    title: 'Speech draft',
    copy: 'Shape attention, need, solution, visualization, and action.',
    icon: Network,
  },
];

type SavedCase = {
  title?: string;
  content?: string;
  sourcesText?: string;
  opponentText?: string;
  rubric?: string;
};

export function StudioDashboardPage() {
  const [saved, setSaved] = useState<SavedCase | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('fracture-studio-current-case');
      setSaved(raw ? (JSON.parse(raw) as SavedCase) : null);
    } catch {
      setSaved(null);
    }
  }, []);

  const hasDraft = Boolean(saved?.content?.trim());
  const wordCount = saved?.content?.trim() ? saved.content.trim().split(/\s+/).length : 0;

  return (
    <div className="min-h-screen bg-[#09090b] px-6 py-10 text-zinc-50 sm:px-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-7xl"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        id="main"
      >
        <div className="flex flex-col gap-6 border-b border-zinc-900 pb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Workspace</p>
            <h1 className="mt-3 font-serif text-5xl italic sm:text-6xl">Build the case that survives.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
              Start with a draft, then move through graph, citations, rebuttals, crossfire, rubric alignment, and export.
            </p>
          </div>
          <Link className="bg-white px-6 py-3 text-center font-bold text-black transition-colors hover:bg-zinc-100" to="/studio/case">
            {hasDraft ? 'Resume Case' : 'New Case'}
          </Link>
        </div>

        <section className="grid gap-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="border border-zinc-800 bg-[#0c0c0e] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Current Case</p>
                <h2 className="mt-4 font-serif text-4xl italic text-zinc-100">{saved?.title || 'No active case yet'}</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div className="mt-6 grid gap-3 text-sm text-zinc-400 sm:grid-cols-2">
              <div className="border border-zinc-900 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Draft words</p>
                <p className="mt-2 text-2xl text-zinc-100">{wordCount}</p>
              </div>
              <div className="border border-zinc-900 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Research lines</p>
                <p className="mt-2 text-2xl text-zinc-100">{saved?.sourcesText?.split(/\n+/).filter(Boolean).length || 0}</p>
              </div>
              <div className="border border-zinc-900 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Opponent prep</p>
                <p className="mt-2 text-2xl text-zinc-100">{saved?.opponentText?.trim() ? 'Ready' : 'Open'}</p>
              </div>
              <div className="border border-zinc-900 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Rubric</p>
                <p className="mt-2 text-2xl text-zinc-100">{saved?.rubric?.trim() ? 'Loaded' : 'Open'}</p>
              </div>
            </div>
          </article>

          <article className="border border-zinc-800 bg-[#0c0c0e] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Next Best Moves</p>
            <div className="mt-5 space-y-4">
              {[
                'Write or paste the thesis and main body.',
                'Run Fracture to locate the collapse point.',
                'Add sources and bind each source to a specific claim.',
                'Paste opponent material and rehearse crossfire.',
              ].map((item, index) => (
                <div className="flex gap-3 border-t border-zinc-900 pt-4" key={item}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-zinc-100 text-xs font-bold text-black">{index + 1}</span>
                  <p className="text-sm leading-6 text-zinc-300">{item}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-5 border-t border-zinc-900 py-10 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <Link className="group border border-zinc-900 bg-[#0c0c0e] p-6 transition-colors hover:border-zinc-700" key={template.title} to="/studio/case">
                <Icon className="h-5 w-5 text-zinc-400 group-hover:text-zinc-100" />
                <h2 className="mt-5 font-serif text-3xl italic text-zinc-100">{template.title}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{template.copy}</p>
              </Link>
            );
          })}
        </section>

        <section className="border-t border-zinc-900 py-10">
          <div className="flex flex-col gap-4 border border-zinc-800 bg-[#0c0c0e] p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <ClipboardCheck className="mb-4 h-5 w-5 text-zinc-300" />
              <p className="max-w-2xl text-sm leading-7 text-zinc-400">
                The workspace saves the active case in this browser, so local drafting, citations, opponent prep, and rubric
                notes stay together between sessions.
              </p>
            </div>
            <Link className="border border-zinc-700 px-5 py-3 text-center text-sm font-medium text-zinc-100 hover:border-zinc-500" to="/features">
              View feature map
            </Link>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
