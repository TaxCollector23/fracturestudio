import { Link } from 'react-router-dom';
export function NotFoundPage() {
  return <main className="px-6 py-20 sm:px-10"><section className="mx-auto max-w-5xl"><p className="text-xs uppercase tracking-[0.45em] text-zinc-500">404</p><h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">This argument path does not exist yet.</h1><div className="mt-8 flex flex-wrap gap-3"><Link className="rounded-sm bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-950" to="/studio/case">Open Studio</Link><Link className="rounded-sm border border-zinc-700 px-5 py-3 text-sm text-zinc-200" to="/all-pages">All Pages</Link></div></section></main>;
}
