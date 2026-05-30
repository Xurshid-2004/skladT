"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CodeInput } from "@/components/auth/code-input";
import { LoginHeroPanel } from "@/components/auth/login-hero-panel";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { beginLoginAuth, saveSession } from "@/lib/utils/session";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { ADMIN_CODES } from "@/lib/data/kodlar";
import { Session } from "@/lib/types";
import { isCodeBlocked } from "@/lib/firebase/blocked-codes-service";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { KeyRound, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", ""]);
  const [error, setError] = useState("");

  useEffect(() => {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("lock_"))
      .forEach((k) => sessionStorage.removeItem(k));
  }, []);

  const buildLocalSession = (fullCode: string): Session | null => {
    if (ADMIN_CODES.includes(fullCode)) {
      return {
        sessionToken: Math.random().toString(36).substring(7),
        code: fullCode,
        role: "admin",
        nodeId: null,
        stationId: null,
        displayName: "Admin",
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };
    }
    for (const zap of ZAPRAVKALAR) {
      const isMain    = zap.workerCodes.includes(fullCode);
      const isReserve = zap.reserveCodes.includes(fullCode);
      if (isMain || isReserve) {
        return {
          sessionToken: Math.random().toString(36).substring(7),
          code: fullCode,
          role: "worker",
          nodeId: zap.uzelId,
          stationId: zap.id,
          displayName: isReserve ? `${zap.name} (Zaxira)` : zap.name,
          expiresAt: Date.now() + 12 * 60 * 60 * 1000,
        };
      }
    }
    return null;
  };

  const buildStaffSession = useCallback(async (fullCode: string): Promise<Session | null> => {
    try {
      const snap = await getDocs(
        query(collection(db, "staff"), where("tabelNumber", "==", fullCode), limit(1))
      );
      if (snap.empty) return null;

      const data = snap.docs[0].data() as {
        tabelNumber: string; fullName: string; zapravka: string; erju: string;
      };

      const zapKey = data.zapravka
        .replace(/\s*zapravka\s*$/i, "")
        .replace(/'/g, "'")
        .trim()
        .toLowerCase();

      const zap = ZAPRAVKALAR.find(
        (z) =>
          z.name.toLowerCase().replace(/'/g, "'") === zapKey ||
          z.id.toLowerCase() === zapKey ||
          z.slug.toLowerCase() === zapKey,
      );

      if (!zap) return null;

      return {
        sessionToken: Math.random().toString(36).substring(7),
        code: fullCode,
        role: "worker",
        nodeId: zap.uzelId,
        stationId: zap.id,
        displayName: data.fullName?.trim() || zap.name,
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };
    } catch {
      return null;
    }
  }, []);

  const handleVerify = useCallback(async () => {
    const fullCode = code.join("");
    if (fullCode.length < 4) return;

    try {
      await beginLoginAuth();

      const session =
        buildLocalSession(fullCode) ?? (await buildStaffSession(fullCode));

      if (!session) {
        await signOut(auth);
        setError("Kod xato terildi. Qaytadan urinib ko'ring");
        setCode(["", "", "", ""]);
        return;
      }

      if (await isCodeBlocked(fullCode)) {
        await signOut(auth);
        setError("Bu kirish kodi bloklangan. Administratorga murojaat qiling.");
        setCode(["", "", "", ""]);
        return;
      }

      await saveSession(session);

      if (session.role === "worker" && session.stationId) {
        router.push(`/zapravka/${session.stationId}/lokomotiv`);
      } else if (session.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/uzellar");
      }
    } catch {
      try {
        await signOut(auth);
      } catch {
        /* ignore */
      }
      setError("Tekshiruvda xato. Internet aloqasini tekshiring.");
      setCode(["", "", "", ""]);
    }
  }, [code, router, buildStaffSession]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleVerify();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleVerify]);

  const canSubmit = !code.some((c) => !c);

  return (
    <div className="flex min-h-screen w-full bg-[#f6f8fb] dark:bg-[#090c14]">
      <LoginHeroPanel />

      <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f3f7fb_55%,#edf6f1_100%)] dark:bg-[linear-gradient(180deg,#0c111d_0%,#0a0f19_58%,#07130f_100%)] lg:w-1/2">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.13),transparent_34%),linear-gradient(90deg,rgba(79,70,229,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(79,70,229,0.06)_1px,transparent_1px)] bg-[size:auto,44px_44px,44px_44px]" />

        <header className="relative z-10 flex items-center justify-end px-5 pt-5 sm:px-8">
          <ThemeToggle />
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-6 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/25">
                  UZ
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-black leading-tight tracking-tight text-foreground">
                    UZ Temiryo&apos;l
                  </h1>
                  <p className="text-sm font-semibold text-[var(--muted-foreground)]">
                    Yoqilg&apos;i ta&apos;minot
                  </p>
                </div>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300 sm:inline-flex">
                <ShieldCheck className="h-3.5 w-3.5" />
                Xavfsiz
              </span>
            </div>

            <section className="rounded-3xl border border-black/5 bg-white/90 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06] sm:p-7">
              <div className="mb-7">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  Tizimga kirish
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-foreground)]">
                  Maxsus 4 xonali kodni kiriting va ish paneliga o&apos;ting.
                </p>
              </div>

              <div className="space-y-5">
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
                  className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-700 px-5 py-4 text-base font-black text-white shadow-xl shadow-emerald-600/25 transition-all duration-200 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:active:scale-100"
                >
                  Tasdiqlash
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
