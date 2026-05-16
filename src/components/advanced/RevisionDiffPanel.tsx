import { Check, FileDiff, Minus, Plus, Split, X } from 'lucide-react';

export type RevisionDiffChangeType = 'added' | 'removed' | 'changed' | 'unchanged';
export type RevisionDiffSeverity = 'low' | 'medium' | 'high';

export type RevisionDiffChange = {
  id: string;
  type: RevisionDiffChangeType;
  label: string;
  before?: string;
  after?: string;
  note?: string;
  severity?: RevisionDiffSeverity;
};

export type RevisionDiffMetric = {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
};

export type RevisionDiffPanelProps = {
  changes: RevisionDiffChange[];
  metrics?: RevisionDiffMetric[];
  heading?: string;
  beforeLabel?: string;
  afterLabel?: string;
  ariaLabel?: string;
  className?: string;
  onAcceptChange?: (change: RevisionDiffChange) => void;
  onRejectChange?: (change: RevisionDiffChange) => void;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function metricTone(tone: RevisionDiffMetric['tone']): string {
  if (tone === 'good') {
    return 'text-emerald-300';
  }
  if (tone === 'warning') {
    return 'text-amber-300';
  }
  if (tone === 'danger') {
    return 'text-rose-300';
  }
  return 'text-zinc-100';
}

function changeTone(type: RevisionDiffChangeType): string {
  if (type === 'added') {
    return 'border-emerald-900/70 bg-emerald-950/20 text-emerald-200';
  }
  if (type === 'removed') {
    return 'border-rose-900/70 bg-rose-950/20 text-rose-200';
  }
  if (type === 'changed') {
    return 'border-amber-900/70 bg-amber-950/20 text-amber-200';
  }
  return 'border-zinc-800 bg-zinc-950 text-zinc-400';
}

function severityTone(severity: RevisionDiffSeverity | undefined): string {
  if (severity === 'high') {
    return 'text-rose-300';
  }
  if (severity === 'medium') {
    return 'text-amber-300';
  }
  if (severity === 'low') {
    return 'text-emerald-300';
  }
  return 'text-zinc-500';
}

function changeIcon(type: RevisionDiffChangeType) {
  if (type === 'added') {
    return Plus;
  }
  if (type === 'removed') {
    return Minus;
  }
  if (type === 'changed') {
    return Split;
  }
  return Check;
}

export function RevisionDiffPanel({
  changes,
  metrics = [],
  heading = 'Revision diff',
  beforeLabel = 'Before',
  afterLabel = 'After',
  ariaLabel = 'Revision difference panel',
  className = '',
  onAcceptChange,
  onRejectChange,
}: RevisionDiffPanelProps) {
  return (
    <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {changes.length} {changes.length === 1 ? 'change' : 'changes'} in review
          </p>
        </div>
        <FileDiff className="h-5 w-5 text-zinc-400" aria-hidden="true" />
      </div>

      {metrics.length > 0 && (
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div className="border border-zinc-900 bg-zinc-950/60 p-3" key={metric.label}>
              <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{metric.label}</dt>
              <dd className={cx('mt-2 text-xl font-semibold', metricTone(metric.tone))}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {changes.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-zinc-400">No revision differences are available for the selected versions.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {changes.map((change) => {
            const ChangeIcon = changeIcon(change.type);
            return (
              <article className="border border-zinc-900 bg-zinc-950/60 p-4" key={change.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx('inline-flex items-center gap-1 border px-2 py-1 text-[10px] uppercase tracking-wider', changeTone(change.type))}>
                        <ChangeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {change.type}
                      </span>
                      {change.severity && <span className={cx('text-xs uppercase tracking-wider', severityTone(change.severity))}>{change.severity} risk</span>}
                    </div>
                    <h3 className="mt-3 text-sm font-medium text-zinc-100">{change.label}</h3>
                    {change.note && <p className="mt-2 text-xs leading-5 text-zinc-500">{change.note}</p>}
                  </div>

                  {(onAcceptChange || onRejectChange) && (
                    <div className="flex shrink-0 items-center gap-2">
                      {onAcceptChange && (
                        <button
                          aria-label={`Accept change ${change.label}`}
                          className="flex h-9 w-9 items-center justify-center border border-zinc-800 text-zinc-300 transition-colors hover:border-emerald-700 hover:text-emerald-200"
                          onClick={() => onAcceptChange(change)}
                          type="button"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      {onRejectChange && (
                        <button
                          aria-label={`Reject change ${change.label}`}
                          className="flex h-9 w-9 items-center justify-center border border-zinc-800 text-zinc-300 transition-colors hover:border-rose-700 hover:text-rose-200"
                          onClick={() => onRejectChange(change)}
                          type="button"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="border border-zinc-900 bg-[#09090b] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{beforeLabel}</p>
                    <p className={cx('mt-2 whitespace-pre-wrap text-sm leading-6', change.type === 'removed' ? 'text-rose-200' : 'text-zinc-300')}>
                      {change.before || (change.type === 'added' ? 'Added in this revision.' : 'No earlier text recorded.')}
                    </p>
                  </div>
                  <div className="border border-zinc-900 bg-[#09090b] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">{afterLabel}</p>
                    <p className={cx('mt-2 whitespace-pre-wrap text-sm leading-6', change.type === 'added' ? 'text-emerald-200' : 'text-zinc-300')}>
                      {change.after || (change.type === 'removed' ? 'Removed in this revision.' : 'No revised text recorded.')}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
