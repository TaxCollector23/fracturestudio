import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleDashed, Compass } from 'lucide-react';
import { siteDirectoryGroups, siteDirectoryStats, type SiteDirectoryPage } from '../data/siteDirectory';

function StatusBadge({ status }: { status: SiteDirectoryPage['status'] }) {
  const live = status === 'live';

  return (
    <span
      className={`inline-flex items-center gap-2 border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
        live ? 'border-emerald-900/70 bg-emerald-950/30 text-emerald-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500'
      }`}
    >
      {live ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {live ? 'Live' : 'Planned'}
    </span>
  );
}

function PageCard({ page }: { page: SiteDirectoryPage }) {
  const content = (
    <>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-zinc-500">{page.path}</p>
            <h3 className="mt-3 font-serif text-3xl italic text-zinc-100">{page.title}</h3>
          </div>
          <StatusBadge status={page.status} />
        </div>
        <p className="mt-4 text-sm leading-7 text-zinc-400">{page.summary}</p>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {page.surfaces.map((surface) => (
            <span className="border border-zinc-900 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-500" key={surface}>
              {surface}
            </span>
          ))}
        </div>
        {page.status === 'live' && (
          <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors group-hover:text-zinc-200">
            Open page <ArrowRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </>
  );

  if (page.status === 'live') {
    return (
      <Link className="group flex min-h-[260px] flex-col justify-between border border-zinc-900 bg-[#0c0c0e] p-5 transition-colors hover:border-zinc-700" to={page.path}>
        {content}
      </Link>
    );
  }

  return <article className="flex min-h-[260px] flex-col justify-between border border-zinc-900 bg-zinc-950/60 p-5">{content}</article>;
}

export function AllPagesPage() {
  return (
    <main className="px-6 py-16 sm:px-12">
      <section className="mx-auto max-w-6xl border-b border-zinc-900 pb-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">All Pages</p>
            <h1 className="mt-4 max-w-4xl font-serif text-5xl italic leading-tight sm:text-7xl">Fracture site directory.</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">
              A complete information architecture map for routed pages and planned expansion across the studio, method,
              debate, research, docs, and company surfaces.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[360px]">
            <div className="border border-zinc-900 bg-[#0c0c0e] p-4">
              <p className="text-3xl font-semibold text-zinc-100">{siteDirectoryStats.total}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">Pages</p>
            </div>
            <div className="border border-zinc-900 bg-[#0c0c0e] p-4">
              <p className="text-3xl font-semibold text-emerald-200">{siteDirectoryStats.live}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">Live</p>
            </div>
            <div className="border border-zinc-900 bg-[#0c0c0e] p-4">
              <p className="text-3xl font-semibold text-zinc-300">{siteDirectoryStats.planned}</p>
              <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">Planned</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl divide-y divide-zinc-900">
        {siteDirectoryGroups.map((group) => (
          <section className="grid gap-7 py-12 lg:grid-cols-[0.34fr_1fr]" key={group.id} aria-label={`${group.label} pages`}>
            <div>
              <Compass className="h-5 w-5 text-zinc-500" />
              <h2 className="mt-4 font-serif text-4xl italic text-zinc-100">{group.label}</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">{group.deck}</p>
              <p className="mt-5 font-mono text-xs uppercase tracking-wider text-zinc-600">
                {group.pages.length} pages
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {group.pages.map((page) => (
                <PageCard key={page.id} page={page} />
              ))}
            </div>
          </section>
        ))}
      </section>
    </main>
  );
}
