import { Activity, BarChart3, Clock3, RotateCcw, Scale, Target, Trophy } from 'lucide-react';

export type ImpactWeighingScores = {
  magnitude: number;
  probability: number;
  timeframe: number;
  reversibility: number;
};

export type ImpactWeighingItem = {
  id: string;
  label: string;
  side?: string;
  claim: string;
  scores: ImpactWeighingScores;
  evidence?: string;
  comparativeClaim?: string;
};

export type ImpactWeighingPanelProps = {
  impacts: ImpactWeighingItem[];
  activeImpactId?: string;
  heading?: string;
  ariaLabel?: string;
  className?: string;
  onImpactSelect?: (impact: ImpactWeighingItem) => void;
};

type ImpactMetricKey = keyof ImpactWeighingScores;

const metricConfig: Array<{ key: ImpactMetricKey; label: string; icon: typeof BarChart3 }> = [
  { key: 'magnitude', label: 'Magnitude', icon: BarChart3 },
  { key: 'probability', label: 'Probability', icon: Target },
  { key: 'timeframe', label: 'Timeframe', icon: Clock3 },
  { key: 'reversibility', label: 'Reversibility', icon: RotateCcw },
];

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function impactScore(impact: ImpactWeighingItem): number {
  const scores = metricConfig.map((metric) => clampScore(impact.scores[metric.key]));
  return clampScore(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

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

function MetricBar({ label, value }: { label: string; value: number }) {
  const score = clampScore(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span className={scoreTone(score)}>{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-zinc-800" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
        <div className="h-full bg-zinc-100" style={{ width: `${Math.max(4, score)}%` }} />
      </div>
    </div>
  );
}

export function ImpactWeighingPanel({
  impacts,
  activeImpactId,
  heading = 'Impact weighing',
  ariaLabel = 'Impact weighing panel',
  className = '',
  onImpactSelect,
}: ImpactWeighingPanelProps) {
  const rankedImpacts = [...impacts].sort((a, b) => impactScore(b) - impactScore(a));
  const winningImpact = rankedImpacts[0];

  return (
    <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {rankedImpacts.length} {rankedImpacts.length === 1 ? 'impact' : 'impacts'} weighed
          </p>
        </div>
        <Scale className="h-5 w-5 text-zinc-400" aria-hidden="true" />
      </div>

      {rankedImpacts.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-zinc-400">No impact claims are available for weighing.</p>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3">
            {rankedImpacts.map((impact, index) => {
              const score = impactScore(impact);
              const selected = impact.id === (activeImpactId ?? winningImpact?.id);
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-zinc-500">Rank {index + 1}</p>
                      <h3 className="mt-2 text-sm font-medium text-zinc-100">{impact.label}</h3>
                    </div>
                    <span className={cx('text-2xl font-semibold', scoreTone(score))}>{score}</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{impact.claim}</p>
                  {impact.side && <p className="mt-3 text-[10px] uppercase tracking-wider text-zinc-500">{impact.side}</p>}
                </>
              );

              return onImpactSelect ? (
                <button
                  aria-pressed={selected}
                  aria-label={`Select impact ${impact.label}`}
                  className={cx(
                    'border p-4 text-left transition-colors',
                    selected ? 'border-zinc-500 bg-zinc-900/80' : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-700',
                  )}
                  key={impact.id}
                  onClick={() => onImpactSelect(impact)}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <article className={cx('border border-zinc-900 bg-zinc-950/60 p-4', selected && 'border-zinc-500 bg-zinc-900/80')} key={impact.id}>
                  {content}
                </article>
              );
            })}
          </div>

          {winningImpact && (
            <article className="border border-zinc-900 bg-zinc-950/60 p-4" aria-label="Top weighed impact">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    Highest net impact
                  </p>
                  <h3 className="mt-3 text-lg font-medium leading-7 text-zinc-100">{winningImpact.label}</h3>
                </div>
                <span className={cx('text-4xl font-semibold', scoreTone(impactScore(winningImpact)))}>{impactScore(winningImpact)}</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-300">{winningImpact.claim}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {metricConfig.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <div className="border border-zinc-900 bg-[#09090b] p-3" key={metric.key}>
                      <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {metric.label}
                      </p>
                      <div className="mt-3">
                        <MetricBar label={metric.label} value={winningImpact.scores[metric.key]} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {(winningImpact.evidence || winningImpact.comparativeClaim) && (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {winningImpact.evidence && (
                    <div className="border border-zinc-900 bg-[#09090b] p-3">
                      <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                        Evidence anchor
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{winningImpact.evidence}</p>
                    </div>
                  )}
                  {winningImpact.comparativeClaim && (
                    <div className="border border-zinc-900 bg-[#09090b] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500">Comparative claim</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-300">{winningImpact.comparativeClaim}</p>
                    </div>
                  )}
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </section>
  );
}
