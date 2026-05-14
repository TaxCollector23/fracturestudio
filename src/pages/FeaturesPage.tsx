import { Link } from 'react-router-dom';
import { Activity, BookOpen, ClipboardCheck, Network, ShieldCheck, Swords } from 'lucide-react';

const featureGroups = [
  {
    title: 'Argument anatomy',
    icon: Network,
    items: ['Argument graph', 'Claim detector', 'Warrant analyzer', 'Hidden assumption detector', 'Argument collapse point'],
  },
  {
    title: 'Evidence pressure',
    icon: BookOpen,
    items: ['Citation-needed tags', 'Source-to-claim verifier', 'Evidence freshness warnings', 'Citation hallucination check', 'Evidence upgrade missions'],
  },
  {
    title: 'Debate rehearsal',
    icon: Swords,
    items: ['Opponent simulation', 'Rebuttal cards', 'Crossfire questions', 'Judge question prediction', 'Impact chain builder'],
  },
  {
    title: 'Revision control',
    icon: ClipboardCheck,
    items: ['Weak paragraph ranking', 'Logic heatmap', 'Reader confusion predictor', 'Rubric alignment', 'Final verdict card'],
  },
];

const models = [
  'Toulmin',
  'Rogerian',
  'Stock Issues',
  'Pragma-Dialectics',
  'Syllogism',
  'Enthymeme',
  "Monroe's Motivated Sequence",
  'Dependency Model',
  'Casuistry',
  'Evolutionary Conceptual Change',
];

export function FeaturesPage() {
  return (
    <main className="px-6 py-16 sm:px-12">
      <section className="mx-auto max-w-6xl border-b border-zinc-900 pb-14">
        <p className="text-xs uppercase tracking-[0.42em] text-zinc-500">Feature Map</p>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl italic leading-tight sm:text-7xl">Every tool has to earn its place.</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">
          Fracture Studio now combines live structure analysis, research support, rebuttal rehearsal, rubric checks, and
          exportable revision packets in one workspace.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 py-14 md:grid-cols-2">
        {featureGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article className="border border-zinc-900 bg-[#0c0c0e] p-6" key={group.title}>
              <Icon className="h-5 w-5 text-zinc-300" />
              <h2 className="mt-5 font-serif text-3xl italic text-zinc-100">{group.title}</h2>
              <ul className="mt-5 grid gap-3 text-sm leading-6 text-zinc-400">
                {group.items.map((item) => (
                  <li className="flex gap-3" key={item}>
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl border-t border-zinc-900 py-14">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.42em] text-zinc-500">Writing Model</p>
            <h2 className="mt-4 font-serif text-4xl italic text-zinc-100">Ten lenses, one revision flow.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {models.map((model) => (
              <div className="border border-zinc-900 bg-zinc-950/70 p-4 text-sm text-zinc-300" key={model}>
                {model}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-zinc-900 py-14 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Activity className="mb-4 h-5 w-5 text-zinc-300" />
          <p className="max-w-2xl text-base leading-8 text-zinc-400">
            The local engine gives a complete report even when the remote model is unavailable; the server can enhance it
            with OpenRouter when configured.
          </p>
        </div>
        <Link className="bg-zinc-100 px-6 py-3 text-center font-bold text-zinc-950 hover:bg-white" to="/studio/case">
          Open workspace
        </Link>
      </section>
    </main>
  );
}
