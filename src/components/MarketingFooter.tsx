import { Link } from 'react-router-dom';

const linkClass = 'text-zinc-500 transition-colors hover:text-zinc-300';

export function MarketingFooter() {
  return (
    <footer className="border-t border-zinc-900 bg-zinc-950/90 px-6 py-12 text-sm text-zinc-500 sm:px-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-serif text-lg italic text-zinc-300">Fracture Studio</p>
          <p className="mt-2 max-w-sm leading-7">Argument intelligence for writers and debaters who want pressure before an audience applies it.</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Link className={linkClass} to="/docs">
            Docs
          </Link>
          <Link className={linkClass} to="/features">
            Features
          </Link>
          <Link className={linkClass} to="/pricing">
            Pricing
          </Link>
          <Link className={linkClass} to="/changelog">
            Changelog
          </Link>
          <Link className={linkClass} to="/privacy">
            Privacy
          </Link>
          <Link className={linkClass} to="/studio/access">
            Studio
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-xs text-zinc-600">© {new Date().getFullYear()} Fracture Studio. All rights reserved.</p>
    </footer>
  );
}
