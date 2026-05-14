import { Link } from 'react-router-dom';

export function MethodologyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:px-12">
      <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Methodology</p>
      <h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">Find the failure point before it finds you.</h1>
      <div className="mt-10 space-y-6 text-base leading-8 text-zinc-400">
        <p>
          Fracture Studio isolates unsupported conclusions, overreaches, and soft assumptions that make an argument easy to
          attack. The critique pass is intentionally adversarial: it quotes your language, audits assumptions, steelmans the
          opposition, and proposes line-level fixes—not generic encouragement.
        </p>
        <p>
          Citations mode formats a working bibliography and in-text patterns from the sources you supply, flagging missing
          metadata instead of inventing publishers or dates. Rebuttals mode maps opponent claims to counter-responses and
          “if they say X, you say Y” cards so you can rehearse exchanges under pressure.
        </p>
        <p>
          The goal is not more words. The goal is a cleaner chain of reasoning, with each sentence doing deliberate work.
        </p>
      </div>
      <div className="mt-12 flex flex-wrap gap-4">
        <Link className="rounded-sm bg-white px-6 py-3 font-bold text-black hover:bg-zinc-100" to="/studio/access">
          Open studio
        </Link>
        <Link className="rounded-sm border border-zinc-700 px-6 py-3 text-zinc-200 hover:border-zinc-500" to="/">
          Home
        </Link>
      </div>
    </article>
  );
}
