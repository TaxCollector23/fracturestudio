export function ChangelogPage() {
  const changes = ['Run-gated Studio feedback', 'Fracture Chat and speed mode', 'Citation and rebuttal engines', 'Global Home, Studio, and theme controls', 'Nonsense detection and low scores for non-arguments'];
  return <main className="px-6 py-14 sm:px-10"><section className="mx-auto max-w-5xl"><p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Changelog</p><h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">What changed.</h1><ul className="mt-8 grid gap-3">{changes.map((c)=><li className="border border-zinc-900 bg-[#0c0c0e] p-4 text-sm text-zinc-300" key={c}>{c}</li>)}</ul></section></main>;
}
