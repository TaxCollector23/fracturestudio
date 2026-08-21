import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sun, Moon, Compass, ArrowRight } from "lucide-react";
import { useTheme } from "../lib/useTheme.js";
import { useAuth } from "../lib/useAuth.jsx";

export default function Nav() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 h-16 px-5 md:px-10 flex items-center justify-between
                    border-b border-zinc-200 bg-white/80 dark:border-zinc-900 dark:bg-zinc-950/80 backdrop-blur-xl">
      <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-3">
        <img src="/favicon.svg" alt="Fracture Studio" className="w-8 h-8 rounded-[6px]" />
        <div className="leading-none hidden sm:block">
          <div className="font-serif text-lg tracking-wide">Fracture Studio</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">Argument Engine</div>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <NavLink to="/explore"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "border-zinc-950 bg-zinc-950 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50"
            }`}>
          <Compass size={14} /> Explore
        </NavLink>
        <button onClick={toggle} aria-label="Toggle theme"
          className="w-9 h-9 rounded-sm border border-zinc-300 dark:border-zinc-800 flex items-center justify-center
                     text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {user ? (
          <button onClick={() => navigate("/settings")} className="btn-ghost py-2 px-4 !text-sm">
            {(user.name || "Account").split(" ")[0]}
          </button>
        ) : (
          <button onClick={() => navigate("/auth")} className="btn-solid py-2 px-4 !text-sm">
            Enter Studio <ArrowRight size={15} />
          </button>
        )}
      </div>
    </nav>
  );
}
