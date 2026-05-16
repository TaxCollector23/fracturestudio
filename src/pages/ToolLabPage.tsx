import { useMemo, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { buildCitationReport, renderCitationReport } from '../lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis } from '../lib/fractureEngine';
import { toPlainText } from '../lib/plainText';

type LabSlug = 'analyze' | 'speech-lab' | 'audience-questions' | 'evidence-lab' | 'citations' | 'rubric-checker' | 'search';
type Props = { labSlug?: LabSlug };
type Stage = 'idle' | 'thinking' | 'typing' | 'complete';

const titles: Record<LabSlug, string> = {
  analyze: 'Analyze the structure before revising prose.',
  'speech-lab': 'Speech timing and delivery lab.',
  'audience-questions': 'Audience question predictor.',
  'evidence-lab': 'Evidence and source lab.',
  citations: 'Citation and bibliography lab.',
  'rubric-checker': 'Rubric alignment checker.',
  search: 'Search Fracture Studio.',
};

function Progress({ stage, progress }: { stage: Stage; progress: number }) {
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-950 p-1">
      <div className="h-2 rounded-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
      {stage !== 'idle' && (
        <p className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
          {stage !== 'complete' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {stage}
        </p>
      )}
    </div>
  );
}

export function ToolLabPage({ labSlug = 'analyze' }: Props) {
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const runRef = useRef(0);
  const title = useMemo(() => titles[labSlug] || titles.analyze, [labSlug]);

  function build() {
    if (labSlug === 'citations') {
      return renderCitationReport(buildCitationReport({ style: 'APA', sourcesText: text, claimText: text }));
    }

    if (labSlug === 'speech-lab') {
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      return `Speech Timing\n\nWord count: ${words}\nSlow: ${(words / 120).toFixed(1)} min\nAverage: ${(words / 145).toFixed(1)} min\nFast: ${(words / 170).toFixed(1)} min\n\nDelivery Coach\n\nPause before key evidence.\nSlow down on impact.\nSplit long sentences.`;
    }

    if (labSlug === 'search') {
      return 'Search Results\n\n/studio/case\n/citations\n/models\n/evidence-lab\n/speech-lab';
    }

    return renderFractureAnalysis(analyzeArgument(text, { judgeMode: 'debate' }));
  }

  function reveal(full: string) {
    const id = ++runRef.current;
    const plain = toPlainText(full);
    const tokens = plain.match(/\S+\s*/g) || [];
    let i = 0;

    setOutput('');
    setStage('typing');
    setProgress(35);

    function step() {
      if (runRef.current !== id) {
        return;
      }

      i += 1;
      setOutput(tokens.slice(0, i).join(''));
      setProgress(Math.min(100, 35 + Math.round((i / Math.max(tokens.length, 1)) * 65)));

      if (i >= tokens.length) {
        setStage('complete');
        return;
      }

      setTimeout(step, /score|citation|mission|verdict|collapse/i.test(tokens[i] || '') ? 45 : 16);
    }

    setTimeout(step, 100);
  }

  function run() {
    setStage('thinking');
    setProgress(14);
    setOutput('');
    setTimeout(() => {
      setProgress(32);
      reveal(build());
    }, 420);
  }

  return (
    <main className="px-6 py-10 sm:px-10">
      <section className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Tool lab</p>
          <h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">{title}</h1>
          <p className="mt-5 text-sm leading-7 text-zinc-400">Feedback appears only after the engine finishes thinking.</p>
          <textarea className="mt-6 min-h-[420px] w-full border border-zinc-800 bg-zinc-950 p-4 text-sm leading-7 text-zinc-100" onChange={(event) => { setText(event.target.value); setOutput(''); setStage('idle'); setProgress(0); }} placeholder="Paste text or sources." value={text} />
          <button className="mt-4 inline-flex items-center gap-2 rounded-sm bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-950" onClick={run} type="button"><Play className="h-4 w-4" />Run lab</button>
        </div>
        <aside className="grid gap-4">
          <Progress stage={stage} progress={progress} />
          <div className="min-h-[560px] whitespace-pre-wrap border border-zinc-900 bg-[#0c0c0e] p-5 text-sm leading-7 text-zinc-300">{output || 'Run the lab to generate typed output.'}</div>
        </aside>
      </section>
    </main>
  );
}
