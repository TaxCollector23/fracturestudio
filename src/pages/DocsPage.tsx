import { Link } from 'react-router-dom';

export function DocsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:px-12">
      <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Docs</p>
      <h1 className="mt-4 font-serif text-5xl italic">Get running fast.</h1>
      <ol className="mt-10 list-decimal space-y-4 pl-5 text-base leading-8 text-zinc-400">
        <li>
          Install: <code className="text-zinc-200">npm install</code>
        </li>
        <li>
          Create <code className="text-zinc-200">.env.local</code> with <code className="text-zinc-200">OPENROUTER_API_KEY=…</code>
        </li>
        <li>
          Run: <code className="text-zinc-200">npm run dev</code> and open the printed localhost URL.
        </li>
        <li>
          Before deploy: <code className="text-zinc-200">npm run check</code> and <code className="text-zinc-200">npm run test</code>
        </li>
        <li>
          Set the same <code className="text-zinc-200">OPENROUTER_API_KEY</code> in your host&apos;s environment (not only in the build).
        </li>
      </ol>
      <p className="mt-8 text-sm text-zinc-500">
        Full deploy matrix, API contract, and troubleshooting live in the repository README.
      </p>
      <Link className="mt-8 inline-block text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/">
        ← Home
      </Link>
    </article>
  );
}
