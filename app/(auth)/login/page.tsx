"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CodeInput } from "@/components/auth/code-input";
import { LoginHeroPanel } from "@/components/auth/login-hero-panel";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { saveSession } from "@/lib/utils/session";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { ADMIN_CODES, DEVELOPER_CODE } from "@/lib/data/kodlar";
import { Session } from "@/lib/types";
import { isCodeBlocked } from "@/lib/firebase/blocked-codes-service";
import { collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

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
    if (fullCode === DEVELOPER_CODE) {
      return {
        sessionToken: Math.random().toString(36).substring(7),
        code: fullCode,
        role: "developer",
        nodeId: null,
        stationId: null,
        displayName: "Dasturchi",
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };
    }
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

    let session: Session | null = buildLocalSession(fullCode);

    if (!session) {
      session = await buildStaffSession(fullCode);
    }

    if (!session) {
      setError("Kod xato terildi. Qaytadan urinib ko'ring");
      setCode(["", "", "", ""]);
      return;
    }

    try {
      if (await isCodeBlocked(fullCode)) {
        setError("Bu kirish kodi bloklangan. Administratorga murojaat qiling.");
        setCode(["", "", "", ""]);
        return;
      }
    } catch {
      setError("Tekshiruvda xato. Internet aloqasini tekshiring.");
      return;
    }

    await saveSession(session);

    if (session.role === "worker" && session.stationId) {
      router.push(`/zapravka/${session.stationId}/lokomotiv`);
    } else if (session.role === "admin") {
      router.push("/admin");
    } else if (session.role === "developer") {
      router.push("/dasturchi");
    } else {
      router.push("/uzellar");
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
    <div className="flex min-h-screen w-full bg-sky-50 dark:bg-slate-950">
      <LoginHeroPanel />

      <div className="relative flex flex-1 flex-col lg:w-1/2 min-h-screen overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-cyan-100 dark:from-slate-950 dark:via-blue-950 dark:to-sky-950">
        {/* Ko'k rangli ambient blob'lar */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-[15%] -left-[10%] w-[65%] h-[65%] rounded-full bg-blue-400/30 dark:bg-blue-500/20 blur-[120px] animate-pulse" style={{ animationDuration: "13s" }} />
          <div className="absolute top-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-sky-400/35 dark:bg-sky-500/20 blur-[130px] animate-pulse" style={{ animationDuration: "17s", animationDelay: "2s" }} />
          <div className="absolute top-[45%] -left-[8%] w-[55%] h-[55%] rounded-full bg-cyan-400/30 dark:bg-cyan-500/15 blur-[120px] animate-pulse" style={{ animationDuration: "15s", animationDelay: "1s" }} />
          <div className="absolute -bottom-[10%] right-[5%] w-[55%] h-[55%] rounded-full bg-indigo-400/25 dark:bg-indigo-500/15 blur-[110px] animate-pulse" style={{ animationDuration: "14s", animationDelay: "3s" }} />
        </div>

        <header className="flex items-center justify-end px-5 pt-5 sm:px-8 z-10">
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-5 pb-8 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="flex items-center gap-3 mb-10">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white font-black text-sm shadow-md"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                }}
                aria-hidden
              >
                UZ
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                  UZ Temiryo&apos;l
                </h1>
                <p className="text-[13px] font-semibold text-[var(--muted-foreground)]">
                  Yoqilg&apos;i ta&apos;minot
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-bold text-foreground">Tizimga kirish</h2>
              <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
                Maxsus 4 xonali kodni kiriting
              </p>
            </div>

            <div className="space-y-6">
              <CodeInput code={code} onChange={setCode} error={!!error} />

              {error ? (
                <p
                  className="text-center text-danger font-semibold text-sm leading-snug"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={handleVerify}
                disabled={!canSubmit}
                className="w-full py-4 font-bold text-base rounded-2xl text-white transition-all duration-150 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100"
                style={{
                  background:
                    "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
                  color: "#fff",
                  opacity: canSubmit ? 1 : 0.55,
                  boxShadow: canSubmit
                    ? "0 8px 22px rgba(22, 163, 74, 0.45)"
                    : "0 4px 12px rgba(22, 163, 74, 0.25)",
                }}
              >
                Tasdiqlash
              </button>
            </div>
          </div>
        </main>


      </div>
    </div>
  );
}
