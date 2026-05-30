"use client";

import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { LogOut, User, Home, ArrowLeft } from "lucide-react";
import { clearSession, getSession } from "@/lib/utils/session";
import { useEffect, useState } from "react";
import { Session } from "@/lib/types";

export function Header() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [time, setTime] = useState("");

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  const handleHome = () => {
    if (!session) return;
    if (session.role === "worker" && session.stationId) {
      router.push(`/zapravka/${session.stationId}/lokomotiv`);
    } else if (session.role === "admin") {
      router.push("/admin");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/95 shadow-sm backdrop-blur-xl">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => router.back()}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            title="Orqaga"
            aria-label="Orqaga"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-black text-white shadow-md shadow-primary/20">
            UZ
          </div>

          {/* Telegram murojat */}
          <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <span className="hidden max-w-[220px] truncate text-[10px] font-bold leading-tight text-red-500 lg:block">
              saytdagi yangilik va muammolar uchun murojaat
            </span>
            <a
              href="https://t.me/xurshid_bio"
              target="_blank"
              rel="noopener noreferrer"
              title="saytdagi yangilik va muammolar uchun murojat: @xurshid_bio"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95"
            >
              <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="10" fill="#29A9EB"/>
                <path d="M10.5 23.5L34.8 13.2C35.9 12.8 36.9 13.7 36.5 14.8L31.2 36.1C30.9 37.1 29.6 37.4 28.9 36.6L22.5 29.5L18.2 33.3C17.5 33.9 16.5 33.5 16.3 32.6L14.8 26.1L10.1 24.8C9.2 24.5 9.2 23.2 10.5 23.5Z" fill="white"/>
                <path d="M22.5 29.5L28.5 23.5" stroke="#29A9EB" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-primary/10 bg-muted px-2.5 py-2 sm:px-3">
            <User className="h-4 w-4 shrink-0 text-primary" />
            <span className="max-w-[92px] truncate text-xs font-semibold sm:max-w-[150px] sm:text-sm">
              {session?.displayName || "Foydalanuvchi"}
            </span>
          </div>

          {time && (
            <div className="hidden items-center rounded-xl border border-primary/10 bg-muted px-3 py-2 md:flex">
              <span className="text-sm font-black tracking-widest text-primary tabular-nums">{time}</span>
            </div>
          )}

          <ThemeToggle />

          <button
            onClick={handleHome}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            title="Bosh sahifa"
            aria-label="Bosh sahifa"
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            onClick={handleLogout}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
            title="Chiqish"
            aria-label="Chiqish"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
