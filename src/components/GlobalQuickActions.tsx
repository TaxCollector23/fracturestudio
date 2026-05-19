import { useEffect, useState } from 'react';
import { Home, Moon, Sun, TerminalSquare } from 'lucide-react';

type ThemeMode = 'dark' | 'light';
const themeKey = 'fracture-theme';

function readInitialTheme(): ThemeMode {
  return typeof window !== 'undefined' && window.localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark';
}

export function GlobalQuickActions() {
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.classList.toggle('fracture-light', theme === 'light');
    window.localStorage.setItem(themeKey, theme);
  }, [theme]);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <div className="fixed bottom-4 right-4 z-[120] flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/90 p-2 shadow-2xl backdrop-blur-md fracture-quick-actions">
      <a aria-label="Go home" className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-100 hover:text-zinc-950" href="/" title="Home"><Home className="h-4 w-4" /></a>
      <a aria-label="Open studio" className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-zinc-100 text-zinc-950 hover:bg-white" href="/studio/dashboard" title="Studio"><TerminalSquare className="h-4 w-4" /></a>
      <button aria-label={`Switch to ${nextTheme} mode`} className="grid h-10 w-10 place-items-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-100 hover:text-zinc-950" onClick={() => setTheme(nextTheme)} title={`${nextTheme} mode`} type="button">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </div>
  );
}
