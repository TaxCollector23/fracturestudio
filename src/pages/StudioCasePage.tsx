import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Loader2, MessageSquare, Play, Send, Swords, Zap } from 'lucide-react';
import { ChatRequestError, formatChatRequestError, postChat } from '../chatClient';
import {
  buildAdvancedFeaturePack,
  loadVersionHistory,
  renderCollapsePoint,
  renderInteractiveGraphText,
  renderJudgeBallots,
  renderRevisionMissions,
  renderRubricAlignment,
  renderSourceClaimVerification,
  renderSpeechDelivery,
  renderSpeedDebateBrief,
  renderVersionHistory,
  renderWarRoom,
  saveVersionHistoryEntry,
  type AdvancedFeaturePack,
  type InteractiveGraphNode,
  type VersionHistoryEntry,
} from '../lib/advancedFeatureEngine';
import { buildCitationReport, renderCitationReport } from '../lib/citationEngine';
import { analyzeArgument, type FractureAnalysis, type JudgeMode } from '../lib/fractureEngine';
import { toPlainText } from '../lib/plainText';
import { generateRebuttalReport, type OpponentPersona } from '../lib/rebuttalEngine';

type Tab = 'draft' | 'fracture' | 'graph' | 'citations' | 'rebuttals' | 'crossfire' | 'advanced' | 'export';
type Stage = 'idle' | 'thinking' | 'typing' | 'complete';
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type OutputSource = 'local' | 'remote' | null;

const tabs: Tab[] = ['draft', 'fracture', 'graph', 'citations', 'rebuttals', 'crossfire', 'advanced', 'export'];

function Progress({ stage, progress, label }: { stage: Stage; progress: number; label: string }) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-950 p-1">
      <div className="h-2 rounded-full bg-white transition-all duration-300" style={{ width: `${safeProgress}%` }} />
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

