"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CodeInput } from "@/components/auth/code-input";
import { LoginHeroPanel } from "@/components/auth/login-hero-panel";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { beginLoginAuth, saveSession } from "@/lib/utils/session";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { AccessCode, Session } from "@/lib/types";
import { isCodeBlocked } from "@/lib/firebase/blocked-codes-service";
import { collection, query, where, limit, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { KeyRound, ShieldCheck } from "lucide-react";

function normalizeZapravkaKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*zapravka\s*$/i, "")
    .replace(/[`'‘’ʻʼ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const ZAPRAVKA_KEY_ALIASES: Record<string, string> = {
  margilon: "marglon",
  qumqorgon: "qumqurgon",
  termiz: "termez",
};

function canonicalZapravkaKey(value: string): string {
  const key = normalizeZapravkaKey(value);
  return ZAPRAVKA_KEY_ALIASES[key] ?? key;
}

function resolveZapravka(rawZapravka: string) {
  const staffKey = canonicalZapravkaKey(rawZapravka);
  return ZAPRAVKALAR.find((z) => {
    const keys = [z.id, z.slug, z.name].map(canonicalZapravkaKey);
    return keys.includes(staffKey);
  });
}

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);

  useEffect(() => {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("lock_"))
      .forEach((k) => sessionStorage.removeItem(k));
  }, []);

  const buildAdminAccessSession = useCallback(async (fullCode: string): Promise<Session | null> => {
    try {
      const snap = await getDoc(doc(db, "access_codes", fullCode));
      if (!snap.exists()) return null;

      const data = snap.data() as Partial<AccessCode>;
      if (data.role !== "admin" || data.isActive === false) return null;
      const adminName = data.displayName?.trim();
      if (!adminName) return null;

      return {
        sessionToken: Math.random().toString(36).substring(7),
        code: fullCode,
        role: "admin",
        nodeId: null,
        stationId: null,
        displayName: adminName,
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };
    } catch {
      return null;
    }
  }, []);

  const buildStaffSession = useCallback(async (fullCode: string): Promise<Session | null> => {
    try {
      const snap = await getDocs(
        query(collection(db, "staff"), where("tabelNumber", "==", fullCode), limit(1))
      );
      if (snap.empty) return null;

      const data = snap.docs[0].data() as {
        tabelNumber: string; fullName: string; zapravka: string; erju: string;
      };
      const staffCode = data.tabelNumber?.trim();
      const staffName = data.fullName?.trim();
      const staffZapravka = data.zapravka?.trim();

      if (!staffCode || staffCode !== fullCode || !staffName || !staffZapravka) {
        return null;
      }

      const zap = resolveZapravka(staffZapravka);

      if (!zap) return null;

      return {
        sessionToken: Math.random().toString(36).substring(7),
        code: fullCode,
        role: "worker",
        nodeId: zap.uzelId,
        stationId: zap.id,
        displayName: staffName,
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };
    } catch {
      return null;
    }
  }, []);

  const handleVerify = useCallback(async () => {
    const fullCode = code.trim();
    if (!fullCode || verifyingRef.current) return;

    verifyingRef.current = true;
    setVerifying(true);
    setError("");
    try {
      await beginLoginAuth();

      const [adminSession, staffSession, blocked] = await Promise.all([
        buildAdminAccessSession(fullCode),
        buildStaffSession(fullCode),
        isCodeBlocked(fullCode),
      ]);
      const session = adminSession ?? staffSession;

      if (!session) {
        await signOut(auth);
        setError("siz bizda shubxa uyg'otdingiz");
        setCode("");
        return;
      }

      if (blocked) {
        await signOut(auth);
        setError("Bu kirish kodi bloklangan. Administratorga murojaat qiling.");
        setCode("");
        return;
      }

      await saveSession(session);

      if (session.role === "worker" && session.stationId) {
        router.push(`/zapravka/${session.stationId}/lokomotiv`);
      } else if (session.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/login");
      }
    } catch {
      try {
        await signOut(auth);
      } catch {
        /* ignore */
      }
      setError("Tekshiruvda xato. Internet aloqasini tekshiring.");
      setCode("");
    } finally {
      verifyingRef.current = false;
      setVerifying(false);
    }
  }, [code, router, buildStaffSession, buildAdminAccessSession]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleVerify();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleVerify]);

  const canSubmit = !!code.trim() && !verifying;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#071126]">
      <LoginHeroPanel className="border-r border-white/10" />

      <div className="relative flex h-screen flex-1 flex-col overflow-hidden bg-[#071126] lg:w-[48%] xl:w-[46%]">
        <div className="pointer-events-none absolute inset-0 bg-[url('/login/slide-4.png')] bg-cover bg-center opacity-20" />
        <div className="pointer-events-none absolute inset-0 bg-[#071126]/82" />
        <div className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-8 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:52px_52px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(59,130,246,0.22),transparent_32%),radial-gradient(circle_at_18%_86%,rgba(16,185,129,0.18),transparent_34%)]" />

        <header className="relative z-10 flex shrink-0 items-center justify-end px-5 pt-4 sm:px-8">
          <ThemeToggle />
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-5 pt-3 sm:px-10">
          <div className="w-full max-w-[430px] -translate-y-6 sm:-translate-y-8">
            <div className="mb-3 flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/12 bg-white/10 p-3 shadow-2xl shadow-black/20 backdrop-blur-md">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-950/35">
                  UZ
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black leading-tight tracking-tight text-white drop-shadow-sm">
                    UZ Temiryo&apos;l
                  </h1>
                  <p className="text-sm font-semibold text-[#f5d98b]">
                    Yoqilg&apos;i ta&apos;minot
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/admin.html";
                }}
                className="hidden items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-emerald-100 shadow-sm shadow-black/20 transition-all hover:bg-emerald-300/18 active:scale-95 sm:inline-flex"
                aria-label="Admin panelga o'tish"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Xavfsiz
              </button>
            </div>

            <section className="relative overflow-hidden rounded-[1.8rem] border border-white/20 bg-white/[0.96] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-emerald-400 to-orange-400" />
              <div className="mb-5">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">
                  Tizimga kirish
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#667085]">
                  Maxsus kodni kiriting va ish paneliga o&apos;ting.
                </p>
              </div>

              <div className="space-y-4">
                <CodeInput code={code} onChange={setCode} error={!!error} />

                {error ? (
                  <p
                    className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-center text-sm font-bold leading-snug text-danger"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!canSubmit}
                  className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-green-500 px-5 py-4 text-base font-black text-white shadow-xl shadow-emerald-700/25 transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:active:scale-100"
                >
                  {verifying ? "Tekshirilmoqda..." : "Tasdiqlash"}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}































