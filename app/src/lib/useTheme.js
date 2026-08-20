import { useEffect, useState } from "react";

const KEY = "fracture_theme";

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(KEY) || "dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
