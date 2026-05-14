import { Link } from 'react-router-dom';

const flow = [
  'Thesis precision',
  'Claim and evidence map',
  'Warrant and assumption audit',
  'Burden of proof check',
  'Opposition steelman',
  'Crossfire rehearsal',
  'Speech sequence',
  'Collapse point',
  'Source-to-claim verification',
  'Revision missions',
];

const models = [
  ['Toulmin', 'Claim, grounds, warrant, backing, qualifier, rebuttal.'],
  ['Rogerian', 'Fairly state the opposing value before disagreement.'],
  ['Stock Issues', 'Harm, inherency, significance, solvency, topicality.'],
  ['Pragma-Dialectics', 'Burden, relevance, rule violations, and closure.'],
  ['Syllogism', 'Major premise, minor premise, conclusion.'],
  ['Enthymeme', 'The missing premise the audience is expected to supply.'],
  ["Monroe's Motivated Sequence", 'Attention, need, satisfaction, visualization, action.'],
  ['Dependency Model', 'Which claims depend on which earlier claims.'],
  ['Casuistry', 'Case comparison, precedent, and distinguishing facts.'],
  ['Evolutionary Conceptual Change', 'Move readers from an old model to a better one.'],
];

export function MethodologyPage() {
  return (
    <article className="px-6 py-16 sm:px-12">
      <div className="mx-auto max-w-6xl border-b border-zinc-900 pb-12">
        <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Methodology</p>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl italic leading-tight sm:text-7xl">The Fracture writing model.</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">
          The flagship pass combines debate theory, rhetoric, logic, citation grounding, and revision discipline into one
          usable flow.
        </p>
      </div>

      <section className="mx-auto grid max-w-6xl gap-8 py-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-serif text-4xl italic text-zinc-100">Three-page Fracture flow</h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Page one maps the argument. Page two attacks the weak links. Page three turns the report into a short revision
            mission list.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {flow.map((step, index) => (
            <div className="border border-zinc-900 bg-[#0c0c0e] p-4" key={step}>
              <span className="text-xs text-zinc-500">{String(index + 1).padStart(2, '0')}</span>
              <p className="mt-2 text-sm font-medium text-zinc-200">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl border-t border-zinc-900 py-12">
        <h2 className="font-serif text-4xl italic text-zinc-100">Ten models inside the pass</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {models.map(([name, copy]) => (
            <div className="border border-zinc-900 bg-[#0c0c0e] p-5" key={name}>
              <h3 className="font-medium text-zinc-100">{name}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto flex max-w-6xl flex-wrap gap-4 border-t border-zinc-900 pt-10">
        <Link className="bg-white px-6 py-3 font-bold text-black hover:bg-zinc-100" to="/studio/access">
          Open studio
        </Link>
        <Link className="border border-zinc-700 px-6 py-3 text-zinc-200 hover:border-zinc-500" to="/features">
          Feature map
        </Link>
      </div>
    </article>
  );
}
