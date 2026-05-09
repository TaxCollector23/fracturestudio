import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Plus, Shield, Zap } from 'lucide-react';

type View = 'landing' | 'auth' | 'dashboard' | 'workspace';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  } | string;
  upstream?: {
    error?: {
      message?: string;
    };
  };
};

type NavProps = {
  enterStudio: () => void;
  goHome: () => void;
  jumpToSection: (sectionId: string) => void;
};

const landingCards = [
  {
    icon: Shield,
    title: 'Methodology',
    copy: 'Interrogate each claim for weak links, hidden assumptions, and unsupported leaps before an opponent does.',
  },
  {
    icon: Zap,
    title: 'Manifesto',
    copy: 'Good arguments survive pressure. Fracture Studio is designed to expose fragile reasoning while there is still time to rewrite.',
  },
  {
    icon: Plus,
    title: 'Studio',
    copy: 'Draft inside a focused workspace and return a direct model readout without leaving the flow of writing.',
  },
];

function extractErrorMessage(data: OpenRouterResponse | null, status: number): string {
  const upstreamMessage =
    typeof data?.error === 'string'
      ? data.error
      : data?.error?.message || data?.upstream?.error?.message;

  if (upstreamMessage) {
    return upstreamMessage;
  }

  return `Request failed with status ${status}.`;
}

