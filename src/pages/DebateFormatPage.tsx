import { Link } from 'react-router-dom';
type Props = { format: 'aristotle' | 'policy' | 'public-forum' | 'lincoln-douglas' | 'world-schools' | 'british-parliamentary' };
const names: Record<Props['format'], string> = { aristotle: 'Aristotle rhetoric', policy: 'Policy Debate', 'public-forum': 'Public Forum', 'lincoln-douglas': 'Lincoln-Douglas', 'world-schools': 'World Schools', 'british-parliamentary': 'British Parliamentary' };
export function DebateFormatPage({ format }: Props) {
  const checks = ['Claim structure','Evidence quality','Warrant strength','Impact weighing','Rebuttal readiness'];
  return <main className="px-6 py-14 sm:px-10"><section className="mx-auto max-w-6xl"><p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Debate format</p><h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">{names[format]}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400">A format-specific pressure lens for Fracture Studio.</p><div className="mt-8 grid gap-3">{checks.map((c)=><div className="border border-zinc-900 bg-[#0c0c0e] p-4" key={c}>{c}</div>)}</div><Link className="mt-7 inline-block rounded-sm bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-950" to="/studio/case">Test a case</Link></section></main>;
}
