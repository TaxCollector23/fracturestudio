import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <nav className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-zinc-900 bg-zinc-950/85 px-6 backdrop-blur-md sm:px-12">
      <Link className="flex items-center gap-3 text-left" to="/" aria-label="Fracture Studio home">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-100 font-serif text-xl font-bold italic text-zinc-950">
          f
        </div>
        <span className="font-serif text-xl italic tracking-wide text-zinc-50">Fracture Studio</span>
      </Link>

      <div className="hidden items-center gap-8 text-sm font-medium text-zinc-400 md:flex">
        <Link className="transition-colors hover:text-zinc-50" to="/methodology">
          Methodology
        </Link>
        <Link className="transition-colors hover:text-zinc-50" to="/manifesto">
          Manifesto
        </Link>
        <Link className="transition-colors hover:text-zinc-50" to="/docs">
          Docs
        </Link>
        <Link className="transition-colors hover:text-zinc-50" to="/pricing">
          Pricing
        </Link>
        <Link
          className="rounded-sm bg-zinc-100 px-5 py-2 font-bold text-zinc-950 transition-colors hover:bg-white"
          to="/studio/access"
        >
          Enter Studio
        </Link>
      </div>

      <div className="flex items-center gap-3 md:hidden">
        <Link
          className="rounded-sm bg-zinc-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-950"
          to="/studio/access"
        >
          Enter Studio
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="rounded-sm border border-zinc-800 p-2 text-zinc-200"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            aria-modal="true"
            className="fixed inset-0 z-[100] bg-zinc-950/95 px-6 pb-10 pt-24 md:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="dialog"
          >
            <div className="flex flex-col gap-4 text-lg font-medium text-zinc-100">
              <Link className="rounded-sm border border-zinc-800 py-3 text-left" to="/methodology">
                Methodology
              </Link>
              <Link className="rounded-sm border border-zinc-800 py-3 text-left" to="/manifesto">
                Manifesto
              </Link>
              <Link className="rounded-sm border border-zinc-800 py-3 text-left" to="/docs">
                Docs
              </Link>
              <Link className="rounded-sm border border-zinc-800 py-3 text-left" to="/pricing">
                Pricing
              </Link>
              <Link className="rounded-sm bg-white py-3 text-center font-bold text-black" to="/studio/access">
                Enter Studio
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
