import { type FormEvent, useState } from 'react';
export function FeedbackPage() {
  const [sent,setSent]=useState(false);
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setSent(true); }
  return <main className="px-6 py-14 sm:px-10"><section className="mx-auto max-w-6xl"><p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Feedback</p><h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">Improve the engine.</h1><form className="mt-8 border border-zinc-900 bg-[#0c0c0e] p-5" onSubmit={submit}><textarea className="min-h-48 w-full border border-zinc-800 bg-zinc-950 p-3" placeholder="Paste text Fracture analyzed." /><textarea className="mt-4 min-h-48 w-full border border-zinc-800 bg-zinc-950 p-3" placeholder="What did it get wrong?" /><button className="mt-4 rounded-sm bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-950">Submit feedback</button>{sent&&<p className="mt-4 text-sm text-emerald-300">Feedback stored locally.</p>}</form></section></main>;
}
