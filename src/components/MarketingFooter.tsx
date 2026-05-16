import { Link } from 'react-router-dom';

export function MarketingFooter() {
  const links = [['Studio', '/studio/case'], ['All Pages', '/all-pages'], ['Contact', '/contact'], ['Privacy', '/privacy'], ['Changelog', '/changelog']];
  return (
    <footer className="border-t border-zinc-900 bg-[#08080a] px-6 py-10 text-zinc-400 sm:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-7">Fracture Studio finds where an argument breaks before someone else does.</p>
        <div className="flex flex-wrap gap-4">{links.map(([label, to]) => <Link className="text-sm hover:text-zinc-100" key={to} to={to}>{label}</Link>)}</div>
      </div>
    </footer>
  );
}
