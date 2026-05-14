import { Link } from 'react-router-dom';

export function PricingPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:px-12">
      <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Pricing</p>
      <h1 className="mt-4 font-serif text-5xl italic">Use the stack you already pay for.</h1>
      <p className="mt-8 text-base leading-8 text-zinc-400">
        Fracture Studio is a front-end plus serverless chat route. You bring your own OpenRouter account and pay usage to
        your model provider—this repo does not add a separate paid tier or billing layer.
      </p>
      <ul className="mt-8 list-disc space-y-3 pl-5 text-zinc-400">
        <li>Self-host on Netlify, Vercel, or Cloudflare Pages (see README).</li>
        <li>GitHub Pages works for static UI if you point <code className="text-zinc-200">VITE_CHAT_API_BASE</code> at an API deployment.</li>
        <li>No invented subscriptions—only your hosting + OpenRouter usage.</li>
      </ul>
      <Link className="mt-10 inline-block rounded-sm bg-white px-6 py-3 font-bold text-black hover:bg-zinc-100" to="/docs">
        Read setup docs
      </Link>
    </article>
  );
}