function graph(a: FractureAnalysis | null, pack: AdvancedFeaturePack | null) {
  if (pack) {
    return renderInteractiveGraphText(pack.graph);
  }

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

function advancedTools(pack: AdvancedFeaturePack | null, history: VersionHistoryEntry[]) {
  if (!pack) {
    return 'Run Fracture first. Advanced tools use the completed local analysis so they never depend on the remote API.';
  }

  return [
    renderCollapsePoint(pack.collapse),
    renderRevisionMissions(pack.missions),
    renderJudgeBallots(pack.ballots),
    renderSpeechDelivery(pack.speechDelivery),
    renderRubricAlignment(pack.rubric),
    renderVersionHistory(history),
  ].join('\n\n');
}

function GraphNodeInspector({
  node,
  onAsk,
}: {
  node: InteractiveGraphNode | undefined;
  onAsk: (text: string) => void;
}) {
  if (!node) {
    return (
      <div className="border border-zinc-900 bg-zinc-950 p-4 text-sm leading-7 text-zinc-400">
        Select a node to inspect its role, weakness, and repair path.
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 bg-zinc-950 p-4 text-sm leading-7 text-zinc-300">
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{node.type}</p>
      <h3 className="mt-2 text-lg text-white">{node.label}</h3>
      <p className="mt-3">Strength: {node.strength}/100</p>
      <p className="mt-3">What it is doing: {node.role}</p>
      <p>Why it matters: {node.whyItMatters}</p>
      <p>What is weak: {node.weakness}</p>
      <p>What fixes it: {node.fix}</p>
      <button className="mt-4 inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 text-sm" onClick={() => onAsk(node.askPrompt)} type="button">
        <MessageSquare className="h-4 w-4" />
        Ask Fracture Chat
      </button>
    </div>
  );
}

function ArgumentGraphView({
  pack,
  selectedId,
  onSelect,
  onAsk,
}: {
  pack: AdvancedFeaturePack | null;
  selectedId: string;
  onSelect: (id: string) => void;
  onAsk: (text: string) => void;
}) {
  if (!pack) {
    return <div className="text-sm leading-7 text-zinc-400">Run Fracture or Argument Graph first. The graph stays blank until a real analysis exists.</div>;
  }

  const selected = pack.graph.nodes.find((node) => node.id === selectedId) || pack.graph.nodes[0];
  const colorFor = (type: InteractiveGraphNode['type']) => {
    if (type === 'thesis') return 'border-white/70';
    if (type === 'claim') return 'border-sky-500/70';
    if (type === 'evidence') return 'border-emerald-500/70';
    if (type === 'warrant') return 'border-amber-500/70';
    if (type === 'assumption') return 'border-fuchsia-500/70';
    if (type === 'impact') return 'border-violet-500/70';
    return 'border-rose-500/70';
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {pack.graph.nodes.map((node) => (
            <button
              className={`min-h-28 border bg-zinc-950 p-3 text-left transition ${selected?.id === node.id ? 'border-white text-white' : `${colorFor(node.type)} text-zinc-300 hover:border-white/80`}`}
              key={node.id}
              onClick={() => onSelect(node.id)}
              type="button"
            >
              <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">{node.type}</span>
              <span className="mt-2 block text-sm leading-6">{node.label}</span>
              <span className="mt-3 block h-1 rounded-full bg-zinc-900">
                <span className="block h-1 rounded-full bg-white" style={{ width: `${node.strength}%` }} />
              </span>
            </button>
          ))}
        </div>
        <div className="border border-zinc-900 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Support lines</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
            {pack.graph.edges.map((edge) => (
              <div className={edge.style === 'broken' ? 'border-l-2 border-dashed border-rose-500 pl-3' : edge.style === 'thin' ? 'border-l border-amber-500 pl-3' : 'border-l-2 border-emerald-500 pl-3'} key={`${edge.from}-${edge.to}-${edge.label}`}>
                {edge.from} to {edge.to}: {edge.label}. {edge.issue}
              </div>
            ))}
          </div>
        </div>
      </div>
      <GraphNodeInspector node={selected} onAsk={onAsk} />
    </div>
  );
}

export function StudioCasePage() {
  const [content, setContent] = useState('');
  const [tab, setTab] = useState<Tab>('draft');
  const [judge, setJudge] = useState<JudgeMode>('debate');
  const [style, setStyle] = useState('APA');
  const [persona, setPersona] = useState<OpponentPersona>('logical');
  const [opponent, setOpponent] = useState('');
  const [analysis, setAnalysis] = useState<FractureAnalysis | null>(null);
  const [advancedPack, setAdvancedPack] = useState<AdvancedFeaturePack | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState('thesis');
  const [versionHistory, setVersionHistory] = useState<VersionHistoryEntry[]>(() => loadVersionHistory());
  const [fracture, setFracture] = useState('');
  const [citations, setCitations] = useState('');
  const [rebuttals, setRebuttals] = useState('');
  const [advancedOutput, setAdvancedOutput] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('Waiting');
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState<OutputSource>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [speed, setSpeed] = useState(false);
  const runRef = useRef(0);
  const revealRef = useRef(0);
  const chatRef = useRef(0);

  useEffect(() => {
    runRef.current += 1;
    revealRef.current += 1;
    setAnalysis(null);
    setAdvancedPack(null);
    setSelectedNodeId('thesis');
    setFracture('');
    setCitations('');
    setRebuttals('');
    setAdvancedOutput('');
    setStage('idle');
    setProgress(0);
    setLabel('Waiting');
    setNotice('');
    setSource(null);
  }, [content, judge, style, persona, opponent]);

  const active = useMemo(
    () =>
      toPlainText(
        tab === 'citations'
          ? citations
          : tab === 'rebuttals'
            ? rebuttals
            : tab === 'graph'
              ? graph(analysis, advancedPack)
              : tab === 'crossfire'
                ? crossfire(analysis)
                : tab === 'advanced'
                  ? advancedOutput ||
                    (advancedPack
                    ? advancedTools(advancedPack, versionHistory)
                    : advanced(analysis))
                  : tab === 'export'
                    ? `Fracture Report\n\n${fracture || advancedPack?.methodReport || citations || rebuttals || 'Run an engine before exporting.'}`
                    : tab === 'fracture'
                      ? fracture
                      : '',
      ),
    [tab, citations, rebuttals, analysis, advancedPack, versionHistory, fracture, advancedOutput],
  );

  function requireDraft() {
    if (content.trim()) {
      return true;
    }

    setNotice('Paste a draft first. Fracture starts blank and will not invent an example claim.');
    return false;
  }

  function buildLocalPack(existingAnalysis?: FractureAnalysis) {
    const local = existingAnalysis ?? analyzeArgument(content, { judgeMode: judge, rubric: opponent });
    const pack = buildAdvancedFeaturePack({
      draft: content,
      supplementalText: opponent,
      analysis: local,
      judgeMode: judge,
      persona,
    });
    setAnalysis(local);
    setAdvancedPack(pack);
    setSelectedNodeId(pack.graph.nodes[0]?.id || 'thesis');
    return pack;
  }

  function reveal(text: string, setter: (value: string) => void, outLabel: string, id = ++runRef.current) {
    const revealId = ++revealRef.current;
    const plain = toPlainText(text);
    const tokens = plain.match(/\S+\s*/g) || [];
    let i = 0;

    setter('');
    setStage('typing');
    setProgress(34);
    setLabel(outLabel);

    function step() {
      if (runRef.current !== id || revealRef.current !== revealId) {
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

    const id = ++runRef.current;
    setTab('fracture');
    setStage('thinking');
    setProgress(12);
    setLabel('Thinking through draft');
    setNotice('');
    setSource(null);

    try {
      const local = analyzeArgument(content, { judgeMode: judge });
      const pack = buildLocalPack(local);
      setSource('local');
      setNotice('Local Fracture Method Report v2 is ready. Remote model notes are being requested without replacing the local graph.');
      reveal(pack.methodReport, setFracture, 'Typing local method report', id);

      setProgress(30);
      setLabel('Calling remote Fracture model');
      const text = await postChat({ action: 'fracture', text: content, mode: judge });
      if (runRef.current !== id) {
        return;
      }
      setSource('remote');
      setNotice('Remote model notes applied after the local report. The graph, source map, missions, and ballot stay locally reliable.');
      reveal(`${pack.methodReport}\n\nRemote Model Notes\n\n${text}`, setFracture, 'Typing remote notes', id);
    } catch (error) {
      if (runRef.current !== id) {
        return;
      }
      setSource('local');
      setNotice(
        error instanceof ChatRequestError
          ? `Remote model unavailable; showing the local Fracture result. ${formatChatRequestError(error)}`
          : 'Fracture hit an unexpected frontend error. The draft is still in the editor; try Run Fracture again.',
      );
      setStage('complete');
      setLabel('Local result ready');
    }
  }

  async function runCitations() {
    if (!requireDraft()) {
      return;
    }

    const id = ++runRef.current;
    setTab('citations');
    setStage('thinking');
    setProgress(12);
    setLabel('Checking sources');
    setNotice('');
    setSource(null);

    try {
      const pack = advancedPack ?? buildLocalPack();
      const localText = `${renderSourceClaimVerification(pack.sourceVerification)}\n\nCitation Formatting\n\n${renderCitationReport(
        buildCitationReport({ style, sourcesText: [content, opponent].filter(Boolean).join('\n'), claimText: content }),
      )}`;
      setSource('local');
      setNotice('Local source-to-claim verification is ready. Remote citation review is still being requested.');
      reveal(localText, setCitations, 'Typing local citation report', id);

      setProgress(30);
      setLabel('Calling remote citation model');
      const text = await postChat({ action: 'citations', text: content, sourcesText: opponent, claimText: content, style });
      if (runRef.current !== id) {
        return;
      }
      setSource('remote');
      setNotice('Remote citation notes applied after the local verifier. The local source-to-claim map remains available.');
      reveal(`${localText}\n\nRemote Citation Notes\n\n${text}`, setCitations, 'Typing remote citation notes', id);
    } catch (error) {
      if (runRef.current !== id) {
        return;
      }
      setSource('local');
      setNotice(
        error instanceof ChatRequestError
          ? `Remote citation model unavailable; showing the local citation report. ${formatChatRequestError(error)}`
          : 'Citation lab hit an unexpected frontend error. The draft is still in the editor; try Citation Engine again.',
      );
      setStage('complete');
      setLabel('Local result ready');
    }
  }

  async function runRebuttals() {
    if (!requireDraft()) {
      return;
    }

    const id = ++runRef.current;
    setTab('rebuttals');
    setStage('thinking');
    setProgress(12);
    setLabel('Building rebuttals');
    setNotice('');
    setSource(null);

    try {
      const pack = advancedPack ?? buildLocalPack();
      const localText = speed
        ? renderSpeedDebateBrief(pack.speedBrief)
        : `${renderWarRoom(pack.warRoom)}\n\nRebuttal Cards\n\n${generateRebuttalReport({ opponentText: opponent || content, userCase: content, persona })}`;
      setSource('local');
      setNotice(speed ? 'Local speed debate brief is ready. Remote rapid model is still being requested.' : 'Local Rebuttal War Room is ready. Remote rebuttal coaching is still being requested.');
      reveal(localText, setRebuttals, speed ? 'Typing local rapid rebuttal' : 'Typing local rebuttal plan', id);

      setProgress(30);
      setLabel('Calling remote rebuttal model');
      const text = await postChat({ action: speed ? 'speed-rebuttal' : 'rebuttals', text: content, opponentText: opponent || content, persona, speedMode: speed });
      if (runRef.current !== id) {
        return;
      }
      setSource('remote');
      setNotice('Remote rebuttal coaching applied after the local debate brief.');
      reveal(`${localText}\n\nRemote Rebuttal Notes\n\n${text}`, setRebuttals, speed ? 'Typing rapid remote notes' : 'Typing remote rebuttal notes', id);
    } catch (error) {
      if (runRef.current !== id) {
        return;
      }
      setSource('local');
      setNotice(
        error instanceof ChatRequestError
          ? `Remote rebuttal model unavailable; showing the local rebuttal plan. ${formatChatRequestError(error)}`
          : 'Rebuttal lab hit an unexpected frontend error. The draft is still in the editor; try Rebuttals again.',
      );
      setStage('complete');
      setLabel('Local result ready');
    }
  }

  function runGraphEngine() {
    if (!requireDraft()) {
      return;
    }

    const id = ++runRef.current;
    setTab('graph');
    setStage('thinking');
    setProgress(18);
    setLabel('Mapping argument graph');
    setNotice('');
    const pack = buildLocalPack();
    setSource('local');
    setNotice('Interactive graph is ready. Click any node to inspect what it does and ask Fracture Chat about it.');
    reveal(renderInteractiveGraphText(pack.graph), setFracture, 'Typing graph notes', id);
  }

  function runMethodReport() {
    if (!requireDraft()) {
      return;
    }

    const id = ++runRef.current;
    setTab('export');
    setStage('thinking');
    setProgress(16);
    setLabel('Building Method Report v2');
    setNotice('');
    const pack = advancedPack ?? buildLocalPack();
    setSource('local');
    setNotice('Fracture Method Report v2 is ready as a local production-safe report.');
    reveal(pack.methodReport, setFracture, 'Typing Method Report v2', id);
  }

  function runAdvancedTools() {
    if (!requireDraft()) {
      return;
    }

    const id = ++runRef.current;
    setTab('advanced');
    setStage('thinking');
    setProgress(20);
    setLabel('Running advanced tools');
    setNotice('');
    const pack = advancedPack ?? buildLocalPack();
    setSource('local');
    setNotice('Collapse, missions, judge ballots, speech delivery, rubric alignment, and version tracking are ready.');
    reveal(advancedTools(pack, versionHistory), setAdvancedOutput, 'Typing advanced tool report', id);
  }

  function saveCurrentVersion() {
    if (!requireDraft()) {
      return;
    }

    const pack = advancedPack ?? buildLocalPack();
    const next = saveVersionHistoryEntry({ draft: content, pack });
    setVersionHistory(next);
    setTab('advanced');
    setAdvancedOutput(advancedTools(pack, next));
    setSource('local');
    setNotice(`Saved version ${next.length}. The version history now tracks score changes and remaining weaknesses.`);
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
        answer = `Local Fracture Chat fallback: the remote model is unavailable, so I used the local repair path. ${formatChatRequestError(error)}\n\nRepair path: assertion, reasoning, evidence, impact.`;
      } else {
        answer = 'Local Fracture Chat fallback: the remote model failed unexpectedly, so use the local repair path: assertion, reasoning, evidence, impact.';
      }
    }

    roll(answer, assistantIndex, id);
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-6 text-zinc-50 sm:px-8">
      <section className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-5">
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
                <option value="historian">Historian</option>
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

          <textarea className="min-h-[500px] w-full border border-zinc-900 bg-zinc-950 p-4 text-sm leading-7" placeholder="Paste your argument. Feedback appears only after you run an engine." value={content} onChange={(event) => setContent(event.target.value)} />
          <textarea className="min-h-28 w-full border border-zinc-900 bg-zinc-950 p-4 text-sm leading-7" placeholder="Optional opponent text, rubric, sources, or ballot notes." value={opponent} onChange={(event) => setOpponent(event.target.value)} />
        </div>

        <div className="grid gap-5">
          <div className="border border-zinc-900 bg-[#0c0c0e] p-5">
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-sm bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-950" onClick={runFracture} type="button"><Play className="h-4 w-4" />Run Fracture</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runGraphEngine} type="button"><Play className="h-4 w-4" />Argument Graph</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runCitations} type="button"><ClipboardCheck className="h-4 w-4" />Citation Engine</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runRebuttals} type="button"><Swords className="h-4 w-4" />War Room</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runMethodReport} type="button"><ClipboardCheck className="h-4 w-4" />Report v2</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={runAdvancedTools} type="button"><ClipboardCheck className="h-4 w-4" />Advanced Tools</button>
              <button className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm" onClick={saveCurrentVersion} type="button"><ClipboardCheck className="h-4 w-4" />Save Version</button>
              <button className={speed ? 'inline-flex items-center gap-2 bg-white px-4 py-3 text-sm font-bold text-zinc-950' : 'inline-flex items-center gap-2 border border-zinc-700 px-4 py-3 text-sm'} onClick={() => setSpeed((value) => !value)} type="button"><Zap className="h-4 w-4" />Speed mode</button>
            </div>
            <div className="mt-5"><Progress stage={stage} progress={progress} label={label} /></div>
            {notice && <p className="mt-4 border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">{notice}</p>}
            {source && <p className="mt-3 min-h-5 text-xs uppercase tracking-[0.24em] text-zinc-500">Showing {source} result</p>}
          </div>

          <div className="flex gap-2 overflow-x-auto border border-zinc-900 bg-[#0c0c0e] p-2">
            {tabs.map((item) => (
              <button className={tab === item ? 'shrink-0 bg-zinc-100 px-3 py-2 text-sm text-zinc-950' : 'shrink-0 px-3 py-2 text-sm text-zinc-400'} key={item} onClick={() => setTab(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          <section className="min-h-[610px] border border-zinc-900 bg-[#0c0c0e] p-5">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <h2 className="text-sm uppercase tracking-[0.28em] text-zinc-500">{tab}</h2>
              <button className="inline-flex items-center gap-2 border border-zinc-800 px-3 py-2 text-sm" onClick={() => openChat(active)} type="button"><MessageSquare className="h-4 w-4" />Ask Chat</button>
            </div>
            <div className="mt-5 h-[520px] overflow-y-auto whitespace-pre-wrap pr-3 text-sm leading-7 text-zinc-300" onDoubleClick={() => openChat(active)}>
              {tab === 'graph' ? (
                <ArgumentGraphView
                  onAsk={openChat}
                  onSelect={setSelectedNodeId}
                  pack={advancedPack}
                  selectedId={selectedNodeId}
                />
              ) : (
                active || 'Run an engine. Fracture stays blank until the user chooses.'
              )}
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