function Nav({ enterStudio, goHome, jumpToSection }: NavProps) {
  return (
    <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-zinc-900 bg-zinc-950/85 px-6 backdrop-blur-md sm:px-12">
      <button className="flex items-center gap-3 text-left" onClick={goHome} type="button">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-100 font-serif text-xl font-bold italic text-zinc-950">
          f
        </div>
        <span className="font-serif text-xl italic tracking-wide">Fracture Studio</span>
      </button>
      <div className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
        <button className="transition-colors hover:text-zinc-50" onClick={() => jumpToSection('methodology')} type="button">
          Methodology
        </button>
        <button className="transition-colors hover:text-zinc-50" onClick={() => jumpToSection('manifesto')} type="button">
          Manifesto
        </button>
        <button
          className="rounded-sm bg-zinc-100 px-5 py-2 font-bold text-zinc-950 transition-colors hover:bg-white"
          onClick={enterStudio}
          type="button"
        >
          Enter Studio
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSection, setPendingSection] = useState<string | null>(null);

  useEffect(() => {
    if (view !== 'landing' || !pendingSection) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(pendingSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingSection(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingSection, view]);

  const jumpToSection = (sectionId: string) => {
    if (view !== 'landing') {
      setPendingSection(sectionId);
      setView('landing');
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const runAnalysis = async () => {
    const trimmed = content.trim();
    if (!trimmed || isLoading) {
      if (!trimmed) {
        setAnalysis('Paste a case before running analysis.');
      }
      return;
    }

    setIsLoading(true);
    setAnalysis('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Identify logic fracture points.' },
            { role: 'user', content: trimmed },
          ],
        }),
      });

      const data = (await res.json().catch(() => null)) as OpenRouterResponse | null;

      if (!res.ok) {
        throw new Error(extractErrorMessage(data, res.status));
      }

      const nextAnalysis = data?.choices?.[0]?.message?.content?.trim();
      if (!nextAnalysis) {
        throw new Error('The model returned an empty analysis.');
      }

      setAnalysis(nextAnalysis);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed.';
      setAnalysis(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div
            key="landing"
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <Nav enterStudio={() => setView('auth')} goHome={() => setView('landing')} jumpToSection={jumpToSection} />

            <main className="px-6 pb-24 pt-20 sm:px-12">
              <section className="mx-auto flex max-w-6xl flex-col gap-10 border-b border-zinc-900 pb-20 text-center">
                <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Argument Intelligence</p>
                <h1 className="font-serif text-6xl leading-none tracking-tight sm:text-8xl lg:text-[9vw]">
                  Construct logic
                  <br />
                  <span className="text-zinc-600 italic">that cannot break.</span>
                </h1>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                  Pressure-test a draft before it meets an audience. Fracture Studio turns rough reasoning into something
                  sharper, clearer, and harder to dismantle.
                </p>
                <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <button
                    className="rounded-sm bg-zinc-100 px-10 py-5 text-lg font-bold text-zinc-950 transition-colors hover:bg-white"
                    onClick={() => setView('auth')}
                    type="button"
                  >
                    Start Drafting
                  </button>
                  <button
                    className="rounded-sm border border-zinc-800 px-10 py-5 text-lg font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
                    onClick={() => jumpToSection('methodology')}
                    type="button"
                  >
                    See the Method
                  </button>
                </div>
              </section>

              <section className="mx-auto grid max-w-6xl gap-6 py-20 md:grid-cols-3">
                {landingCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div className="rounded-sm border border-zinc-900 bg-zinc-950/70 p-8" key={card.title}>
                      <Icon className="mb-6 h-6 w-6 text-zinc-300" />
                      <h2 className="mb-3 font-serif text-3xl italic">{card.title}</h2>
                      <p className="text-sm leading-7 text-zinc-400">{card.copy}</p>
                    </div>
                  );
                })}
              </section>

              <section className="mx-auto max-w-6xl border-t border-zinc-900 py-20" id="methodology">
                <div className="grid gap-8 md:grid-cols-[0.95fr_1.05fr]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Methodology</p>
                    <h2 className="mt-4 font-serif text-5xl italic">Find the failure point before it finds you.</h2>
                  </div>
                  <div className="space-y-5 text-sm leading-7 text-zinc-400 sm:text-base">
                    <p>
                      Fracture Studio isolates unsupported conclusions, overreaches, and soft assumptions that make an
                      argument easy to attack.
                    </p>
                    <p>
                      The goal is not more words. The goal is a cleaner chain of reasoning, with each sentence doing
                      deliberate work.
                    </p>
                  </div>
                </div>
              </section>

              <section className="mx-auto max-w-6xl border-t border-zinc-900 py-20" id="manifesto">
                <div className="grid gap-8 md:grid-cols-[1.05fr_0.95fr]">
                  <div className="order-2 space-y-5 text-sm leading-7 text-zinc-400 md:order-1 sm:text-base">
                    <p>
                      Strong writing does not hide behind tone. It earns confidence by surviving scrutiny.
                    </p>
                    <p>
                      This studio exists for writers who would rather expose the weakness themselves than let a reader,
                      judge, or opponent do it first.
                    </p>
                  </div>
                  <div className="order-1 md:order-2">
                    <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Manifesto</p>
                    <h2 className="mt-4 font-serif text-5xl italic">Clarity is the sharpest form of conviction.</h2>
                  </div>
                </div>
              </section>
            </main>
          </motion.div>
        )}

        {view === 'auth' && (
          <motion.div
            key="auth"
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-screen items-center justify-center px-6"
            exit={{ opacity: 0, y: -12 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <div className="w-full max-w-lg rounded-sm border border-zinc-900 bg-zinc-950/80 p-10 text-center">
              <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Studio Access</p>
              <h1 className="mt-4 font-serif text-5xl italic">Enter the room.</h1>
              <p className="mt-5 text-sm leading-7 text-zinc-400">
                The current build uses a lightweight placeholder gate. Continue into the dashboard and open a new case
                when you are ready to write.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  className="rounded-sm border border-zinc-800 px-6 py-3 font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:text-white"
                  onClick={() => setView('landing')}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="rounded-sm bg-white px-8 py-3 font-bold text-black transition-colors hover:bg-zinc-100"
                  onClick={() => setView('dashboard')}
                  type="button"
                >
                  Continue
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            animate={{ opacity: 1, y: 0 }}
            className="min-h-screen px-6 py-12 sm:px-12"
            exit={{ opacity: 0, y: -12 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <div className="mx-auto max-w-6xl">
              <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Dashboard</p>
                  <h1 className="mt-3 font-serif text-5xl italic">Workspace</h1>
                </div>
                <button
                  className="rounded-sm bg-white px-6 py-3 font-bold text-black transition-colors hover:bg-zinc-100"
                  onClick={() => setView('workspace')}
                  type="button"
                >
                  New Case
                </button>
              </div>

              <div className="rounded-sm border border-zinc-900 bg-zinc-950/70 p-8">
                <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Current mode</p>
                <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-300">
                  Open a case, paste the argument you want pressure-tested, and send it through the analysis endpoint.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'workspace' && (
          <motion.div
            key="workspace"
            animate={{ opacity: 1 }}
            className="flex min-h-screen flex-col"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <header className="flex h-16 items-center justify-between border-b border-zinc-900 px-4 sm:px-6">
              <button
                className="rounded-sm border border-zinc-900 p-2 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                onClick={() => setView('dashboard')}
                type="button"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                className="rounded-sm bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
                disabled={isLoading || !content.trim()}
                onClick={runAnalysis}
                type="button"
              >
                {isLoading ? 'Analyzing...' : 'Analyze'}
              </button>
            </header>

            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
              <textarea
                className="min-h-[50vh] flex-1 resize-none bg-transparent px-8 py-10 font-serif text-2xl italic leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 sm:px-12 sm:py-14 sm:text-3xl lg:min-h-0 lg:px-20 lg:py-20"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Enter logic..."
                value={content}
              />
              <div className="w-full border-t border-zinc-900 p-6 text-sm leading-7 text-zinc-400 lg:w-96 lg:border-l lg:border-t-0 lg:p-8">
                <p className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">Analysis</p>
                <div className="whitespace-pre-wrap">{analysis || 'No analysis yet.'}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
