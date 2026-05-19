import { useMemo, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { buildCitationReport, renderCitationReport } from '../lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis } from '../lib/fractureEngine';
import { toPlainText } from '../lib/plainText';

type LabSlug = 'analyze' | 'speech-lab' | 'audience-questions' | 'evidence-lab' | 'citations' | 'rubric-checker' | 'search';
type Props = { labSlug?: LabSlug };
type Stage = 'idle' | 'thinking' | 'typing' | 'complete' | 'error';

const titles: Record<LabSlug, string> = {
  analyze: 'Analyze the structure before revising prose.',
  'speech-lab': 'Speech timing and delivery lab.',
  'audience-questions': 'Audience question predictor.',
  'evidence-lab': 'Evidence and source lab.',
  citations: 'Citation and bibliography lab.',
  'rubric-checker': 'Rubric alignment checker.',
  search: 'Search Fracture Studio.',
};

function Progress({ stage, progress, label }: { stage: Stage; progress: number; label: string }) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-950 p-1">
      <div className={stage === 'error' ? 'h-2 rounded-full bg-amber-300 transition-all duration-300' : 'h-2 rounded-full bg-white transition-all duration-300'} style={{ width: `${safeProgress}%` }} />
      <p className="mt-3 flex min-h-4 items-center gap-2 px-1 text-xs uppercase tracking-[0.24em] text-zinc-500">
        {stage === 'thinking' || stage === 'typing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {stage !== 'idle' ? label : ' '}
      </p>
    </div>
  );
}

export function ToolLabPage({ labSlug = 'analyze' }: Props) {
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('Waiting');
  const [notice, setNotice] = useState('');
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
    setLabel('Typing local lab output');

    function step() {
      if (runRef.current !== id) {
        return;
      }

      i += 1;
      setOutput(tokens.slice(0, i).join(''));
      setProgress(Math.min(100, 35 + Math.round((i / Math.max(tokens.length, 1)) * 65)));

      if (i >= tokens.length) {
        setStage('complete');
        setLabel('Local result ready');
        return;
      }

      setTimeout(step, /score|citation|mission|verdict|collapse/i.test(tokens[i] || '') ? 45 : 16);
    }

    setTimeout(step, 100);
  }

  function run() {
    const id = ++runRef.current;
    setStage('thinking');
    setProgress(14);
    setLabel('Running local lab engine');
    setNotice('');
    setOutput('');
    setTimeout(() => {
      if (runRef.current !== id) {
        return;
      }

      setProgress(32);
      try {
        reveal(build());
      } catch {
        setStage('error');
        setProgress(100);
        setLabel('Engine failed');
        setNotice('The local lab engine could not finish this run. Your text is still in the editor; edit it or rerun the lab.');
      }
    }, 420);
  }

  return (
    <main className="px-6 py-10 sm:px-10">
      <section className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Tool lab</p>
          <h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">{title}</h1>
          <p className="mt-5 text-sm leading-7 text-zinc-400">Feedback appears only after the engine finishes thinking.</p>
          <textarea className="mt-6 min-h-[420px] w-full border border-zinc-800 bg-zinc-950 p-4 text-sm leading-7 text-zinc-100" onChange={(event) => { runRef.current += 1; setText(event.target.value); setOutput(''); setStage('idle'); setProgress(0); setLabel('Waiting'); setNotice(''); }} placeholder="Paste text or sources." value={text} />
          <button className="mt-4 inline-flex items-center gap-2 rounded-sm bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-950" onClick={run} type="button"><Play className="h-4 w-4" />Run lab</button>
        </div>
        <aside className="grid gap-4">
          <Progress stage={stage} progress={progress} label={label} />
          {notice && <p className="border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">{notice}</p>}
          <div className="h-[560px] overflow-y-auto whitespace-pre-wrap border border-zinc-900 bg-[#0c0c0e] p-5 text-sm leading-7 text-zinc-300">{output || (stage === 'thinking' ? 'Preparing local lab output...' : 'Run the lab to generate typed output.')}</div>
        </aside>
      </section>
    </main>
  );
}
