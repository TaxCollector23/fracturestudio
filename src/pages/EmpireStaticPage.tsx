import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, CircleDot, FileText, Layers, LineChart, ShieldCheck } from 'lucide-react';
import {
  empirePages,
  getEmpirePage,
  normalizeEmpirePageSlug,
  type EmpireCta,
  type EmpireItem,
  type EmpirePage,
  type EmpireSection,
  type EmpireVisualTone,
} from '../data/empirePages';

type EmpireStaticPageProps = {
  fallbackSlug?: string;
  page?: EmpirePage;
  slug?: string;
};

type ToneStyle = {
  accent: string;
  border: string;
  panel: string;
  soft: string;
  text: string;
};

const toneStyles: Record<EmpireVisualTone, ToneStyle> = {
  zinc: {
    accent: 'bg-zinc-300',
    border: 'border-zinc-800',
    panel: 'bg-zinc-950',
    soft: 'bg-zinc-900/60',
    text: 'text-zinc-300',
  },
  emerald: {
    accent: 'bg-emerald-300',
    border: 'border-emerald-900/70',
    panel: 'bg-emerald-950/20',
    soft: 'bg-emerald-950/30',
    text: 'text-emerald-200',
  },
  sky: {
    accent: 'bg-sky-300',
    border: 'border-sky-900/70',
    panel: 'bg-sky-950/20',
    soft: 'bg-sky-950/30',
    text: 'text-sky-200',
  },
  amber: {
    accent: 'bg-amber-300',
    border: 'border-amber-900/70',
    panel: 'bg-amber-950/20',
    soft: 'bg-amber-950/30',
    text: 'text-amber-200',
  },
  rose: {
    accent: 'bg-rose-300',
    border: 'border-rose-900/70',
    panel: 'bg-rose-950/20',
    soft: 'bg-rose-950/30',
    text: 'text-rose-200',
  },
  indigo: {
    accent: 'bg-indigo-300',
    border: 'border-indigo-900/70',
    panel: 'bg-indigo-950/20',
    soft: 'bg-indigo-950/30',
    text: 'text-indigo-200',
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function pageFromLocation(pathname: string): EmpirePage | undefined {
  const normalizedPath = normalizeEmpirePageSlug(pathname);
  return empirePages.find((page) => normalizedPath === page.slug || normalizedPath.endsWith(`/${page.slug}`));
}

function firstResolvedPage(candidates: Array<string | undefined>, pathname: string): EmpirePage | undefined {
  for (const candidate of candidates) {
    const page = getEmpirePage(candidate);
    if (page) {
      return page;
    }
  }
  return pageFromLocation(pathname);
}

function CtaLink({ cta }: { cta: EmpireCta }) {
  const primary = cta.tone !== 'secondary';
  return (
    <Link
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-sm font-bold transition-colors',
        primary ? 'bg-zinc-100 text-zinc-950 hover:bg-white' : 'border border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:text-white',
      )}
      to={cta.to}
    >
      {cta.label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function HeroVisual({ page }: { page: EmpirePage }) {
  const tone = toneStyles[page.hero.visual.tone];

  return (
    <aside className={cx('rounded-sm border p-6', tone.border, tone.panel)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">{page.category}</p>
          <p className="mt-2 font-serif text-2xl italic text-zinc-100">{page.hero.visual.motif}</p>
        </div>
        <div className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-sm', tone.soft)}>
          <Layers className={cx('h-5 w-5', tone.text)} aria-hidden />
        </div>
      </div>

      <div className="mt-8 border-y border-zinc-900 py-5">
        <p className="text-sm uppercase tracking-[0.28em] text-zinc-600">Artifact</p>
        <p className="mt-2 text-lg font-medium text-zinc-200">{page.hero.visual.artifact}</p>
      </div>

      {page.hero.metrics && (
        <div className="mt-6 grid gap-3">
          {page.hero.metrics.map((metric) => (
            <div className="rounded-sm border border-zinc-900 bg-[#0c0c0e] p-4" key={`${metric.label}-${metric.value}`}>
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-600">{metric.label}</p>
                <p className={cx('font-serif text-2xl italic leading-none', tone.text)}>{metric.value}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{metric.body}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function SectionVisual({ section }: { section: EmpireSection }) {
  const tone = toneStyles[section.visual.tone];

  return (
    <div className="mt-6 border-l border-zinc-800 pl-4">
      <div className={cx('mb-4 h-1 w-16 rounded-sm', tone.accent)} />
      <p className={cx('text-sm font-medium', tone.text)}>{section.visual.motif}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{section.visual.artifact}</p>
    </div>
  );
}

function ItemCard({ item, index }: { item: EmpireItem; index: number }) {
  return (
    <article className="rounded-sm border border-zinc-900 bg-[#0c0c0e] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-zinc-100 text-xs font-bold text-zinc-950">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div>
          {item.meta && <p className="mb-2 text-xs uppercase tracking-[0.28em] text-zinc-600">{item.meta}</p>}
          <h3 className="text-base font-semibold text-zinc-100">{item.title}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-400">{item.body}</p>
        </div>
      </div>
    </article>
  );
}

function MetricGrid({ section }: { section: EmpireSection }) {
  const tone = toneStyles[section.visual.tone];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {section.metrics?.map((metric) => (
        <article className={cx('rounded-sm border p-5', tone.border, tone.panel)} key={`${metric.label}-${metric.value}`}>
          <p className="text-xs uppercase tracking-[0.28em] text-zinc-600">{metric.label}</p>
          <p className={cx('mt-4 font-serif text-4xl italic', tone.text)}>{metric.value}</p>
          <p className="mt-3 text-sm leading-7 text-zinc-400">{metric.body}</p>
        </article>
      ))}
      {section.items?.map((item, index) => (
        <ItemCard item={item} index={index} key={`${item.title}-${index}`} />
      ))}
    </div>
  );
}

function StepList({ items }: { items: EmpireItem[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, index) => (
        <li className="rounded-sm border border-zinc-900 bg-[#0c0c0e] p-5" key={`${item.title}-${index}`}>
          <div className="flex gap-4">
            <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-zinc-100 text-sm font-bold text-zinc-950">
              {index + 1}
            </span>
            <div>
              <h3 className="font-medium text-zinc-100">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-zinc-400">{item.body}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ section }: { section: EmpireSection }) {
  const tone = toneStyles[section.visual.tone];

  return (
    <ol className="space-y-4">
      {section.items?.map((item, index) => (
        <li className="grid gap-4 rounded-sm border border-zinc-900 bg-[#0c0c0e] p-5 sm:grid-cols-[7rem_1fr]" key={`${item.title}-${index}`}>
          <div>
            <p className={cx('font-serif text-3xl italic leading-none', tone.text)}>{item.title}</p>
            {item.meta && <p className="mt-2 text-xs uppercase tracking-[0.28em] text-zinc-600">{item.meta}</p>}
          </div>
          <p className="text-sm leading-7 text-zinc-400">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}

function DocumentList({ section }: { section: EmpireSection }) {
  const tone = toneStyles[section.visual.tone];

  return (
    <div className="rounded-sm border border-zinc-900 bg-[#0c0c0e]">
      {section.items?.map((item, index) => (
        <div className="flex gap-4 border-b border-zinc-900 p-5 last:border-b-0" key={`${item.title}-${index}`}>
          <FileText className={cx('mt-1 h-5 w-5 shrink-0', tone.text)} aria-hidden />
          <div>
            <h3 className="font-medium text-zinc-100">{item.title}</h3>
            <p className="mt-2 text-sm leading-7 text-zinc-400">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitSection({ section }: { section: EmpireSection }) {
  const tone = toneStyles[section.visual.tone];

  return (
    <div className="grid gap-5">
      {section.bullets && (
        <div className="grid gap-3 sm:grid-cols-2">
          {section.bullets.map((bullet) => (
            <div className="flex gap-3 rounded-sm border border-zinc-900 bg-[#0c0c0e] p-4" key={bullet}>
              <CheckCircle2 className={cx('mt-0.5 h-4 w-4 shrink-0', tone.text)} aria-hidden />
              <p className="text-sm leading-6 text-zinc-400">{bullet}</p>
            </div>
          ))}
        </div>
      )}
      {section.items && (
        <div className="grid gap-4 sm:grid-cols-2">
          {section.items.map((item, index) => (
            <ItemCard item={item} index={index} key={`${item.title}-${index}`} />
          ))}
        </div>
      )}
      {section.callout && (
        <div className={cx('rounded-sm border p-5', tone.border, tone.panel)}>
          <CircleDot className={cx('mb-4 h-5 w-5', tone.text)} aria-hidden />
          <p className="text-base leading-7 text-zinc-200">{section.callout}</p>
        </div>
      )}
    </div>
  );
}

function CaseGrid({ section }: { section: EmpireSection }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {section.items?.map((item, index) => (
        <ItemCard item={item} index={index} key={`${item.title}-${index}`} />
      ))}
    </div>
  );
}

function FeatureGrid({ section }: { section: EmpireSection }) {
  const tone = toneStyles[section.visual.tone];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {section.items?.map((item, index) => (
        <article className="rounded-sm border border-zinc-900 bg-[#0c0c0e] p-5" key={`${item.title}-${index}`}>
          <ShieldCheck className={cx('mb-5 h-5 w-5', tone.text)} aria-hidden />
          <h3 className="text-base font-semibold text-zinc-100">{item.title}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-400">{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function SectionBody({ section }: { section: EmpireSection }) {
  if (section.layout === 'metric-grid') {
    return <MetricGrid section={section} />;
  }

  if (section.layout === 'steps') {
    return <StepList items={section.items ?? []} />;
  }

  if (section.layout === 'timeline') {
    return <Timeline section={section} />;
  }

  if (section.layout === 'document') {
    return <DocumentList section={section} />;
  }

  if (section.layout === 'split') {
    return <SplitSection section={section} />;
  }

  if (section.layout === 'case-grid') {
    return <CaseGrid section={section} />;
  }

  return <FeatureGrid section={section} />;
}

function EmpireNotFound({ requestedSlug }: { requestedSlug?: string }) {
  return (
    <main className="px-6 py-16 sm:px-12">
      <section className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Empire page</p>
        <h1 className="mt-4 font-serif text-5xl italic text-zinc-100">Content page not found.</h1>
        {requestedSlug && <p className="mt-5 text-sm leading-7 text-zinc-400">Requested slug: {requestedSlug}</p>}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {empirePages.slice(0, 8).map((page) => (
            <Link className="rounded-sm border border-zinc-900 bg-[#0c0c0e] p-4 text-sm text-zinc-300 hover:border-zinc-700" key={page.slug} to={`/${page.slug}`}>
              {page.navTitle}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

export function EmpireStaticPage({ fallbackSlug, page: providedPage, slug }: EmpireStaticPageProps) {
  const params = useParams<Record<string, string | undefined>>();
  const location = useLocation();
  const candidates = [
    slug,
    params.pageSlug,
    params.slug,
    params['*'],
    params.modelSlug ? `models/${params.modelSlug}` : undefined,
    params.model ? `models/${params.model}` : undefined,
  ];
  const page = providedPage ?? firstResolvedPage(candidates, location.pathname) ?? getEmpirePage(fallbackSlug);
  const requestedSlug = normalizeEmpirePageSlug(slug ?? params.pageSlug ?? params.slug ?? params['*'] ?? location.pathname);

  if (!page) {
    return <EmpireNotFound requestedSlug={requestedSlug} />;
  }

  const relatedPages = page.relatedSlugs.map((relatedSlug) => getEmpirePage(relatedSlug)).filter(Boolean) as EmpirePage[];

  return (
    <article className="px-6 pb-20 pt-16 sm:px-12">
      <section className="mx-auto grid max-w-6xl gap-10 border-b border-zinc-900 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">{page.hero.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl italic leading-tight text-zinc-100 sm:text-7xl">{page.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">{page.hero.lead}</p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-500">{page.hero.proof}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {page.hero.primaryCta && <CtaLink cta={page.hero.primaryCta} />}
            {page.hero.secondaryCta && <CtaLink cta={page.hero.secondaryCta} />}
          </div>
        </div>
        <HeroVisual page={page} />
      </section>

      {page.sections.map((section) => (
        <section className="mx-auto grid max-w-6xl gap-8 border-b border-zinc-900 py-14 lg:grid-cols-[0.8fr_1.2fr]" id={section.id} key={section.id}>
          <div>
            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-zinc-600">
              <LineChart className="h-4 w-4" aria-hidden />
              {section.eyebrow}
            </div>
            <h2 className="mt-4 font-serif text-4xl italic leading-tight text-zinc-100">{section.title}</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">{section.body}</p>
            <SectionVisual section={section} />
          </div>
          <SectionBody section={section} />
        </section>
      ))}

      {relatedPages.length > 0 && (
        <section className="mx-auto max-w-6xl pt-14">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Next pages</p>
              <h2 className="mt-3 font-serif text-4xl italic text-zinc-100">Keep the argument moving.</h2>
            </div>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-white" to="/studio/access">
              Open studio
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {relatedPages.map((relatedPage) => (
              <Link className="rounded-sm border border-zinc-900 bg-[#0c0c0e] p-5 transition-colors hover:border-zinc-700" key={relatedPage.slug} to={`/${relatedPage.slug}`}>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-600">{relatedPage.category}</p>
                <h3 className="mt-3 font-serif text-2xl italic text-zinc-100">{relatedPage.navTitle}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{relatedPage.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
