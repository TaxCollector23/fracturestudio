import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2, MessageSquare, Play, Send, Swords, Zap } from 'lucide-react';
import { ChatRequestError, postChat } from '../chatClient';
import { buildCitationReport, renderCitationReport } from '../lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis, type FractureAnalysis, type JudgeMode } from '../lib/fractureEngine';
import { toPlainText } from '../lib/plainText';
import { generateRebuttalReport, type OpponentPersona } from '../lib/rebuttalEngine';

type Tab = 'draft' | 'fracture' | 'graph' | 'citations' | 'rebuttals' | 'crossfire' | 'advanced' | 'export';
type Stage = 'idle' | 'thinking' | 'typing' | 'complete';
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const tabs: Tab[] = ['draft', 'fracture', 'graph', 'citations', 'rebuttals', 'crossfire', 'advanced', 'export'];

function Progress({ stage, progress, label }: { stage: Stage; progress: number; label: string }) {
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-950 p-1">
      <div className="h-2 rounded-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
      <p className="mt-3 flex min-h-4 items-center gap-2 px-1 text-xs uppercase tracking-[0.24em] text-zinc-500">
        {stage !== 'idle' && stage !== 'complete' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {stage !== 'idle' ? label : ' '}
      </p>
    </div>
  );
}

function lineList(items: string[], empty: string) {
  return items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : empty;
}

function graph(a: FractureAnalysis | null) {
  if (!a) {
    return 'Run Fracture first. The graph is built from the completed analysis, not while you type.';
  }

  const nodes = a.graph.nodes.map((node) => `${node.id}: ${node.label}. Type: ${node.type}. Strength: ${node.strength}/100.`).join('\n');
  const edges = a.graph.edges.map((edge) => `${edge.from} to ${edge.to}: ${edge.label}.`).join('\n') || 'No support edges yet.';

  return `Argument Graph\n\nNodes\n${nodes}\n\nConnections\n${edges}`;
}

function crossfire(a: FractureAnalysis | null) {
  if (!a) {
    return 'Run Fracture first to generate crossfire.';
  }

  return `Judge Questions\n\n${lineList(a.judgeQuestions, 'No judge questions generated yet.')}\n\nCrossfire\n\n${lineList(a.crossfireQuestions, 'No crossfire questions generated yet.')}`;
}

function advanced(a: FractureAnalysis | null) {
  if (!a) {
    return 'Run Fracture first for advanced model output.';
  }

  return `Assertion, Reasoning, Evidence, Impact\n\n${lineList(a.impactChain, 'No impact chain generated yet.')}\n\nHidden Assumptions\n\n${lineList(a.assumptions, 'No hidden assumptions detected.')}\n\nCollapse Point\n\n${a.collapsePoint}\n\nMissions\n\n${lineList(a.missions, 'No revision missions generated yet.')}`;
}

