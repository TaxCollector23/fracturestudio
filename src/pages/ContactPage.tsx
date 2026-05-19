import { type FormEvent, useState } from 'react';
export function ContactPage() {
  const [sent,setSent]=useState(false);
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setSent(true); }
  return <main className="px-6 py-14 sm:px-10"><section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Contact</p><h1 className="mt-4 font-serif text-5xl italic sm:text-6xl">Tell Fracture what broke.</h1><p className="mt-5 text-sm leading-7 text-zinc-400">Email rvb@balajin.net or davidgoldb007@gmail.com.</p></div><form className="border border-zinc-900 bg-[#0c0c0e] p-5" onSubmit={submit}><input className="w-full border border-zinc-800 bg-zinc-950 p-3" placeholder="Email" /><textarea className="mt-4 min-h-40 w-full border border-zinc-800 bg-zinc-950 p-3" placeholder="Message" /><button className="mt-4 rounded-sm bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-950">Send locally</button>{sent&&<p className="mt-4 text-sm text-emerald-300">Saved locally.</p>}</form></section></main>;
}
