import { Outlet } from 'react-router-dom';
import { MarketingFooter } from '../components/MarketingFooter';
import { SiteNav } from '../components/SiteNav';

export function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <a
        className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:m-0 focus:inline-block focus:h-auto focus:w-auto focus:overflow-visible focus:whitespace-normal focus:rounded-sm focus:bg-white focus:px-3 focus:py-2 focus:text-black"
        href="#main"
      >
        Skip to content
      </a>
      <SiteNav />
      <div className="flex-1" id="main">
        <Outlet />
      </div>
      <MarketingFooter />
    </div>
  );
}
