import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sun, Moon, ArrowRight } from "lucide-react";
import { useTheme } from "../lib/useTheme.js";
import { useAuth } from "../lib/useAuth.jsx";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/studio", label: "Studio" },
  { to: "/rebuttals", label: "Rebuttals" },
  { to: "/past-work", label: "Past Work" },
  { to: "/about", label: "Methods" },
  { to: "/blog", label: "Blog" }
];

export default function Nav() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 px-5 md:px-10 flex items-center justify-between
                    border-b border-zinc-200 bg-white/80 dark:border-zinc-900 dark:bg-zinc-950/80 backdrop-blur-xl">
      <Link to="/" className="flex items-center gap-3">
        <img src="/favicon.svg" alt="Fracture Studio" className="w-8 h-8 rounded-[6px]" />
        <div className="leading-none">
          <div className="font-serif text-lg tracking-wide">Fracture Studio</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">Argument Engine</div>
        </div>
      </Link>

      <div className="hidden md:flex items-center gap-1">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}
            className={({ isActive }) =>
              `px-3.5 py-2 rounded-sm text-sm transition-colors ${
                isActive ? "text-zinc-950 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}>
            {l.label}
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={toggle} aria-label="Toggle theme"
          className="w-9 h-9 rounded-sm border border-zinc-300 dark:border-zinc-800 flex items-center justify-center
                     text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {user ? (
          <button onClick={() => navigate("/settings")} className="btn-ghost py-2 px-4">
            {(user.name || "Account").split(" ")[0]}
          </button>
        ) : (
          <button onClick={() => navigate("/auth")} className="btn-solid py-2 px-4">
            Enter Studio <ArrowRight size={15} />
          </button>
        )}
      </div>
    </nav>
  );
}
