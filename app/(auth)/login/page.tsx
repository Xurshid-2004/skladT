"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CodeInput } from "@/components/auth/code-input";
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

  return (
    <div 
      className="relative h-screen overflow-hidden flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #0ea5e9 50%, #06b6d4 75%, #0f172a 100%)",
        backgroundSize: "400% 400%",
        animation: "gradient 15s ease infinite",
      }}
    >
      {/* Animated accent elements */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)",
        }}
      />
      
      {/* Center accent circle */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-10"
        style={{
          background: "radial-gradient(circle, rgba(52, 211, 153, 0.5) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-20 opacity-60 hover:opacity-100 transition-opacity">
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Badge */}
        <div className="flex justify-center mb-5">
          <div
            className="flex items-center gap-2 px-5 py-2 rounded-full"
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.15)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)] animate-pulse" />
            <span className="text-white/80 font-black text-[10px] uppercase tracking-[0.22em]">
              Tizimga kirish
            </span>
          </div>
        </div>

        {/* Main card */}
        <div
          className="px-12 py-14 rounded-[30px]"
          style={{
            background: "rgba(5, 10, 20, 0.78)",
            backdropFilter: "blur(30px) saturate(1.6)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Brand */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
              UZ TEMIRYO&apos;L
            </h1>
            <p className="font-black text-[13px] tracking-[0.22em] uppercase mt-2 text-emerald-400">
              Yoqilg&apos;i Ta&apos;minot
            </p>
            <div
              className="w-16 h-px mx-auto mt-5"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
            />
            <p className="text-white/50 text-[15px] font-semibold mt-5">
              Maxsus kodni kiriting
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <CodeInput code={code} onChange={setCode} error={!!error} />

            {error && (
              <p className="text-center text-red-400 font-bold text-sm animate-pulse leading-snug">
                {error}
              </p>
            )}

            <button
              onClick={handleVerify}
              disabled={code.some((c) => !c)}
              className="w-full py-5 font-black text-lg rounded-2xl text-white transition-transform duration-100 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                boxShadow: "0 8px 28px rgba(22,163,74,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
            >
              TASDIQLASH
            </button>
          </div>
        </div>

        <p className="text-center text-white/25 text-xs font-bold mt-5 tracking-wide">
          &copy; 2026 UZ Temiryo&apos;l Yoqilg&apos;i Ta&apos;minot
        </p>
      </div>

      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
