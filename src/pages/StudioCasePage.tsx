import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Shield, Swords } from 'lucide-react';
import { ChatRequestError, formatChatRequestError, postChat } from '../chatClient';

type StudioTab = 'critique' | 'citations' | 'rebuttals';

const studioTabs: { id: StudioTab; label: string; icon: typeof Shield }[] = [
  { id: 'critique', label: 'Critique', icon: Shield },
  { id: 'citations', label: 'Citations', icon: BookOpen },
  { id: 'rebuttals', label: 'Rebuttals', icon: Swords },
];

export function StudioCasePage() {
  const [content, setContent] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const [studioTab, setStudioTab] = useState<StudioTab>('critique');
  const [citationStyle, setCitationStyle] = useState('APA');
  const [sourcesText, setSourcesText] = useState('');
  const [citationOut, setCitationOut] = useState('');
  const [opponentText, setOpponentText] = useState('');
  const [userCase, setUserCase] = useState('');
  const [rebuttalOut, setRebuttalOut] = useState('');

  useEffect(() => {
    setLastError(null);
  }, [studioTab]);

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
    setLastError(null);

    try {
      const text = await postChat({
        action: 'critique',
        messages: [{ role: 'user', content: trimmed }],
      });
      setAnalysis(text);
    } catch (error) {
      const message = error instanceof ChatRequestError ? formatChatRequestError(error) : error instanceof Error ? error.message : 'Analysis failed.';
      setAnalysis('');
      setLastError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const runCitations = async () => {
    const trimmed = sourcesText.trim();
    if (!trimmed || isLoading) {
      if (!trimmed) {
        setCitationOut('Add sources (paste or structured lines) before generating citations.');
      }
      return;
    }

    setIsLoading(true);
    setCitationOut('');
    setLastError(null);

    try {
      const text = await postChat({
        action: 'citations',
        citationStyle,
        sourcesText: trimmed,
      });
      setCitationOut(text);
    } catch (error) {
      const message = error instanceof ChatRequestError ? formatChatRequestError(error) : error instanceof Error ? error.message : 'Citation generation failed.';
      setCitationOut('');
      setLastError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const runRebuttals = async () => {
    const opp = opponentText.trim();
    const mine = userCase.trim();
    if (!opp || !mine || isLoading) {
      if (!opp || !mine) {
        setRebuttalOut('Add both opponent text and your case before generating rebuttals.');
      }
      return;
    }

    setIsLoading(true);
    setRebuttalOut('');
    setLastError(null);

    try {
      const text = await postChat({
        action: 'rebuttals',
        opponentText: opp,
        userCase: mine,
      });
      setRebuttalOut(text);
    } catch (error) {
      const message = error instanceof ChatRequestError ? formatChatRequestError(error) : error instanceof Error ? error.message : 'Rebuttal generation failed.';
      setRebuttalOut('');
      setLastError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const outputLabel =
    studioTab === 'critique' ? 'Critique output' : studioTab === 'citations' ? 'Bibliography & in-text helpers' : 'Rebuttal map';

  const outputBody =
    studioTab === 'critique'
      ? analysis || (isLoading ? 'Thinking…' : 'No analysis yet. Paste an argument draft, then Run.')
      : studioTab === 'citations'
        ? citationOut || (isLoading ? 'Thinking…' : 'No citation output yet. Add sources, then Run.')
        : rebuttalOut || (isLoading ? 'Thinking…' : 'No rebuttal output yet. Fill both columns, then Run.');

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <motion.div animate={{ opacity: 1 }} className="flex min-h-screen flex-col" initial={{ opacity: 0 }} transition={{ duration: 0.2 }} id="main">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-zinc-900 px-4 py-2 sm:px-6">
          <Link
            aria-label="Back to dashboard"
            className="rounded-sm border border-zinc-900 p-2 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
            to="/studio/dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex flex-1 flex-wrap items-center justify-center gap-2 sm:justify-end">
            <div className="flex w-full max-w-xl flex-wrap gap-1 rounded-sm border border-zinc-800 bg-zinc-900/40 p-1 sm:w-auto">
              {studioTabs.map((tab) => {
                const Icon = tab.icon;
                const active = studioTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    aria-pressed={active}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-wide sm:flex-none sm:px-4 ${
                      active ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                    onClick={() => setStudioTab(tab.id)}
                    type="button"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              className="rounded-sm bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              disabled={
                isLoading ||
                (studioTab === 'critique' && !content.trim()) ||
                (studioTab === 'citations' && !sourcesText.trim()) ||
                (studioTab === 'rebuttals' && (!opponentText.trim() || !userCase.trim()))
              }
              onClick={() => {
                if (studioTab === 'critique') {
                  void runAnalysis();
                } else if (studioTab === 'citations') {
                  void runCitations();
                } else {
                  void runRebuttals();
                }
              }}
              type="button"
            >
              {isLoading ? 'Running…' : 'Run'}
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="min-h-[45vh] flex-1 border-b border-zinc-900 lg:min-h-0 lg:border-b-0 lg:border-r">
            {studioTab === 'critique' && (
              <textarea
                aria-label="Argument draft"
                className="h-full min-h-[45vh] w-full resize-none bg-transparent px-6 py-8 font-serif text-xl italic leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 sm:px-10 sm:py-12 sm:text-2xl lg:min-h-0 lg:px-16 lg:py-16 lg:text-3xl"
                onChange={(event) => setContent(event.target.value)}
                placeholder="Enter logic..."
                value={content}
              />
            )}
            {studioTab === 'citations' && (
              <div className="flex h-full min-h-[45vh] flex-col gap-4 px-6 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
                <label className="text-xs uppercase tracking-[0.35em] text-zinc-500" htmlFor="citation-style">
                  Citation style
                </label>
                <select
                  className="w-full max-w-xs rounded-sm border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  id="citation-style"
                  onChange={(e) => setCitationStyle(e.target.value)}
                  value={citationStyle}
                >
                  <option value="APA">APA (7th-style lite)</option>
                  <option value="MLA">MLA (9th-style lite)</option>
                  <option value="Chicago notes">Chicago notes / bibliography lite</option>
                </select>
                <label className="text-xs uppercase tracking-[0.35em] text-zinc-500" htmlFor="sources-text">
                  Sources (paste one per line or structured fields)
                </label>
                <textarea
                  className="min-h-[220px] flex-1 resize-y rounded-sm border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
                  id="sources-text"
                  onChange={(e) => setSourcesText(e.target.value)}
                  placeholder={'e.g.\nSmith, J. (2020). Title. Publisher.\nhttps://example.org/report'}
                  value={sourcesText}
                />
              </div>
            )}
            {studioTab === 'rebuttals' && (
              <div className="grid min-h-[45vh] flex-1 gap-6 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-2 lg:px-16 lg:py-16">
                <div className="flex min-h-[200px] flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.35em] text-zinc-500" htmlFor="opponent-text">
                    Opponent text
                  </label>
                  <textarea
                    className="min-h-[200px] flex-1 resize-y rounded-sm border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
                    id="opponent-text"
                    onChange={(e) => setOpponentText(e.target.value)}
                    placeholder="Paste their claims, speech, or post..."
                    value={opponentText}
                  />
                </div>
                <div className="flex min-h-[200px] flex-col gap-2">
                  <label className="text-xs uppercase tracking-[0.35em] text-zinc-500" htmlFor="user-case">
                    Your case
                  </label>
                  <textarea
                    className="min-h-[200px] flex-1 resize-y rounded-sm border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm leading-7 text-zinc-100 outline-none placeholder:text-zinc-600"
                    id="user-case"
                    onChange={(e) => setUserCase(e.target.value)}
                    placeholder="Your position, evidence, and what you need to defend..."
                    value={userCase}
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 border-t border-zinc-900 p-6 text-sm leading-7 text-zinc-400 lg:w-[min(100%,28rem)] lg:border-l lg:border-t-0 lg:p-8">
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-zinc-500">{outputLabel}</p>
            {lastError && !isLoading && (
              <div
                className="mb-4 rounded-sm border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100"
                role="alert"
              >
                <p className="font-semibold text-amber-50">Request failed</p>
                <p className="mt-1 whitespace-pre-wrap">{lastError}</p>
              </div>
            )}
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap lg:max-h-[calc(100vh-8rem)]">{outputBody}</div>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}