export function StudioCasePage() {
  const [content, setContent] = useState('');
  const [tab, setTab] = useState<Tab>('draft');
  const [judge, setJudge] = useState<JudgeMode>('debate');
  const [style, setStyle] = useState('APA');
  const [persona, setPersona] = useState<OpponentPersona>('logical');
  const [opponent, setOpponent] = useState('');
  const [analysis, setAnalysis] = useState<FractureAnalysis | null>(null);
  const [fracture, setFracture] = useState('');
  const [citations, setCitations] = useState('');
  const [rebuttals, setRebuttals] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('Waiting');
  const [notice, setNotice] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [speed, setSpeed] = useState(false);
  const runRef = useRef(0);
  const chatRef = useRef(0);

  useEffect(() => {
    setAnalysis(null);
    setFracture('');
    setCitations('');
    setRebuttals('');
    setStage('idle');
    setProgress(0);
    setNotice('');
  }, [content, judge, style, persona, opponent]);

  const active = useMemo(
    () =>
      toPlainText(
        tab === 'citations'
          ? citations
          : tab === 'rebuttals'
            ? rebuttals
            : tab === 'graph'
              ? graph(analysis)
              : tab === 'crossfire'
                ? crossfire(analysis)
                : tab === 'advanced'
                  ? advanced(analysis)
                  : tab === 'export'
                    ? `Fracture Report\n\n${fracture || citations || rebuttals || 'Run an engine before exporting.'}`
                    : tab === 'fracture'
                      ? fracture
                      : '',
      ),
    [tab, citations, rebuttals, analysis, fracture],
  );

  function requireDraft() {
    if (content.trim()) {
      return true;
    }

    setNotice('Paste a draft first. Fracture starts blank and will not invent an example claim.');
    return false;
  }

  function reveal(text: string, setter: (value: string) => void, outLabel: string) {
    const id = ++runRef.current;
    const plain = toPlainText(text);
    const tokens = plain.match(/\S+\s*/g) || [];
    let i = 0;

    setter('');
    setStage('typing');
    setProgress(34);
    setLabel(outLabel);

    function step() {
      if (runRef.current !== id) {
        return;
      }

      i += 1;
      setter(tokens.slice(0, i).join(''));
      setProgress(Math.min(100, 34 + Math.round((i / Math.max(tokens.length, 1)) * 66)));

      if (i >= tokens.length) {
        setStage('complete');
        setLabel('Ready');
        return;
      }

      setTimeout(step, /verdict|score|citation|rebuttal|mission|collapse/i.test(tokens[i] || '') ? 50 : 16);
    }

    setTimeout(step, 100);
  }

  async function runFracture() {
    if (!requireDraft()) {
      return;
    }

    setTab('fracture');
    setStage('thinking');
    setProgress(12);
    setLabel('Thinking through draft');

    const local = analyzeArgument(content, { judgeMode: judge });
    setAnalysis(local);

    let text = renderFractureAnalysis(local);
    try {
      setProgress(30);
      setLabel('Calling Fracture Chat');
      text = await postChat({ action: 'fracture', text: content, mode: judge });
    } catch (error) {
      if (error instanceof ChatRequestError) {
        setNotice('Remote model was slow, so the local Fracture engine answered. Your draft was preserved.');
      }
    }

    reveal(text, setFracture, 'Typing verdict');
  }

  async function runCitations() {
    if (!requireDraft()) {
      return;
    }

    setTab('citations');
    setStage('thinking');
    setProgress(12);
    setLabel('Checking sources');

    let text = renderCitationReport(buildCitationReport({ style, sourcesText: content, claimText: content }));
    try {
      setProgress(30);
      text = await postChat({ action: 'citations', text: content, style });
    } catch (error) {
      if (error instanceof ChatRequestError) {
        setNotice('Citation AI was slow, so the local citation engine answered. Your draft was preserved.');
      }
    }

    reveal(text, setCitations, 'Typing citation report');
  }

  async function runRebuttals() {
    if (!requireDraft()) {
      return;
    }

    setTab('rebuttals');
    setStage('thinking');
    setProgress(12);
    setLabel('Building rebuttals');

    let text = generateRebuttalReport({ opponentText: opponent || content, userCase: content, persona });
    try {
      setProgress(30);
      text = await postChat({ action: 'rebuttals', text: content, opponentText: opponent || content, persona, speedMode: speed });
    } catch (error) {
      if (error instanceof ChatRequestError) {
        setNotice('Rebuttal AI was slow, so the local rebuttal engine answered. Your draft was preserved.');
      }
    }

    reveal(text, setRebuttals, speed ? 'Typing rapid rebuttal' : 'Typing rebuttal plan');
  }

  function openChat(seed?: string) {
    setChatOpen(true);
    if (seed?.trim()) {
      setChatInput(`Explain this feedback and help me fix it:\n\n${toPlainText(seed).slice(0, 1200)}`);
    }
  }

  function roll(text: string, index: number, id: number) {
    const plain = toPlainText(text);
    const tokens = plain.match(/\S+\s*/g) || [];
    let i = 0;

    function step() {
      if (chatRef.current !== id) {
        return;
      }

      i += 1;
      setChatMessages((messages) => messages.map((message, messageIndex) => (messageIndex === index ? { ...message, content: tokens.slice(0, i).join('') } : message)));

      if (i >= tokens.length) {
        setChatLoading(false);
        return;
      }

      setTimeout(step, speed ? 8 : 18);
    }

    step();
  }

  async function sendChat() {
    const prompt = chatInput.trim();
    if (!prompt || chatLoading) {
      return;
    }

    const id = ++chatRef.current;
    const next = [
      ...chatMessages,
      { role: 'user' as const, content: prompt },
      { role: 'assistant' as const, content: 'Fracture Chat is thinking...' },
    ];
    const assistantIndex = next.length - 1;

    setChatMessages(next);
    setChatInput('');
    setChatLoading(true);

    let answer = 'Local Fracture Chat: isolate the claim, state the warrant, attach evidence, and write the impact.';
    try {
      answer = await postChat({
        action: 'chat',
        text: content,
        speedMode: speed,
        messages: [
          { role: 'user', content: `Draft context:\n${content || 'No draft pasted.'}` },
          { role: 'user', content: prompt },
        ],
      });
    } catch (error) {
      if (error instanceof ChatRequestError) {
        answer = 'Local Fracture Chat fallback: the remote model was slow, so I used the local repair engine. Repair path: assertion, reasoning, evidence, impact.';
      }
    }

    roll(answer, assistantIndex, id);
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-6 text-zinc-50 sm:px-8 xl:h-[calc(100vh-80px)] xl:min-h-0 xl:overflow-hidden">
      <section className="mx-auto grid h-full max-w-[1500px] gap-5 xl:min-h-0 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-5 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="border border-zinc-900 bg-[#0c0c0e] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.42em] text-zinc-500">Fracture Studio</p>
                <h1 className="mt-3 font-serif text-5xl italic">Case workspace.</h1>
                <p className="mt-4 text-sm leading-7 text-zinc-400">No instant feedback. Choose an engine, wait for thinking, then read the typed report.</p>
              </div>
              <div className="flex gap-2">
                <Link className="border border-zinc-800 px-4 py-2 text-sm" to="/">Home</Link>
                <Link className="border border-zinc-800 px-4 py-2 text-sm" to="/studio/dashboard">Studio</Link>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <select className="border border-zinc-800 bg-zinc-950 p-3" value={judge} onChange={(event) => setJudge(event.target.value as JudgeMode)}>
                <option value="debate">Debate judge</option>
                <option value="teacher">Teacher</option>
                <option value="professor">Professor</option>
                <option value="reader">Reader</option>
              </select>
              <select className="border border-zinc-800 bg-zinc-950 p-3" value={style} onChange={(event) => setStyle(event.target.value)}>
                <option>APA</option>
                <option>MLA</option>
                <option>Chicago notes</option>
              </select>
              <select className="border border-zinc-800 bg-zinc-950 p-3" value={persona} onChange={(event) => setPersona(event.target.value as OpponentPersona)}>
                <option value="logical">Logical</option>
                <option value="aggressive">Aggressive</option>
                <option value="evidence-heavy">Evidence-heavy</option>
                <option value="skeptical">Skeptical</option>
                <option value="debate-champion">Debate champion</option>
              </select>
            </div>
          </div>

          <textarea className="min-h-[500px] w-full resize-none border border-zinc-900 bg-zinc-950 p-4 text-sm leading-7 xl:min-h-0 xl:h-full" placeholder="Paste your argument. Feedback appears only after you run an engine." value={content} onChange={(event) => setContent(event.target.value)} />
          <textarea className="min-h-28 w-full resize-none border border-zinc-900 bg-zinc-950 p-4 text-sm leading-7" placeholder="Optional opponent text for rebuttals." value={opponent} onChange={(event) => setOpponent(event.target.value)} />
        </div>

        <div className="grid gap-5 xl:min-h-0 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
          <div className="border border-zinc-900 bg-[#0c0c0e] p-5">
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-sm bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-950" onClick={runFracture} type="button"><Play className="h-4 w-4" />Run Fracture</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runCitations} type="button"><ClipboardCheck className="h-4 w-4" />Citation Engine</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runRebuttals} type="button"><Swords className="h-4 w-4" />Rebuttals</button>
              <button className={speed ? 'inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-zinc-950' : 'inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm'} onClick={() => setSpeed((value) => !value)} type="button"><Zap className="h-4 w-4" />Speed mode</button>
            </div>
            <div className="mt-5"><Progress stage={stage} progress={progress} label={label} /></div>
            {notice && <p className="mt-4 border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">{notice}</p>}
          </div>

          <div className="flex gap-2 overflow-x-auto border border-zinc-900 bg-[#0c0c0e] p-2">
            {tabs.map((item) => (
              <button className={tab === item ? 'shrink-0 bg-zinc-100 px-3 py-2 text-sm text-zinc-950' : 'shrink-0 px-3 py-2 text-sm text-zinc-400'} key={item} onClick={() => setTab(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          <section className="min-h-[610px] border border-zinc-900 bg-[#0c0c0e] p-5 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <h2 className="text-sm uppercase tracking-[0.28em] text-zinc-500">{tab}</h2>
              <button className="inline-flex items-center gap-2 border border-zinc-800 px-3 py-2 text-sm" onClick={() => openChat(active)} type="button"><MessageSquare className="h-4 w-4" />Ask Chat</button>
            </div>
            <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-300 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-3" onDoubleClick={() => openChat(active)}>
              {active || 'Run an engine. Fracture stays blank until the user chooses.'}
            </div>
          </section>
        </div>
      </section>

      {chatOpen && (
        <aside className="fixed bottom-24 right-4 z-[130] flex max-h-[78vh] w-[min(440px,calc(100vw-2rem))] flex-col border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 p-4">
            <b>Fracture Chat</b>
            <button onClick={() => setChatOpen(false)} type="button">Close</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {chatMessages.map((message, index) => (
              <div className={message.role === 'user' ? 'border border-zinc-800 bg-zinc-900 p-3 text-sm' : 'border border-zinc-900 bg-[#0c0c0e] p-3 text-sm'} key={`${message.role}-${index}`}>{message.content}</div>
            ))}
            {chatLoading && <Progress stage="thinking" progress={58} label="Fracture Chat thinking" />}
          </div>
          <div className="border-t border-zinc-900 p-4">
            <textarea className="min-h-24 w-full border border-zinc-800 bg-zinc-950 p-3 text-sm" placeholder="Ask Fracture Chat what to fix." value={chatInput} onChange={(event) => setChatInput(event.target.value)} />
            <button className={chatInput.trim() ? 'mt-3 inline-flex w-full items-center justify-center gap-2 bg-white px-4 py-3 text-sm font-bold text-zinc-950' : 'mt-3 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 border border-zinc-800 px-4 py-3 text-sm text-zinc-500'} disabled={!chatInput.trim() || chatLoading} onClick={sendChat} type="button"><Send className="h-4 w-4" />Send rapid request</button>
          </div>
        </aside>
      )}
    </main>
  );
}

