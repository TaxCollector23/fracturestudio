import { AlertCircle, BookOpen, CheckCircle2, ExternalLink, Link2, ShieldCheck } from 'lucide-react';

export type SourceCredibilityStatus = 'verified' | 'review' | 'missing-data' | 'stale' | 'weak-fit';

export type SourceCredibilitySource = {
  id: string;
  title: string;
  authors?: string[];
  year?: string;
  publisher?: string;
  url?: string;
  doi?: string;
  status?: SourceCredibilityStatus;
  credibilityNote?: string;
  score?: number;
  claimFit?: number;
  freshness?: number;
  relevance?: number;
  missingFields?: string[];
  linkedClaims?: string[];
};

export type SourceCredibilityPanelProps = {
  sources: SourceCredibilitySource[];
  activeSourceId?: string;
  heading?: string;
  ariaLabel?: string;
  className?: string;
  onSourceSelect?: (source: SourceCredibilitySource) => void;
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

function statusTone(status: SourceCredibilityStatus | undefined): string {
  if (status === 'verified') {
    return 'border-emerald-900/70 bg-emerald-950/25 text-emerald-200';
  }
  if (status === 'stale' || status === 'weak-fit') {
    return 'border-amber-900/70 bg-amber-950/25 text-amber-200';
  }
  if (status === 'missing-data') {
    return 'border-rose-900/70 bg-rose-950/25 text-rose-200';
  }
  return 'border-zinc-800 bg-zinc-950 text-zinc-400';
}

function statusIcon(status: SourceCredibilityStatus | undefined) {
  if (status === 'verified') {
    return CheckCircle2;
  }
  if (status === 'missing-data' || status === 'stale' || status === 'weak-fit') {
    return AlertCircle;
  }
  return ShieldCheck;
}

function formatAuthors(authors: string[] | undefined): string | undefined {
  if (!authors?.length) {
    return undefined;
  }
  if (authors.length <= 2) {
    return authors.join(', ');
  }
  return `${authors.slice(0, 2).join(', ')} et al.`;
}

function sourceLocator(source: SourceCredibilitySource): string | undefined {
  if (source.doi) {
    return `doi:${source.doi}`;
  }
  if (!source.url) {
    return undefined;
  }
  try {
    return new URL(source.url).hostname.replace(/^www\./, '');
  } catch {
    return source.url;
  }
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const score = clampScore(value) ?? 0;
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

export function SourceCredibilityPanel({
  sources,
  activeSourceId,
  heading = 'Source credibility',
  ariaLabel = 'Source credibility panel',
  className = '',
  onSourceSelect,
}: SourceCredibilityPanelProps) {
  return (
    <section aria-label={ariaLabel} className={cx('border border-zinc-800 bg-[#0c0c0e] p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">{heading}</p>
          <p className="mt-2 text-sm text-zinc-400">
            {sources.length} {sources.length === 1 ? 'source' : 'sources'} ready for claim review
          </p>
        </div>
        <BookOpen className="h-5 w-5 text-zinc-400" aria-hidden="true" />
      </div>

      {sources.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-zinc-400">No sources are available for credibility review.</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {sources.map((source) => {
            const score = clampScore(source.score);
            const selected = source.id === activeSourceId;
            const StatusIcon = statusIcon(source.status);
            const authorLine = formatAuthors(source.authors);
            const locator = sourceLocator(source);
            const metadata = [authorLine, source.publisher, source.year, locator].filter(Boolean);
            const metricRows = [
              ['Claim fit', source.claimFit],
              ['Freshness', source.freshness],
              ['Relevance', source.relevance],
            ].filter((item): item is [string, number] => typeof item[1] === 'number');

            const content = (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx('inline-flex items-center gap-1 border px-2 py-1 text-[10px] uppercase tracking-wider', statusTone(source.status))}>
                        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {source.status ?? 'review'}
                      </span>
                      {score !== undefined && <span className={cx('text-sm font-semibold', scoreTone(score))}>{score}</span>}
                    </div>
                    <h3 className="mt-3 text-sm font-medium text-zinc-100">{source.title}</h3>
                    {metadata.length > 0 && <p className="mt-2 text-xs leading-5 text-zinc-500">{metadata.join(' · ')}</p>}
                  </div>

                  {(source.url || source.doi) && !onSourceSelect && (
                    <a
                      aria-label={`Open source ${source.title}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-800 text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                      href={source.url || `https://doi.org/${source.doi}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                  {(source.url || source.doi) && onSourceSelect && (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-800 text-zinc-500" aria-hidden="true">
                      <ExternalLink className="h-4 w-4" />
                    </span>
                  )}
                </div>

                {source.credibilityNote && <p className="mt-3 text-sm leading-6 text-zinc-300">{source.credibilityNote}</p>}

                {metricRows.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {metricRows.map(([label, value]) => (
                      <MetricBar key={label} label={label} value={value} />
                    ))}
                  </div>
                )}

                {(source.missingFields?.length || source.linkedClaims?.length) && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {source.missingFields && source.missingFields.length > 0 && (
                      <div className="border border-rose-950/70 bg-rose-950/10 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-rose-300">Missing metadata</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{source.missingFields.join(', ')}</p>
                      </div>
                    )}
                    {source.linkedClaims && source.linkedClaims.length > 0 && (
                      <div className="border border-zinc-900 bg-[#09090b] p-3">
                        <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
                          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Linked claims
                        </p>
                        <ul className="mt-2 grid gap-1 text-sm leading-6 text-zinc-300">
                          {source.linkedClaims.slice(0, 3).map((claim) => (
                            <li key={claim}>{claim}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </>
            );

            return onSourceSelect ? (
              <button
                aria-pressed={selected}
                aria-label={`Review source ${source.title}`}
                className={cx(
                  'w-full border p-4 text-left transition-colors',
                  selected ? 'border-zinc-500 bg-zinc-900/80' : 'border-zinc-900 bg-zinc-950/60 hover:border-zinc-700',
                )}
                key={source.id}
                onClick={() => onSourceSelect(source)}
                type="button"
              >
                {content}
              </button>
            ) : (
              <article className={cx('border border-zinc-900 bg-zinc-950/60 p-4', selected && 'border-zinc-500 bg-zinc-900/80')} key={source.id}>
                {content}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
