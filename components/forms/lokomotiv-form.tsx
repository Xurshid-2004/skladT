"use client";

import { useState, useMemo, useEffect } from "react";
import {
  HARAKAT_TURI_LIST,
  RUSUMI_LIST,
  RUSUMI_FILTER,
  FIELDS_VISIBILITY
} from "@/lib/data/lokomotiv-config";
import { addLokomotivSubmission } from "@/lib/firebase/lokomotiv-service";
import { subscribeToActiveApprovals } from "@/lib/firebase/approval-service";
import { getSession } from "@/lib/utils/session";
import { notifyOverLimitEntry } from "@/lib/telegram/bot-service";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { HarakatTuri, Rusumi, Approval, LokomotivSubmission } from "@/lib/types";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";

interface LokomotivFormProps {
  stationId: string;
  onSaved?: () => void;
}

export default function LokomotivForm({ stationId, onSaved }: LokomotivFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [approvals, setApprovals] = useState<Approval[]>([]);
  
  const [formData, setFormData] = useState({
    harakatTuri: "" as HarakatTuri | "",
    rusumi: "" as Rusumi | "",
    lokomotivNumber: "",
    poyezdNumber: "",
    ruxsatIndeksi: "",
    poyezdVazni: "",
    qoldiq: "",
    qanchaBerildi: "",
    dizMasla: "",
    stansiya: "",
    tashkilot: "",
    ijarachi: "",
    mashinadaYetkazildi: false,
    mashinaRaqami: "",
  });

  const [options, setOptions] = useState<{
    stansiyalar: string[];
    tashkilotlar: string[];
    ijarachilar: string[];
  }>({
    stansiyalar: [],
    tashkilotlar: [],
    ijarachilar: [],
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOptions({
          stansiyalar: data.stansiyalar?.[stationId] || data.stansiyalar?.default || [],
          tashkilotlar: data.tashkilotlar?.[stationId] || data.tashkilotlar?.default || [],
          ijarachilar: data.ijarachilar?.[stationId] || data.ijarachilar?.default || [],
        });
      }
    };
    fetchSettings();

    const unsubscribeApprovals = subscribeToActiveApprovals(stationId, setApprovals);
    return () => unsubscribeApprovals();
  }, [stationId]);

  const hasApproval = useMemo(() => {
    return approvals.some(a => 
      a.requestType === 'lokomotiv' && 
      a.seriya === formData.rusumi && 
      a.lokomotivNumber === formData.lokomotivNumber &&
      a.isActive
    );
  }, [formData.rusumi, formData.lokomotivNumber, approvals]);

  const visibleFields = useMemo(() => {
    if (!formData.harakatTuri) return [];
    return FIELDS_VISIBILITY[formData.harakatTuri as HarakatTuri];
  }, [formData.harakatTuri]);

  const filteredRusumlar = useMemo(() => {
    if (!formData.harakatTuri) return [];
    const allowed = RUSUMI_FILTER[formData.harakatTuri as HarakatTuri];
    return RUSUMI_LIST.filter(r => allowed.includes(r.value));
  }, [formData.harakatTuri]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!formData.harakatTuri) return "Harakat turini tanlang";
    if (!formData.rusumi) return "Rusumni tanlang";
    
    for (const field of visibleFields) {
      if (!formData[field as keyof typeof formData] && field !== 'poyezdNumber') {
        return "Barcha maydonlarni to'ldiring";
      }
    }
    
    if (formData.mashinadaYetkazildi && !formData.mashinaRaqami) {
      return "Mashina raqamini kiriting";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("[Lokomotiv] Saqlash bosildi, formData:", formData);

    const errorMsg = validate();
    if (errorMsg) {
      console.warn("[Lokomotiv] Validatsiya xatosi:", errorMsg);
      setError(errorMsg);
      // Foydalanuvchi xatoni ko'rishi uchun shu sahifaning yuqorisiga skroll qilamiz
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setError("");
    setLoading(true);

    const session = getSession();
    if (!session) {
      setError("Sessiya muddati tugagan. Qayta kiring.");
      setLoading(false);
      return;
    }

    const isOverLimit = (formData.harakatTuri === 'xojalik' || formData.harakatTuri === 'ijara') && !hasApproval;

    const submissionData: Omit<LokomotivSubmission, 'id' | 'timestamp' | 'createdAt'> = {
      staffCode: session.code,
      staffName: session.displayName,
      nodeId: session.nodeId!,
      stationId: stationId,
      category: 'lokomotiv',
      harakatTuri: formData.harakatTuri as HarakatTuri,
      rusumi: formData.rusumi as Rusumi,
      lokomotivNumber: formData.lokomotivNumber,
      poyezdNumber: formData.poyezdNumber || undefined,
      ruxsatIndeksi: formData.ruxsatIndeksi || undefined,
      poyezdVazni: formData.poyezdVazni ? Number(formData.poyezdVazni) : undefined,
      qoldiq: Number(formData.qoldiq),
      qanchaBerildi: Number(formData.qanchaBerildi),
      dizMasla: Number(formData.dizMasla),
      stansiya: formData.stansiya || undefined,
      tashkilot: formData.tashkilot || undefined,
      ijarachi: formData.ijarachi || undefined,
      mashinadaYetkazildi: formData.mashinadaYetkazildi,
      mashinaRaqami: formData.mashinaRaqami || undefined,
      isOverLimit: isOverLimit,
    };

    try {
      if (navigator.onLine) {
        console.log("[Lokomotiv] Firestore'ga yuborilmoqda...", submissionData);
        const submissionId = await addLokomotivSubmission(submissionData);
        console.log("[Lokomotiv] Saqlandi, ID:", submissionId);

        if (isOverLimit) {
          notifyOverLimitEntry(
            'lokomotiv',
            session.displayName,
            stationId,
            Number(formData.qanchaBerildi),
            0
          );
        }
      } else {
        console.log("[Lokomotiv] Offline rejim, IndexedDB'ga yozilmoqda");
        await savePendingSubmission(submissionData);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      handleReset();
      onSaved?.();
    } catch (err: any) {
      console.error("[Lokomotiv] Saqlash xatosi:", err);
      // Firestore rules permission-denied bo'lsa — offline'ga fallback
      const isPermissionError =
        err?.code === "permission-denied" ||
        err?.message?.includes("permissions") ||
        err?.message?.includes("PERMISSION_DENIED");

      if (isPermissionError) {
        try {
          await savePendingSubmission(submissionData);
          setError(
            "Firestore ruxsat bermadi (Anonymous Auth yoqilmagan bo'lishi mumkin). " +
              "Yozuv qurilmaga vaqtincha saqlandi va internet/auth tiklangach yuklab yuboriladi."
          );
        } catch (offlineErr) {
          setError("Saqlab bo'lmadi: " + (err.message || "Noma'lum xato"));
        }
      } else {
        setError("Xato yuz berdi: " + (err.message || err.code || "Noma'lum"));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const inputs = Array.from(form.querySelectorAll<HTMLElement>("input:not([type=hidden]), select"));
    const idx = inputs.indexOf(e.currentTarget);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (idx !== -1 && idx < inputs.length - 1) inputs[idx + 1].focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (idx > 0) inputs[idx - 1].focus();
    }
  };

  const handleReset = () => {
    setFormData({
      harakatTuri: "",
      rusumi: "",
      lokomotivNumber: "",
      poyezdNumber: "",
      ruxsatIndeksi: "",
      poyezdVazni: "",
      qoldiq: "",
      qanchaBerildi: "",
      dizMasla: "",
      stansiya: "",
      tashkilot: "",
      ijarachi: "",
      mashinadaYetkazildi: false,
      mashinaRaqami: "",
    });
    setError("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-500">
      {/* Top Sticky Error Banner — har doim ko'rinadi */}
      {error && (
        <div className="sticky top-4 z-30 bg-danger text-white p-5 rounded-2xl shadow-2xl shadow-danger/30 flex items-start gap-3 font-bold animate-in slide-in-from-top-4 duration-300 border-2 border-white/20">
          <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-black uppercase tracking-wide text-sm mb-1">Xato</p>
            <p className="text-sm font-medium leading-relaxed">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 hover:bg-white/10 rounded-lg p-1 transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Harakat Turi */}
      <div className="bg-background/70 backdrop-blur-md p-6 rounded-3xl border-2 border-primary/15 shadow-xl">
        <label className="block text-sm font-black text-primary mb-4 tracking-widest uppercase">
          1. HARAKAT TURI
        </label>
        {hasApproval && (
          <div className="mb-4 p-4 bg-success/10 border border-success/20 rounded-2xl flex items-center gap-3 text-success animate-bounce">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs font-black uppercase">Admin tomonidan ruxsat berilgan (Limit yumshoq)</span>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {HARAKAT_TURI_LIST.map((item) => {
            const active = formData.harakatTuri === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => handleInputChange("harakatTuri", item.value)}
                className={`group relative p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-300 border-2 overflow-hidden ${
                  active
                    ? "bg-gradient-to-br from-primary to-primary/80 border-primary text-white shadow-xl shadow-primary/30 scale-105"
                    : "bg-background/80 backdrop-blur-sm border-primary/15 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.03] hover:shadow-md"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-10 h-10 rounded-xl text-xl font-black transition-all ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-primary/10 text-primary group-hover:bg-primary/20"
                  }`}
                >
                  {item.number}
                </span>
                <span className={`text-xs font-bold uppercase tracking-wide ${active ? "text-white" : "text-foreground/80"}`}>
                  {item.label}
                </span>
                {active && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {formData.harakatTuri && (
        <>
          {/* Rusumi */}
          <div className="bg-background/70 backdrop-blur-md p-6 rounded-3xl border-2 border-primary/15 shadow-xl animate-in slide-in-from-top-4 duration-300">
            <label className="block text-sm font-black text-primary mb-4 tracking-widest uppercase">
              2. RUSUMI
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {filteredRusumlar.map((item) => {
                const active = formData.rusumi === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleInputChange("rusumi", item.value)}
                    className={`p-3 rounded-xl text-center transition-all duration-200 border-2 ${
                      active
                        ? "bg-gradient-to-br from-primary to-primary/80 border-primary text-white shadow-lg shadow-primary/20 scale-105"
                        : "bg-background/80 backdrop-blur-sm border-primary/15 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.03]"
                    }`}
                  >
                    <span className={`text-xs font-bold ${active ? "text-white" : "text-foreground/80"}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-8 duration-500">
            {visibleFields.map((field, idx) => {
              const n = idx + 3;
              let label = "";
              let placeholder = "";
              let type = "text";
              let listId = "";

              switch (field) {
                case "lokomotivNumber": label = `${n}. LOKOMOTIV №`; placeholder = "Masalan: 1141"; break;
                case "poyezdNumber": label = `${n}. POYEZD №`; placeholder = "Masalan: 3606"; break;
                case "ruxsatIndeksi": label = `${n}. RUXSAT INDEKSI`; placeholder = "Masalan: 3001-T"; break;
                case "poyezdVazni": label = `${n}. POYEZD VAZNI (tonna)`; placeholder = "Masalan: 5000"; type = "number"; break;
                case "qoldiq": label = `${n}. QOLDIQ (kg)`; placeholder = "0"; type = "number"; break;
                case "qanchaBerildi": label = `${n}. QANCHA BERILDI (kg)`; placeholder = "0"; type = "number"; break;
                case "dizMasla": label = `${n}. DIZ. MASLA (kg)`; placeholder = "0"; type = "number"; break;
                case "stansiya": label = `${n}. STANSIYA`; placeholder = "Tanlang yoki yozing"; listId = "stansiyalar"; break;
                case "tashkilot": label = `${n}. TASHKILOT`; placeholder = "Tanlang yoki yozing"; listId = "tashkilotlar"; break;
                case "ijarachi": label = `${n}. IJARACHI`; placeholder = "Tanlang yoki yozing"; listId = "ijarachilar"; break;
              }

              return (
                <div key={field} className="bg-background/70 backdrop-blur-md p-6 rounded-3xl border-2 border-primary/15 shadow-xl hover:border-primary/30 transition-colors">
                  <label className="block text-sm font-black text-primary mb-3 tracking-widest uppercase">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={formData[field as keyof typeof formData] as string}
                    onChange={(e) => handleInputChange(field, e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    list={listId}
                    className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-lg text-foreground transition-all"
                  />
                  {listId && (
                    <datalist id={listId}>
                      {options[listId as keyof typeof options].map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  )}
                </div>
              );
            })}

            {/* Mashinada yetkazildimi */}
            <div className="bg-background/70 backdrop-blur-md p-6 rounded-3xl border-2 border-primary/15 shadow-xl">
              <label className="block text-sm font-black text-primary mb-4 tracking-widest uppercase">
                {visibleFields.length + 3}. MASHINADA YETKAZILDIMI?
              </label>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => handleInputChange("mashinadaYetkazildi", true)}
                  className={`py-3.5 rounded-xl font-black text-base tracking-wider transition-all border-2 ${
                    formData.mashinadaYetkazildi
                      ? "bg-gradient-to-br from-primary to-primary/80 border-primary text-white shadow-lg shadow-primary/30 scale-[1.02]"
                      : "bg-background border-primary/20 hover:border-primary/40 text-foreground/80 hover:bg-primary/5"
                  }`}
                >
                  HA
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange("mashinadaYetkazildi", false)}
                  className={`py-3.5 rounded-xl font-black text-base tracking-wider transition-all border-2 ${
                    !formData.mashinadaYetkazildi
                      ? "bg-gradient-to-br from-danger to-danger/80 border-danger text-white shadow-lg shadow-danger/30 scale-[1.02]"
                      : "bg-background border-primary/20 hover:border-primary/40 text-foreground/80 hover:bg-primary/5"
                  }`}
                >
                  YO'Q
                </button>
              </div>
              {formData.mashinadaYetkazildi && (
                <input
                  type="text"
                  value={formData.mashinaRaqami}
                  onChange={(e) => handleInputChange("mashinaRaqami", e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="MASHINA RAQAMI"
                  className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-lg text-foreground transition-all animate-in zoom-in-95 duration-200"
                />
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 p-4 rounded-2xl flex items-center gap-3 text-danger font-bold animate-in shake duration-300">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Success Toast */}
          {success && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-success text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-10 duration-500">
              <CheckCircle2 className="w-6 h-6" />
              SAQLANDI ✓
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 pb-20 sm:pb-0">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 py-5 bg-muted rounded-2xl font-black text-lg tracking-wider hover:bg-muted/80 transition-all uppercase"
            >
              Tozalash
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-5 bg-accent text-white rounded-2xl font-black text-xl tracking-wider hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 uppercase"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                "Saqlash"
              )}
            </button>
          </div>
        </>
      )}
    </form>
  );
}