import { Link } from 'react-router-dom';

const userFlow = [
  'Paste a draft or start from a template.',
  'Run Fracture for score, claim map, assumptions, heatmap, and missions.',
  'Add sources or research queries in Citations and bind each source to a claim.',
  'Paste opponent material in Rebuttals and drill crossfire questions.',
  'Export the revision packet when the case is ready.',
];

const developerFlow = [
  'Install dependencies with npm install.',
  'Run npm run dev for local Vite plus same-origin /api/chat middleware.',
  'Set OPENROUTER_API_KEY on hosts that should use remote model enhancement.',
  'Use VITE_CHAT_API_BASE only when static UI and API live on different origins.',
  'Run npm run check, npm run test, and npm run lint before shipping.',
];

function Steps({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border border-zinc-900 bg-[#0c0c0e] p-6">
      <h2 className="font-serif text-3xl italic text-zinc-100">{title}</h2>
      <ol className="mt-6 space-y-4">
        {items.map((item, index) => (
          <li className="flex gap-3 text-sm leading-7 text-zinc-400" key={item}>
            <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center bg-zinc-100 text-xs font-bold text-black">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DocsPage() {
  return (
    <main className="px-6 py-16 sm:px-12">
      <section className="mx-auto max-w-6xl border-b border-zinc-900 pb-12">
        <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">Docs</p>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl italic leading-tight sm:text-7xl">Use the studio, then ship it.</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">
          Product workflow and deployment checks live together so the app stays useful to writers and predictable for hosts.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 py-12 lg:grid-cols-2">
        <Steps items={userFlow} title="Writer workflow" />
        <Steps items={developerFlow} title="Developer workflow" />
      </section>

      <section className="mx-auto max-w-6xl border-t border-zinc-900 pt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-7 text-zinc-400">
            Full environment variables, deployment adapters, and troubleshooting details are in the repository README.
          </p>
          <Link className="bg-white px-6 py-3 text-center font-bold text-black hover:bg-zinc-100" to="/studio/case">
            Open workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
