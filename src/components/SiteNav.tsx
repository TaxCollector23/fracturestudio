import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const links = [
  ['Home', '/'],
  ['Studio', '/studio/dashboard'],
  ['Analyze', '/analyze'],
  ['Citations', '/citations'],
  ['Models', '/models'],
  ['All Pages', '/all-pages'],
];

function cls({ isActive }: { isActive: boolean }) {
  return `rounded-sm px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'}`;
}

export function SiteNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link className="flex items-center gap-3" to="/"><span className="grid h-10 w-10 place-items-center rounded-sm border border-zinc-800 bg-zinc-100 text-sm font-black text-zinc-950">FS</span><span><span className="block text-sm font-semibold text-zinc-100">Fracture Studio</span><span className="block text-[11px] uppercase tracking-[0.28em] text-zinc-500">Argument OS</span></span></Link>
        <nav className="hidden items-center gap-1 lg:flex">{links.map(([label, to]) => <NavLink className={cls} key={to} to={to}>{label}</NavLink>)}</nav>
        <div className="hidden items-center gap-2 lg:flex"><Link className="rounded-sm bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950" to="/studio/case">Open Studio</Link></div>
        <button aria-label="Toggle navigation" className="grid h-10 w-10 place-items-center rounded-sm border border-zinc-800 text-zinc-200 lg:hidden" onClick={() => setOpen((v) => !v)} type="button">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {open && <nav className="grid gap-2 border-t border-zinc-900 px-5 py-4 lg:hidden">{links.map(([label, to]) => <NavLink className={cls} key={to} onClick={() => setOpen(false)} to={to}>{label}</NavLink>)}</nav>}
    </header>
  );
}

