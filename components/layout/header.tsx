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
    } else if (session.role === "developer") {
      router.push("/dasturchi");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-primary/10 bg-background shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="Orqaga"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-primary/20">
            UZ
          </div>
          <span className="font-bold hidden md:inline-block tracking-tight text-primary">
            UZ TEMIRYO'L ENERGIYA TA'MINOT
          </span>

          {/* Telegram murojat */}
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            <span className="text-[9px] font-bold text-red-500 leading-tight hidden lg:block italic">
              saytdagi yangilik va muammolar uchun murojat :
            </span>
            <a
              href="https://t.me/xurshid_bio"
              target="_blank"
              rel="noopener noreferrer"
              title="saytdagi yangilik va muammolar uchun murojat: @xurshid_bio"
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:scale-110 active:scale-95 transition-transform shrink-0"
            >
              <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="10" fill="#29A9EB"/>
                <path d="M10.5 23.5L34.8 13.2C35.9 12.8 36.9 13.7 36.5 14.8L31.2 36.1C30.9 37.1 29.6 37.4 28.9 36.6L22.5 29.5L18.2 33.3C17.5 33.9 16.5 33.5 16.3 32.6L14.8 26.1L10.1 24.8C9.2 24.5 9.2 23.2 10.5 23.5Z" fill="white"/>
                <path d="M22.5 29.5L28.5 23.5" stroke="#29A9EB" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-2xl border border-primary/10">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold truncate max-w-[120px]">
              {session?.displayName || "Foydalanuvchi"}
            </span>
          </div>

          {time && (
            <div className="hidden sm:flex items-center px-3 py-2 bg-muted rounded-2xl border border-primary/10">
              <span className="text-sm font-black tracking-widest text-primary tabular-nums">{time}</span>
            </div>
          )}

          <ThemeToggle />

          <button
            onClick={handleHome}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
            title="Bosh sahifa"
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-muted-foreground hover:text-danger hover:bg-danger/10 rounded-xl transition-colors"
            title="Chiqish"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
