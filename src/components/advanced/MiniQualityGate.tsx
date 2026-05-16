import { AlertTriangle, CheckCircle2, CircleDashed, ClipboardCheck, Play, X } from 'lucide-react';

export type QualityGateStatus = 'pass' | 'warn' | 'fail' | 'pending';

export type QualityGateItem = {
  id: string;
  label: string;
  status: QualityGateStatus;
  detail: string;
  score?: number;
  actionLabel?: string;
  onAction?: (gate: QualityGateItem) => void;
};

export type MiniQualityGateProps = {
  gates: QualityGateItem[];
  overallScore?: number;
  verdict?: string;
  heading?: string;
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
  isRunning?: boolean;
  runLabel?: string;
  onRun?: () => void;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function clampScore(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreTone(score: number | undefined): string {
  if (score === undefined) {
    return 'text-zinc-500';
  }
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

function statusTone(status: QualityGateStatus): string {
  if (status === 'pass') {
    return 'border-emerald-900/70 bg-emerald-950/25 text-emerald-200';
  }
  if (status === 'warn') {
    return 'border-amber-900/70 bg-amber-950/25 text-amber-200';
  }
  if (status === 'fail') {
    return 'border-rose-900/70 bg-rose-950/25 text-rose-200';
  }
  return 'border-zinc-800 bg-zinc-950 text-zinc-400';
}

function statusIcon(status: QualityGateStatus) {
  if (status === 'pass') {
    return CheckCircle2;
  }
  if (status === 'fail') {
    return X;
  }
  if (status === 'warn') {
    return AlertTriangle;
  }
  return CircleDashed;
}

function summarizeGates(gates: QualityGateItem[]): string {
  const pass = gates.filter((gate) => gate.status === 'pass').length;
  const warn = gates.filter((gate) => gate.status === 'warn').length;
  const fail = gates.filter((gate) => gate.status === 'fail').length;
  const pending = gates.filter((gate) => gate.status === 'pending').length;
  return `${pass} pass · ${warn} warn · ${fail} fail · ${pending} pending`;
}

export function MiniQualityGate({
  gates,
  overallScore,
  verdict,
  heading = 'Quality gate',
  ariaLabel = 'Mini quality gate',
  className = '',
  compact = false,
  isRunning = false,
  runLabel = 'Run quality gate',
  onRun,
}: MiniQualityGateProps) {
  const score = clampScore(overallScore);

  return (
    <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
          <p className="mt-2 text-sm text-zinc-400">{gates.length > 0 ? summarizeGates(gates) : 'No quality checks are configured.'}</p>
        </div>

        <div className="flex items-center gap-3">
          {score !== undefined && <span className={cx('text-3xl font-semibold', scoreTone(score))}>{score}</span>}
          {onRun && (
            <button
              aria-label={runLabel}
              className="flex h-10 w-10 items-center justify-center border border-zinc-800 bg-zinc-950 text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-600"
              disabled={isRunning}
              onClick={onRun}
              type="button"
            >
              {isRunning ? <CircleDashed className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>

      {verdict && (
        <div className="mt-4 border border-zinc-900 bg-zinc-950/60 p-3">
          <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Verdict
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{verdict}</p>
        </div>
      )}

      {gates.length > 0 && (
        <ul className={cx('mt-4 grid gap-2', !compact && 'sm:grid-cols-2')} aria-label="Quality gate checks">
          {gates.map((gate) => {
            const GateIcon = statusIcon(gate.status);
            const gateScore = clampScore(gate.score);
            return (
              <li className="border border-zinc-900 bg-zinc-950/60 p-3" key={gate.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={cx('inline-flex items-center gap-1 border px-2 py-1 text-[10px] uppercase tracking-wider', statusTone(gate.status))}>
                      <GateIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {gate.status}
                    </span>
                    <h3 className="mt-3 text-sm font-medium text-zinc-100">{gate.label}</h3>
                  </div>
                  {gateScore !== undefined && <span className={cx('text-sm font-semibold', scoreTone(gateScore))}>{gateScore}</span>}
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{gate.detail}</p>
                {gate.actionLabel && gate.onAction && (
                  <button
                    aria-label={gate.actionLabel}
                    className="mt-3 border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-zinc-50"
                    onClick={() => gate.onAction?.(gate)}
                    type="button"
                  >
                    {gate.actionLabel}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
