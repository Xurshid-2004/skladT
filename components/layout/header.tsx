"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Headphones, LogOut, User } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { clearSession, getSession } from "@/lib/utils/session";
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-slate-50/95 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/90">
      <div className="container mx-auto flex min-h-16 flex-wrap items-center gap-2 px-2 py-2 sm:flex-nowrap sm:gap-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => router.back()}
            className="flex h-10 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-blue-600/25 ring-1 ring-white/30 transition-all hover:brightness-105 active:scale-[0.98] sm:h-11 sm:px-4 sm:text-sm"
            title="Orqaga"
            aria-label="Orqaga"
          >
            <ArrowLeft className="h-4 w-4 stroke-[3] sm:h-5 sm:w-5" />
            <span className="hidden min-[390px]:inline">ORQAGA</span>
          </button>

          <div className="flex min-w-0 items-center gap-1.5 rounded-2xl border border-red-100 bg-white px-2 py-1 shadow-sm dark:border-red-400/15 dark:bg-slate-900">
            <Headphones className="hidden h-4 w-4 text-red-500 md:block" />
            <span className="hidden max-w-[150px] truncate text-xs font-black leading-tight text-red-500 lg:block">
              Texnopodderjka
            </span>
            <a
              href="https://t.me/xurshid_bio"
              target="_blank"
              rel="noopener noreferrer"
              title="Texnopodderjka: @xurshid_bio"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform hover:scale-105 active:scale-95 sm:h-9 sm:w-9"
            >
              <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="10" fill="#29A9EB" />
                <path d="M10.5 23.5L34.8 13.2C35.9 12.8 36.9 13.7 36.5 14.8L31.2 36.1C30.9 37.1 29.6 37.4 28.9 36.6L22.5 29.5L18.2 33.3C17.5 33.9 16.5 33.5 16.3 32.6L14.8 26.1L10.1 24.8C9.2 24.5 9.2 23.2 10.5 23.5Z" fill="white" />
                <path d="M22.5 29.5L28.5 23.5" stroke="#29A9EB" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </a>
          </div>
        </div>

        <div className="order-3 flex min-w-0 flex-[1_1_100%] items-center rounded-2xl border border-indigo-100 bg-white px-3 py-2 shadow-sm shadow-indigo-500/10 dark:border-indigo-400/20 dark:bg-slate-900 sm:order-none sm:min-w-[260px] sm:flex-1 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block break-words text-sm font-black leading-tight text-slate-950 dark:text-white sm:text-xl">
                {session?.displayName || "Foydalanuvchi"}
              </span>
              {zapravkaName && (
                <span className="mt-0.5 inline-flex max-w-full rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black uppercase leading-tight tracking-wide text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <span className="truncate">Zapravka: {zapravkaName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {time && (
            <div className="hidden h-10 items-center rounded-2xl border border-indigo-100 bg-white px-3 shadow-sm dark:border-indigo-400/20 dark:bg-slate-900 md:flex">
              <span className="text-sm font-black tracking-widest text-indigo-600 tabular-nums dark:text-indigo-300">
                {time}
              </span>
            </div>
          )}

          {session?.role === "worker" && (
            <div className="flex h-10 items-center gap-1.5 rounded-2xl border border-emerald-100 bg-white px-2 shadow-sm dark:border-emerald-400/20 dark:bg-slate-900 sm:h-11 sm:px-2.5">
              <CalendarDays className="hidden h-4 w-4 text-emerald-600 sm:block" />
              <span className="hidden text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-200 lg:inline">
                Sana
              </span>
              <input
                type="date"
                value={reportDate}
                max={todayIso}
                onChange={(e) => handleReportDateChange(e.target.value)}
                className="h-8 w-[120px] rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-xs font-black text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300/40 dark:border-emerald-400/30 dark:bg-slate-950 dark:text-white sm:w-[138px]"
                title="Test sanasi"
              />
            </div>
          )}

          <ThemeToggle />

          <button
            onClick={handleLogout}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            title="Chiqish"
            aria-label="Chiqish"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
