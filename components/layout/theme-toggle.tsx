"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    localStorage.removeItem("theme-auto");
  }, []);

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={handleToggle}
      className="relative p-2 rounded-xl bg-muted/50 border border-primary/10 hover:bg-primary/10 transition-colors group overflow-hidden w-10 h-10 flex items-center justify-center"
      title={isDark ? "Tungi rejim" : "Kundizgi rejim"}
      aria-label={isDark ? "Kundizgi rejimga o'tish" : "Tungi rejimga o'tish"}
    >
      {isDark ? (
        <Moon className="w-5 h-5 text-blue-400 animate-in zoom-in duration-300" />
      ) : (
        <Sun className="w-5 h-5 text-orange-500 animate-in zoom-in duration-300" />
      )}
    </button>
  );
}
