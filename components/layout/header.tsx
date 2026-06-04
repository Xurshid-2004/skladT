"use client";

import { useRouter } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { LogOut, User, Home, ArrowLeft } from "lucide-react";
import { clearSession, getSession } from "@/lib/utils/session";
import { useEffect, useState } from "react";
import { Session } from "@/lib/types";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { getReportDateOverride, setReportDateOverride } from "@/lib/utils/report-date-override";

export function Header() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [time, setTime] = useState("");
  const [reportDate, setReportDate] = useState("");

  useEffect(() => {
    setSession(getSession());
    setReportDate(getReportDateOverride());
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

  const zapravkaName = session?.stationId
    ? ZAPRAVKALAR.find((z) => z.id === session.stationId)?.name ?? session.stationId
    : null;

  const handleReportDateChange = (value: string) => {
    setReportDate(value);
    setReportDateOverride(value);
  };

  const todayIso = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/92 shadow-[0_8px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/88">
      <div className="container mx-auto flex min-h-16 items-center justify-between gap-2 px-2.5 py-2 sm:gap-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => router.back()}
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/20 transition-all hover:brightness-105 active:scale-[0.98]"
            title="Orqaga"
            aria-label="Orqaga"
          >
            <ArrowLeft className="h-5 w-5 stroke-[3]" />
            <span>Орқага</span>
          </button>

          {/* Telegram murojat */}
          <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <span className="hidden max-w-[220px] truncate text-xs font-bold leading-tight text-red-500 lg:block">
              Техподдержка
            </span>
            <a
              href="https://t.me/xurshid_bio"
              target="_blank"
              rel="noopener noreferrer"
              title="Техподдержка: @xurshid_bio"
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
          <div className="flex min-w-0 items-center gap-2.5 rounded-xl border-2 border-indigo-200 bg-white px-3 py-2 shadow-sm shadow-indigo-500/10 dark:border-indigo-400/25 dark:bg-slate-900 sm:px-4">
            <User className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
            <div className="min-w-0">
              <span className="block max-w-[118px] truncate text-base font-black leading-tight text-slate-950 dark:text-white sm:max-w-[210px] sm:text-lg">
                {session?.displayName || "Foydalanuvchi"}
              </span>
              {zapravkaName && (
                <span className="block max-w-[118px] truncate text-[10px] font-black uppercase leading-tight tracking-wide text-indigo-600 dark:text-indigo-300 sm:max-w-[210px]">
                  Zapravka: {zapravkaName}
                </span>
              )}
            </div>
          </div>

          {time && (
            <div className="hidden items-center rounded-xl border-2 border-indigo-200 bg-white px-3 py-2 shadow-sm dark:border-indigo-400/25 dark:bg-slate-900 md:flex">
              <span className="text-sm font-black tracking-widest text-indigo-600 tabular-nums dark:text-indigo-300">{time}</span>
            </div>
          )}

          {session?.role === "worker" && (
            <div className="hidden items-center gap-1.5 rounded-xl border-2 border-amber-300 bg-amber-50 px-2.5 py-1.5 shadow-sm dark:border-amber-400/30 dark:bg-amber-950/30 lg:flex">
              <span className="text-[10px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-200">
                Sana
              </span>
              <input
                type="date"
                value={reportDate}
                max={todayIso}
                onChange={(e) => handleReportDateChange(e.target.value)}
                className="h-8 w-[138px] rounded-lg border border-amber-300 bg-white px-2 text-xs font-black text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40 dark:border-amber-400/30 dark:bg-slate-900 dark:text-white"
                title="Test sanasi"
              />
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
