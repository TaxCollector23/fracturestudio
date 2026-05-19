import { Link } from 'react-router-dom';

export function ManifestoPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:px-12">
      <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Manifesto</p>
      <h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">Clarity is the sharpest form of conviction.</h1>
      <div className="mt-10 space-y-6 text-base leading-8 text-zinc-400">
        <p>Strong writing does not hide behind tone. It earns confidence by surviving scrutiny.</p>
        <p>
          This studio exists for writers who would rather expose the weakness themselves than let a reader, judge, or
          opponent do it first.
        </p>
        <p>Feedback is only useful when it leads to a next move. Fracture ends every pass with the repairs that matter most.</p>
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        <Link className="rounded-sm bg-white px-6 py-3 font-bold text-black hover:bg-zinc-100" to="/studio/access">
          Enter studio
        </Link>
        <Link className="rounded-sm border border-zinc-700 px-6 py-3 text-zinc-200 hover:border-zinc-500" to="/">
          Home
        </Link>
      </div>
    </article>
  );
}
