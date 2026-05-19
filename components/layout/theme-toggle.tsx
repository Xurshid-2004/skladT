"use client";

import * as React from "react";
import { Moon, Sun, Clock } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAuto, setIsAuto] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedAuto = localStorage.getItem("theme-auto") === "true";
    setIsAuto(savedAuto);
    
    if (savedAuto) {
      applyAutoTheme();
    }
  }, []);

  useEffect(() => {
    if (isAuto) {
      const interval = setInterval(applyAutoTheme, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [isAuto]);

  const applyAutoTheme = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const handleToggle = () => {
    if (isAuto) {
      setIsAuto(false);
      localStorage.setItem("theme-auto", "false");
      setTheme(theme === "dark" ? "light" : "dark");
    } else if (theme === "dark") {
      setTheme("light");
    } else {
      setIsAuto(true);
      localStorage.setItem("theme-auto", "true");
      applyAutoTheme();
    }
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={handleToggle}
      className="relative p-2 rounded-xl bg-muted/50 border border-primary/10 hover:bg-primary/10 transition-colors group overflow-hidden w-10 h-10 flex items-center justify-center"
      title={isAuto ? "Avtomatik (vaqt bo'yicha)" : theme === 'dark' ? "Tungi rejim" : "Kundizgi rejim"}
    >
      {isAuto ? (
        <Clock className="w-5 h-5 text-primary animate-in zoom-in duration-300" />
      ) : theme === 'dark' ? (
        <Moon className="w-5 h-5 text-blue-400 animate-in zoom-in duration-300" />
      ) : (
        <Sun className="w-5 h-5 text-orange-500 animate-in zoom-in duration-300" />
      )}
    </button>
  );
}
