import { AlertTriangle, CheckCircle2, Clock3, GitCommitHorizontal, LockKeyhole, User } from 'lucide-react';

export type VersionTimelineStatus = 'draft' | 'reviewed' | 'locked' | 'flagged';
export type VersionTimelineRisk = 'low' | 'medium' | 'high';

export type VersionTimelineItem = {
  id: string;
  label: string;
  createdAt: string | Date;
  summary: string;
  author?: string;
  status?: VersionTimelineStatus;
  score?: number;
  risk?: VersionTimelineRisk;
  changes?: string[];
};

export type VersionTimelineProps = {
  versions: VersionTimelineItem[];
  activeVersionId?: string;
  heading?: string;
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
  onVersionSelect?: (version: VersionTimelineItem) => void;
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

function statusTone(status: VersionTimelineStatus | undefined): string {
  if (status === 'reviewed') {
    return 'border-emerald-900/70 bg-emerald-950/25 text-emerald-200';
  }
  if (status === 'locked') {
    return 'border-sky-900/70 bg-sky-950/25 text-sky-200';
  }
  if (status === 'flagged') {
    return 'border-amber-900/70 bg-amber-950/25 text-amber-200';
  }
  return 'border-zinc-800 bg-zinc-950 text-zinc-400';
}

function riskTone(risk: VersionTimelineRisk | undefined): string {
  if (risk === 'high') {
    return 'text-rose-300';
  }
  if (risk === 'medium') {
    return 'text-amber-300';
  }
  if (risk === 'low') {
    return 'text-emerald-300';
  }
  return 'text-zinc-500';
}

function statusIcon(status: VersionTimelineStatus | undefined) {
  if (status === 'reviewed') {
    return CheckCircle2;
  }
  if (status === 'locked') {
    return LockKeyhole;
  }
  if (status === 'flagged') {
    return AlertTriangle;
  }
  return GitCommitHorizontal;
}

function formatRevisionDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function dateTimeAttribute(value: string | Date): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function VersionTimeline({
  versions,
  activeVersionId,
  heading = 'Version timeline',
  ariaLabel = 'Version timeline',
  className = '',
  compact = false,
  onVersionSelect,
}: VersionTimelineProps) {
  const sortedVersions = [...versions].sort((a, b) => {
    const first = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const second = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return (Number.isNaN(second) ? 0 : second) - (Number.isNaN(first) ? 0 : first);
  });

  if (sortedVersions.length === 0) {
    return (
      <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
        <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
        <p className="mt-4 text-sm leading-6 text-zinc-400">No saved revisions for this case.</p>
      </section>
    );
  }

  return (
    <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {sortedVersions.length} {sortedVersions.length === 1 ? 'revision' : 'revisions'} recorded
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          Newest first
        </div>
      </div>

      <ol className={cx('mt-5 space-y-3', compact && 'space-y-2')}>
        {sortedVersions.map((version, index) => {
          const score = clampScore(version.score);
          const selected = version.id === activeVersionId;
          const StatusIcon = statusIcon(version.status);
          const content = (
            <div className="grid gap-3 sm:grid-cols-[24px_1fr]">
              <div className="relative hidden sm:block" aria-hidden="true">
                <span className={cx('absolute left-2.5 top-2 h-full w-px bg-zinc-900', index === sortedVersions.length - 1 && 'hidden')} />
                <span className={cx('relative z-10 flex h-5 w-5 items-center justify-center border', selected ? 'border-zinc-200 bg-zinc-100 text-zinc-950' : 'border-zinc-700 bg-zinc-950 text-zinc-400')}>
                  <StatusIcon className="h-3.5 w-3.5" />
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-zinc-100">{version.label}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <time dateTime={dateTimeAttribute(version.createdAt)}>{formatRevisionDate(version.createdAt)}</time>
                      {version.author && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" aria-hidden="true" />
                          {version.author}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className={cx('border px-2 py-1 text-[10px] uppercase tracking-wider', statusTone(version.status))}>
                      {version.status ?? 'draft'}
                    </span>
                    {score !== undefined && <span className={cx('text-sm font-semibold', scoreTone(score))}>{score}</span>}
                  </div>
                </div>

                <p className={cx('mt-3 text-sm leading-6 text-zinc-300', compact && 'line-clamp-2')}>{version.summary}</p>

                {(version.risk || version.changes?.length) && (
                  <div className="mt-3 flex flex-col gap-2 text-xs text-zinc-500">
                    {version.risk && (
                      <span className={riskTone(version.risk)}>
                        Revision risk: {version.risk}
                      </span>
                    )}
                    {version.changes && version.changes.length > 0 && (
                      <ul className="grid gap-1" aria-label={`Changes in ${version.label}`}>
                        {version.changes.slice(0, compact ? 2 : 4).map((change) => (
                          <li className="leading-5 text-zinc-400" key={change}>
                            {change}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <li key={version.id}>
              {onVersionSelect ? (
                <button
                  aria-current={selected ? 'step' : undefined}
                  aria-label={`Select revision ${version.label}`}
                  className={cx(
                    'w-full border p-4 text-left transition-colors',
                    selected ? 'border-zinc-500 bg-zinc-900/80' : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-700',
                    compact && 'p-3',
                  )}
                  onClick={() => onVersionSelect(version)}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <article className={cx('border border-zinc-900 bg-zinc-950/60 p-4', selected && 'border-zinc-500 bg-zinc-900/80', compact && 'p-3')}>
                  {content}
                </article>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
