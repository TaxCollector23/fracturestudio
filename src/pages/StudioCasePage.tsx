import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  GitBranch,
  Loader2,
  MessageSquare,
  Network,
  PenTool,
  Play,
  Shield,
  Swords,
  type LucideIcon,
} from 'lucide-react';
import { buildCitationReport, renderCitationReport } from '../lib/citationEngine';
import { analyzeArgument, renderFractureAnalysis, type FractureAnalysis, type JudgeMode } from '../lib/fractureEngine';
import { generateRebuttalReport, type OpponentPersona } from '../lib/rebuttalEngine';
import { ChatRequestError, formatChatRequestError, postChat } from '../chatClient';

type StudioTab = 'write' | 'fracture' | 'graph' | 'citations' | 'rebuttals' | 'crossfire' | 'rubric' | 'export';

type StudioTabConfig = {
  id: StudioTab;
  label: string;
  icon: LucideIcon;
};

const studioTabs: StudioTabConfig[] = [
  { id: 'write', label: 'Draft', icon: PenTool },
  { id: 'fracture', label: 'Fracture', icon: Activity },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'citations', label: 'Citations', icon: BookOpen },
  { id: 'rebuttals', label: 'Rebuttals', icon: Swords },
  { id: 'crossfire', label: 'Crossfire', icon: MessageSquare },
  { id: 'rubric', label: 'Rubric', icon: ClipboardCheck },
  { id: 'export', label: 'Export', icon: FileDown },
];

const judgeModes: { id: JudgeMode; label: string }[] = [
  { id: 'debate', label: 'Debate judge' },
  { id: 'teacher', label: 'English teacher' },
  { id: 'historian', label: 'Skeptical historian' },
  { id: 'professor', label: 'College professor' },
  { id: 'reader', label: 'Normal reader' },
];

const personas: { id: OpponentPersona; label: string }[] = [
  { id: 'logical', label: 'Logical' },
  { id: 'aggressive', label: 'Aggressive' },
  { id: 'emotional', label: 'Emotional' },
  { id: 'evidence-heavy', label: 'Evidence-heavy' },
  { id: 'skeptical', label: 'Skeptical' },
  { id: 'debate-champion', label: 'Debate champion' },
];

const caseStorageKey = 'fracture-studio-current-case';

