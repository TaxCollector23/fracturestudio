import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:px-12">
      <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Privacy</p>
      <h1 className="mt-4 font-serif text-5xl italic">What leaves your machine.</h1>
      <div className="mt-10 space-y-6 text-base leading-8 text-zinc-400">
        <p>
          Draft text is sent to your deployed <code className="text-zinc-200">/api/chat</code> endpoint, which forwards it to
          OpenRouter using a server-side API key. Fracture Studio does not implement its own user accounts or analytics in
          this repository.
        </p>
        <p>
          Your hosting provider (Netlify, Vercel, Cloudflare, GitHub, etc.) may log requests according to its own policy.
          Review their documentation for retention and regions.
        </p>
        <p>
          Do not paste secrets, credentials, or highly sensitive personal data into the workspace; treat it like any
          third-party LLM surface.
        </p>
      </div>
      <Link className="mt-10 inline-block text-zinc-300 underline-offset-4 hover:text-white hover:underline" to="/">
        ← Home
      </Link>
    </article>
  );
}
