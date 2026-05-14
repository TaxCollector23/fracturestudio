import { Link } from 'react-router-dom';

export function ChangelogPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:px-12">
      <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Changelog</p>
      <h1 className="mt-4 font-serif text-5xl italic">Product log</h1>
      <ul className="mt-10 space-y-8 border-l border-zinc-800 pl-8 text-zinc-400">
        <li>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Current</p>
          <p className="mt-2 font-medium text-zinc-200">Phases B–D baseline</p>
          <p className="mt-2 text-sm leading-7">
            Server-enforced critique with validation caps and structured error codes; citations and rebuttals actions; React
            Router shell with marketing pages; Vitest coverage for the chat engine; merge guide for future redesign import.
          </p>
        </li>
      </ul>
      <Link className="mt-12 inline-block text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/">
        ← Home
      </Link>
    </article>
  );
}