function scoreTone(score: number): string {
  if (score >= 78) {
    return 'text-emerald-300';
  }
  if (score >= 62) {
    return 'text-sky-300';
  }
  if (score >= 45) {
    return 'text-amber-300';
  }
  return 'text-rose-300';
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`border border-zinc-800 bg-[#0c0c0e] p-5 ${className}`}>{children}</section>;
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className={scoreTone(value)}>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-zinc-800">
        <div className="h-full bg-zinc-100" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`flex h-10 w-10 items-center justify-center rounded-sm border transition-colors ${
        active ? 'border-zinc-500 bg-zinc-800 text-white' : 'border-transparent text-zinc-500 hover:border-zinc-800 hover:text-zinc-200'
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function VerdictPanel({ analysis }: { analysis: FractureAnalysis }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Verdict</p>
          <h2 className={`mt-2 font-serif text-4xl italic ${scoreTone(analysis.scores.overall)}`}>{analysis.verdict.label}</h2>
        </div>
        <div className={`text-5xl font-semibold ${scoreTone(analysis.scores.overall)}`}>{analysis.scores.overall}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{analysis.verdict.reason}</p>
    </Panel>
  );
}

function MissionRail({ analysis }: { analysis: FractureAnalysis }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Revision Missions</p>
      <div className="mt-4 space-y-3">
        {analysis.missions.map((mission, index) => (
          <div className="flex gap-3 border-t border-zinc-900 pt-3" key={mission}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-zinc-100 text-xs font-bold text-black">{index + 1}</span>
            <p className="text-sm leading-6 text-zinc-300">{mission}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ArgumentGraphView({ analysis }: { analysis: FractureAnalysis }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel>
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Argument Graph Engine</p>
        <div className="mt-6 space-y-5">
          {analysis.graph.nodes.slice(0, 10).map((node) => (
            <div className="relative border-l border-zinc-700 pl-5" key={node.id}>
              <div className="absolute -left-[5px] top-2 h-2.5 w-2.5 bg-zinc-100" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-zinc-900 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400">{node.type}</span>
                <span className={`text-xs ${scoreTone(node.strength)}`}>{node.strength}/100</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-200">{node.label}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Claim-to-Evidence Lines</p>
        <div className="mt-6 space-y-3">
          {analysis.graph.edges.slice(0, 12).map((edge) => (
            <div className="flex items-center gap-3 border-b border-zinc-900 pb-3 text-sm text-zinc-400" key={`${edge.from}-${edge.to}-${edge.label}`}>
              <GitBranch className="h-4 w-4 text-zinc-500" />
              <span className="text-zinc-200">{edge.from}</span>
              <span>{edge.label}</span>
              <span className="text-zinc-200">{edge.to}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function HeatmapPanel({ analysis }: { analysis: FractureAnalysis }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Logic Heatmap</p>
      <div className="mt-4 space-y-3">
        {analysis.heatmap.slice(0, 8).map((item) => (
          <div className="border-l-2 border-zinc-700 bg-zinc-950/60 p-3" key={`${item.kind}-${item.sentence}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">{item.kind}</span>
              <span className={scoreTone(100 - item.severity * 16)}>severity {item.severity}/5</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{item.sentence}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{item.fix}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FrameworkMatrix({ analysis }: { analysis: FractureAnalysis }) {
  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Ten-Model Speaking Flow</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {analysis.modelPasses.map((pass) => (
          <div className="border border-zinc-900 bg-zinc-950/60 p-4" key={pass.model}>
            <p className="font-medium text-zinc-100">{pass.model}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{pass.purpose}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{pass.diagnosis}</p>
            <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">{pass.nextMove}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FeatureLedger({ analysis }: { analysis: FractureAnalysis }) {
  const rows = [
    ['Unsupported Claim Finder', analysis.unsupportedClaims[0]?.text || 'No unsupported major claim found.'],
    ['Hidden Assumption Detector', analysis.assumptions[0]],
    ['Warrant Analyzer', analysis.claims[0]?.warrant || 'Add a claim to inspect warrants.'],
    ['Burden of Proof Meter', analysis.burdenOfProof],
    ['Argument Collapse Point', analysis.collapsePoint],
    ['Reader Confusion Predictor', analysis.readerConfusion[0] || 'No major reader confusion point found.'],
    ['Evidence Upgrade Recommender', analysis.evidenceUpgrades[0] || 'Evidence coverage is acceptable for the current draft.'],
    ['Fallacy Severity System', analysis.fallacies[0] ? `${analysis.fallacies[0].label}: ${analysis.fallacies[0].reason}` : 'No severe fallacy signal found.'],
    ['Quote Integration Checker', analysis.quoteIntegration[0] || 'No dropped quote risk found.'],
    ['Weak Paragraph Ranking', analysis.paragraphRankings[0] ? `Paragraph ${analysis.paragraphRankings[0].paragraph}: ${analysis.paragraphRankings[0].reason}` : 'Add paragraphs to rank them.'],
  ];

  return (
    <Panel>
      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Feature Ledger</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div className="border border-zinc-900 bg-zinc-950/60 p-4" key={label}>
            <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{value}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AssistantPanel({
  activeTab,
  analysis,
  output,
  notice,
  loading,
}: {
  activeTab: StudioTab;
  analysis: FractureAnalysis;
  output: string;
  notice: string | null;
  loading: boolean;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-zinc-800 bg-[#09090b] lg:w-[430px] lg:border-l lg:border-t-0">
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Fracture Engine</p>
            <h2 className="mt-2 font-serif text-2xl italic text-zinc-50">{activeTab === 'write' ? 'Live read' : studioTabs.find((tab) => tab.id === activeTab)?.label}</h2>
          </div>
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-zinc-400" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
        </div>
        {notice && <p className="mt-4 border border-amber-900/60 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">{notice}</p>}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <VerdictPanel analysis={analysis} />
        <div className="grid gap-4">
          <MetricBar label="Logic" value={analysis.scores.logic} />
          <MetricBar label="Evidence" value={analysis.scores.evidence} />
          <MetricBar label="Clarity" value={analysis.scores.clarity} />
          <MetricBar label="Rebuttal" value={analysis.scores.rebuttal} />
        </div>
        <MissionRail analysis={analysis} />
        {output && (
          <Panel>
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Latest Run</p>
            <div className="mt-4 max-h-[34vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-zinc-300">{output}</div>
          </Panel>
        )}
      </div>
    </aside>
  );
}

export function StudioCasePage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('write');
  const [title, setTitle] = useState('Untitled argument');
  const [content, setContent] = useState('');
  const [audience, setAudience] = useState('judge');
  const [judgeMode, setJudgeMode] = useState<JudgeMode>('debate');
  const [rubric, setRubric] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [engineNotice, setEngineNotice] = useState<string | null>(null);
  const [fractureOutput, setFractureOutput] = useState('');
  const [citationOutput, setCitationOutput] = useState('');
  const [rebuttalOutput, setRebuttalOutput] = useState('');

  const [citationStyle, setCitationStyle] = useState('APA');
  const [sourcesText, setSourcesText] = useState('');
  const [searchWeb, setSearchWeb] = useState(true);
  const [opponentText, setOpponentText] = useState('');
  const [opponentPersona, setOpponentPersona] = useState<OpponentPersona>('logical');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(caseStorageKey);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw) as { title?: string; content?: string; sourcesText?: string; opponentText?: string; rubric?: string };
      setTitle(saved.title || 'Untitled argument');
      setContent(saved.content || '');
      setSourcesText(saved.sourcesText || '');
      setOpponentText(saved.opponentText || '');
      setRubric(saved.rubric || '');
    } catch {
      window.localStorage.removeItem(caseStorageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(caseStorageKey, JSON.stringify({ title, content, sourcesText, opponentText, rubric }));
  }, [title, content, sourcesText, opponentText, rubric]);

  const analysis = useMemo(() => analyzeArgument(content, { judgeMode, rubric, audience }), [content, judgeMode, rubric, audience]);
  const localAnalysisOutput = useMemo(() => renderFractureAnalysis(analysis), [analysis]);
  const localCitationOutput = useMemo(
    () => renderCitationReport(buildCitationReport({ style: citationStyle, sourcesText, claimText: content })),
    [citationStyle, sourcesText, content],
  );
  const localRebuttalOutput = useMemo(
    () => generateRebuttalReport({ opponentText, userCase: content, persona: opponentPersona }),
    [opponentPersona, opponentText, content],
  );

  const canRun =
    (activeTab === 'write' || activeTab === 'fracture' || activeTab === 'graph' || activeTab === 'crossfire' || activeTab === 'rubric' || activeTab === 'export') &&
    content.trim().length > 0;
  const canRunCitation = activeTab === 'citations' && sourcesText.trim().length > 0;
  const canRunRebuttal = activeTab === 'rebuttals' && opponentText.trim().length > 0 && content.trim().length > 0;

  const runFracture = async () => {
    if (!content.trim() || isLoading) {
      return;
    }
    setIsLoading(true);
    setEngineNotice(null);
    try {
      const text = await postChat({
        action: 'fracture',
        messages: [{ role: 'user', content }],
        judgeMode,
        audience,
        rubric,
      });
      setFractureOutput(text);
    } catch (error) {
      setFractureOutput(localAnalysisOutput);
      const detail = error instanceof ChatRequestError ? formatChatRequestError(error) : 'Remote model did not answer.';
      setEngineNotice(`Local Fracture report is complete. Remote enhancement was skipped: ${detail}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runCitations = async () => {
    if (!sourcesText.trim() || isLoading) {
      return;
    }
    setIsLoading(true);
    setEngineNotice(null);
    try {
      const text = await postChat({
        action: 'citations',
        citationStyle,
        sourcesText,
        claimText: content,
        searchWeb,
      });
      setCitationOutput(text);
    } catch (error) {
      setCitationOutput(localCitationOutput);
      const detail = error instanceof ChatRequestError ? formatChatRequestError(error) : 'Citation service did not answer.';
      setEngineNotice(`Local citation report is complete. Web or model enhancement was skipped: ${detail}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runRebuttals = async () => {
    if (!opponentText.trim() || !content.trim() || isLoading) {
      return;
    }
    setIsLoading(true);
    setEngineNotice(null);
    try {
      const text = await postChat({
        action: 'rebuttals',
        opponentText,
        userCase: content,
        persona: opponentPersona,
      });
      setRebuttalOutput(text);
    } catch (error) {
      setRebuttalOutput(localRebuttalOutput);
      const detail = error instanceof ChatRequestError ? formatChatRequestError(error) : 'Rebuttal service did not answer.';
      setEngineNotice(`Local rebuttal drill is complete. Remote enhancement was skipped: ${detail}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runActive = () => {
    if (activeTab === 'citations') {
      void runCitations();
      return;
    }
    if (activeTab === 'rebuttals') {
      void runRebuttals();
      return;
    }
    void runFracture();
  };

  const exportText = `# ${title}\n\n${content}\n\n---\n\n${localAnalysisOutput}\n\n---\n\n${localCitationOutput}\n\n---\n\n${localRebuttalOutput}`;

  const activeOutput =
    activeTab === 'citations'
      ? citationOutput || localCitationOutput
      : activeTab === 'rebuttals'
        ? rebuttalOutput || localRebuttalOutput
        : fractureOutput || localAnalysisOutput;

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090b] text-zinc-50">
      <div className="hidden w-16 shrink-0 flex-col items-center gap-5 border-r border-zinc-800 py-5 lg:flex">
        <Link
          aria-label="Back to dashboard"
          className="mb-2 flex h-9 w-9 items-center justify-center rounded-sm bg-zinc-100 text-zinc-950"
          to="/studio/dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {studioTabs.map((tab) => (
          <SidebarButton active={activeTab === tab.id} icon={tab.icon} key={tab.id} label={tab.label} onClick={() => setActiveTab(tab.id)} />
        ))}
      </div>

      <motion.div animate={{ opacity: 1 }} className="flex min-w-0 flex-1 flex-col" initial={{ opacity: 0 }} transition={{ duration: 0.2 }} id="main">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-zinc-800 text-zinc-300 lg:hidden" to="/studio/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <input
                aria-label="Case title"
                className="w-full bg-transparent text-sm font-medium text-zinc-100 outline-none"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                <span>{analysis.wordCount} words</span>
                <span>{analysis.claims.length} claims</span>
                <span>{analysis.unsupportedClaims.length} unsupported</span>
                <span>{analysis.verdict.label}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <select
              className="min-h-10 flex-1 border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none sm:flex-none"
              onChange={(event) => setJudgeMode(event.target.value as JudgeMode)}
              value={judgeMode}
            >
              {judgeModes.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
            <button
              className="flex min-h-10 items-center justify-center gap-2 bg-zinc-100 px-4 text-xs font-bold uppercase tracking-wider text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              disabled={isLoading || (!canRun && !canRunCitation && !canRunRebuttal)}
              onClick={runActive}
              type="button"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run
            </button>
          </div>
        </header>

        <div className="flex border-b border-zinc-800 bg-zinc-950/80 px-4 lg:hidden">
          <div className="flex gap-2 overflow-x-auto py-2">
            {studioTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  className={`flex items-center gap-2 border px-3 py-2 text-xs ${activeTab === tab.id ? 'border-zinc-500 bg-zinc-800 text-white' : 'border-zinc-800 text-zinc-400'}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <main className="min-h-0 flex-1 overflow-y-auto bg-[#0c0c0e]">
            {activeTab === 'write' && (
              <div className="mx-auto max-w-4xl px-5 py-8 sm:px-10 lg:py-14">
                <input
                  aria-label="Argument audience"
                  className="mb-8 w-full border-b border-zinc-800 bg-transparent pb-3 text-xs uppercase tracking-[0.28em] text-zinc-500 outline-none"
                  onChange={(event) => setAudience(event.target.value)}
                  value={audience}
                />
                <textarea
                  aria-label="Argument draft"
                  className="min-h-[62vh] w-full resize-none bg-transparent font-serif text-2xl leading-relaxed text-zinc-100 outline-none sm:text-3xl"
                  onChange={(event) => setContent(event.target.value)}
                  value={content}
                />
              </div>
            )}

            {activeTab === 'fracture' && (
              <div className="space-y-5 p-5 lg:p-8">
                <VerdictPanel analysis={analysis} />
                <div className="grid gap-5 xl:grid-cols-2">
                  <Panel>
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Thesis Precision Engine</p>
                    <p className="mt-4 text-lg leading-7 text-zinc-100">{analysis.thesis.text}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {analysis.thesis.precision.map((item) => (
                        <div className="border border-zinc-900 bg-zinc-950/60 p-3 text-sm text-zinc-300" key={item}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel>
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Score Breakdown</p>
                    <div className="mt-5 grid gap-4">
                      <MetricBar label="Logic" value={analysis.scores.logic} />
                      <MetricBar label="Evidence" value={analysis.scores.evidence} />
                      <MetricBar label="Clarity" value={analysis.scores.clarity} />
                      <MetricBar label="Originality" value={analysis.scores.originality} />
                      <MetricBar label="Rebuttal" value={analysis.scores.rebuttal} />
                    </div>
                  </Panel>
                </div>
                <FeatureLedger analysis={analysis} />
                <HeatmapPanel analysis={analysis} />
                <FrameworkMatrix analysis={analysis} />
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="space-y-5 p-5 lg:p-8">
                <ArgumentGraphView analysis={analysis} />
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Impact Chain Builder</p>
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {analysis.impactChain.map((item, index) => (
                      <div className="border border-zinc-900 bg-zinc-950/60 p-4" key={item}>
                        <span className="text-xs text-zinc-500">0{index + 1}</span>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === 'citations' && (
              <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Citation Engine</p>
                  <div className="mt-5 grid gap-4">
                    <select
                      className="min-h-11 border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none"
                      onChange={(event) => setCitationStyle(event.target.value)}
                      value={citationStyle}
                    >
                      <option value="APA">APA</option>
                      <option value="MLA">MLA</option>
                      <option value="Chicago notes">Chicago notes</option>
                    </select>
                    <label className="flex items-center justify-between gap-3 border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-300">
                      Web source search
                      <input checked={searchWeb} className="h-5 w-5 accent-zinc-100" onChange={(event) => setSearchWeb(event.target.checked)} type="checkbox" />
                    </label>
                    <textarea
                      aria-label="Citation sources"
                      className="min-h-[280px] resize-y border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-7 text-zinc-100 outline-none"
                      onChange={(event) => setSourcesText(event.target.value)}
                      value={sourcesText}
                    />
                  </div>
                </Panel>
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Bibliography, Source Links, and Citation Risk</p>
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{activeOutput}</div>
                </Panel>
              </div>
            )}

            {activeTab === 'rebuttals' && (
              <div className="grid gap-5 p-5 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Opponent Simulator</p>
                  <select
                    className="mt-5 min-h-11 w-full border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none"
                    onChange={(event) => setOpponentPersona(event.target.value as OpponentPersona)}
                    value={opponentPersona}
                  >
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    aria-label="Opponent text"
                    className="mt-4 min-h-[330px] w-full resize-y border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-7 text-zinc-100 outline-none"
                    onChange={(event) => setOpponentText(event.target.value)}
                    value={opponentText}
                  />
                </Panel>
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Rebuttal Generator</p>
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">{activeOutput}</div>
                </Panel>
              </div>
            )}

            {activeTab === 'crossfire' && (
              <div className="grid gap-5 p-5 xl:grid-cols-2 xl:p-8">
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Cross-Examination Simulator</p>
                  <div className="mt-5 space-y-3">
                    {analysis.crossfireQuestions.map((question) => (
                      <div className="border border-zinc-900 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300" key={question}>
                        {question}
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Judge Questions Predictor</p>
                  <div className="mt-5 space-y-3">
                    {analysis.judgeQuestions.map((question) => (
                      <div className="border border-zinc-900 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300" key={question}>
                        {question}
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel className="xl:col-span-2">
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Speech Risk Meter</p>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {analysis.readerConfusion.concat(analysis.evidenceUpgrades).slice(0, 6).map((risk) => (
                      <div className="border border-zinc-900 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300" key={risk}>
                        {risk}
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === 'rubric' && (
              <div className="grid gap-5 p-5 lg:grid-cols-[0.85fr_1.15fr] lg:p-8">
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Rubric Alignment Checker</p>
                  <textarea
                    aria-label="Rubric criteria"
                    className="mt-5 min-h-[380px] w-full resize-y border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-7 text-zinc-100 outline-none"
                    onChange={(event) => setRubric(event.target.value)}
                    value={rubric}
                  />
                </Panel>
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Alignment Readout</p>
                  <div className="mt-5 space-y-4">
                    <p className="text-sm leading-7 text-zinc-300">{analysis.burdenOfProof}</p>
                    {analysis.evidenceUpgrades.slice(0, 6).map((item) => (
                      <div className="border border-zinc-900 bg-zinc-950/60 p-4 text-sm leading-6 text-zinc-300" key={item}>
                        {item}
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="grid gap-5 p-5 lg:grid-cols-[320px_1fr] lg:p-8">
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Export Packet</p>
                  <div className="mt-5 grid gap-3">
                    <button
                      className="flex min-h-11 items-center justify-center gap-2 bg-zinc-100 px-4 text-sm font-bold text-zinc-950"
                      onClick={() => void navigator.clipboard?.writeText(exportText)}
                      type="button"
                    >
                      <Shield className="h-4 w-4" />
                      Copy report
                    </button>
                    <button
                      className="flex min-h-11 items-center justify-center gap-2 border border-zinc-800 px-4 text-sm text-zinc-200"
                      onClick={() => {
                        const blob = new Blob([exportText], { type: 'text/markdown;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'fracture-report'}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      type="button"
                    >
                      <FileDown className="h-4 w-4" />
                      Download markdown
                    </button>
                  </div>
                </Panel>
                <Panel>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Before/After and Final Packet</p>
                  <pre className="mt-5 max-h-[70vh] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-zinc-300">{exportText}</pre>
                </Panel>
              </div>
            )}
          </main>

          <AssistantPanel activeTab={activeTab} analysis={analysis} loading={isLoading} notice={engineNotice} output={activeOutput} />
        </div>
      </motion.div>
    </div>
  );
}
