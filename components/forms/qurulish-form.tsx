"use client";

import { useState, useEffect, useMemo } from "react";
import { subscribeToLimits, checkQurulishLimit, LimitsSettings } from "@/lib/firebase/limits-service";
import { addSubmission } from "@/lib/firebase/submissions-service";
import { appendFuelRecordForErjuJu } from "@/lib/firebase/fuel-record-writer";
import { subscribeToActiveApprovals } from "@/lib/firebase/approval-service";
import { getSession } from "@/lib/utils/session";
import { notifyOverLimitEntry } from "@/lib/telegram/bot-service";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Approval } from "@/lib/types";

interface QurulishFormProps {
  stationId: string;
  onSaved?: () => void;
}

export default function QurulishForm({ stationId, onSaved }: QurulishFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<LimitsSettings | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [formData, setFormData] = useState({
    korxonaNomi: "",
    texnikaSoni: "",
    obyekt: "",
    masulShaxs: "",
    lavozim: "",
    qanchaOlindi: "",
    dopLimit: "",
    buyruqNumber: "",
    kimTomonidan: "",
    buyruqVaqti: "",
    mashinadaYetkazildi: false,
    mashinaRaqami: "",
  });

  useEffect(() => {
    const unsubscribeLimits = subscribeToLimits(setLimits);
    const unsubscribeApprovals = subscribeToActiveApprovals(stationId, setApprovals);
    return () => {
      unsubscribeLimits();
      unsubscribeApprovals();
    };
  }, [stationId]);

  const limitInfo = useMemo(() => {
    const info = checkQurulishLimit(
      formData.korxonaNomi,
      Number(formData.qanchaOlindi),
      limits
    );

    const hasApproval = approvals.some(a =>
      a.requestType === 'korxona' &&
      a.korxonaNomi === formData.korxonaNomi &&
      a.isActive
    );

    if (hasApproval) {
      return { ...info, isOverLimit: false };
    }

    return info;
  }, [formData.korxonaNomi, formData.qanchaOlindi, limits, approvals]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSaveDisabled = useMemo(() => {
    const required = ["korxonaNomi", "texnikaSoni", "obyekt", "masulShaxs", "lavozim", "qanchaOlindi"];
    for (const key of required) {
      if (!formData[key as keyof typeof formData]) return true;
    }
    if (limitInfo.isOverLimit) {
      if (!formData.buyruqNumber || !formData.kimTomonidan || !formData.buyruqVaqti) return true;
    }
    if (formData.mashinadaYetkazildi && !formData.mashinaRaqami) return true;
    return false;
  }, [formData, limitInfo.isOverLimit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const session = getSession();
    if (!session) {
      setError("Sessiya muddati tugagan. Qayta kiring.");
      setLoading(false);
      return;
    }

    try {
      const submissionData = {
        staffCode: session.code,
        staffName: session.displayName,
        nodeId: session.nodeId!,
        stationId: stationId,
        category: 'qurulish',
        korxonaNomi: formData.korxonaNomi,
        texnikaSoni: Number(formData.texnikaSoni),
        obyekt: formData.obyekt,
        masulShaxs: formData.masulShaxs,
        lavozim: formData.lavozim,
        qanchaOlindi: Number(formData.qanchaOlindi),
        dopLimit: formData.dopLimit ? Number(formData.dopLimit) : undefined,
        buyruqNumber: limitInfo.isOverLimit ? formData.buyruqNumber : undefined,
        kimTomonidan: limitInfo.isOverLimit ? formData.kimTomonidan : undefined,
        buyruqVaqti: limitInfo.isOverLimit ? new Date(formData.buyruqVaqti).getTime() : undefined,
        mashinadaYetkazildi: formData.mashinadaYetkazildi,
        mashinaRaqami: formData.mashinaRaqami || undefined,
        limit: formData.dopLimit ? Number(formData.dopLimit) : limitInfo.limit,
        isOverLimit: limitInfo.isOverLimit,
        oshiqMiqdor: limitInfo.oshiqMiqdor,
      };

      if (navigator.onLine) {
        await addSubmission('qurulish', submissionData);
        try {
          const ti = [submissionData.korxonaNomi, submissionData.obyekt]
            .filter(Boolean)
            .join(" · ");
          await appendFuelRecordForErjuJu("qurulish", {
            stationId,
            staffCode: session.code,
            staffName: session.displayName,
            fuelAmountKg: submissionData.qanchaOlindi,
            trainIndex: ti || String(submissionData.obyekt || ""),
          });
        } catch (fe) {
          console.warn("fuelRecords (qurulish) yozilmadi:", fe);
        }

        if (limitInfo.isOverLimit) {
          notifyOverLimitEntry(
            'qurulish',
            session.displayName,
            stationId,
            Number(formData.qanchaOlindi),
            limitInfo.limit || 0
          );
        }
      } else {
        await savePendingSubmission(submissionData);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      handleReset();
      onSaved?.();
    } catch (err: any) {
      setError("Xato: " + err.message);
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

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "TEXTAREA") return;
    e.preventDefault();
    if (!loading && !isSaveDisabled) e.currentTarget.requestSubmit();
  };

  const handleReset = () => {
    setFormData({
      korxonaNomi: "",
      texnikaSoni: "",
      obyekt: "",
      masulShaxs: "",
      lavozim: "",
      qanchaOlindi: "",
      dopLimit: "",
      buyruqNumber: "",
      kimTomonidan: "",
      buyruqVaqti: "",
      mashinadaYetkazildi: false,
      mashinaRaqami: "",
    });
    setError("");
  };

  const qurulishKorxonalar = limits?.qurulishKorxonaList?.[stationId] || limits?.qurulishKorxonaList?.default || [];

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-2.5">
      <div className={`p-3.5 sm:p-4 rounded-[22px] border-2 transition-all duration-500 shadow-lg backdrop-blur-md ${
        limitInfo.isOverLimit ? "bg-danger/10 border-danger/30" : "bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-sky-200/70"
      }`}>
        <h2 className={`text-base sm:text-lg font-black mb-3 uppercase tracking-tight ${
          limitInfo.isOverLimit ? "text-danger" : "text-primary"
        }`}>
          Qurulish ishlari uchun yoqilg'i
        </h2>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 xl:grid-cols-[minmax(13rem,1.25fr)_minmax(7rem,0.55fr)_minmax(13rem,1.05fr)_minmax(10rem,0.85fr)_minmax(9rem,0.75fr)_minmax(8rem,0.65fr)_minmax(8rem,0.65fr)_minmax(10rem,0.75fr)]">
          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">1. Korxona</label>
            <input
              type="text"
              list="qurulishKorxonalar"
              value={formData.korxonaNomi}
              onChange={(e) => handleInputChange("korxonaNomi", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="Tanlang yoki yozing"
            />
            <datalist id="qurulishKorxonalar">
              {qurulishKorxonalar.map(k => <option key={k} value={k} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">2. Texnika Soni</label>
            <input
              type="number"
              value={formData.texnikaSoni}
              onChange={(e) => handleInputChange("texnikaSoni", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0"
            />
          </div>

          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">3. Obyekt</label>
            <input
              type="text"
              list="obyektlar"
              value={formData.obyekt}
              onChange={(e) => handleInputChange("obyekt", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="Obyekt nomi"
            />
            <datalist id="obyektlar">
              {(limits?.obyektList?.[stationId] || limits?.obyektList?.default || []).map(o => <option key={o} value={o} />)}
            </datalist>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">4. Mas'ul shaxs</label>
            <input
              type="text"
              value={formData.masulShaxs}
              onChange={(e) => handleInputChange("masulShaxs", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="F.I.SH"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">5. Lavozimi</label>
            <input
              type="text"
              value={formData.lavozim}
              onChange={(e) => handleInputChange("lavozim", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="Lavozimi"
            />
          </div>

          <div className="space-y-1">
            <label className={`text-xs font-black uppercase tracking-widest ${limitInfo.isOverLimit ? "text-danger" : "text-primary"}`}>
              6. Qancha olindi (kg)
            </label>
            <input
              type="number"
              value={formData.qanchaOlindi}
              onChange={(e) => handleInputChange("qanchaOlindi", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">7. Dop Limit (ixtiyoriy)</label>
            <input
              type="number"
              value={formData.dopLimit}
              onChange={(e) => handleInputChange("dopLimit", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0"
            />
          </div>

          <div className="flex min-h-10 items-end gap-2">
            <div className={`w-full h-10 px-3 rounded-lg flex items-center font-black text-xs ${
              limitInfo.isOverLimit ? "bg-danger text-white" : "bg-primary/10 text-primary"
            }`}>
              Limit: {limitInfo.limit} kg
            </div>
            {limitInfo.isOverLimit && (
              <div className="text-danger font-black animate-pulse">
                +{limitInfo.oshiqMiqdor} kg oshiq
              </div>
            )}
          </div>
        </div>

        {/* Over Limit Fields */}
        {limitInfo.isOverLimit && (
          <div className="mt-3 pt-3 border-t border-danger/20 grid grid-cols-1 md:grid-cols-3 gap-2.5 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-1">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Buyruq №</label>
              <input
                type="text"
                value={formData.buyruqNumber}
                onChange={(e) => handleInputChange("buyruqNumber", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-white/95 border-2 border-danger/20 rounded-lg focus:outline-none focus:border-danger font-black text-sm sm:text-base text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Kim Tomonidan</label>
              <input
                type="text"
                list="buyruqEgalari"
                value={formData.kimTomonidan}
                onChange={(e) => handleInputChange("kimTomonidan", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-white/95 border-2 border-danger/20 rounded-lg focus:outline-none focus:border-danger font-black text-sm sm:text-base text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Vaqti</label>
              <input
                type="datetime-local"
                value={formData.buyruqVaqti}
                onChange={(e) => handleInputChange("buyruqVaqti", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-white/95 border-2 border-danger/20 rounded-lg focus:outline-none focus:border-danger font-black text-sm sm:text-base text-foreground"
              />
            </div>
          </div>
        )}

        {/* Mashina */}
        <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(14rem,0.75fr)_minmax(12rem,0.65fr)_minmax(16rem,0.9fr)] lg:items-end">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">Mashinada yetkazildimi?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleInputChange("mashinadaYetkazildi", true)}
                className={`flex-1 h-10 rounded-lg font-black transition-all border-2 ${
                  formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-white/95 border-muted-foreground/10"
                }`}
              >
                HA
              </button>
              <button
                type="button"
                onClick={() => handleInputChange("mashinadaYetkazildi", false)}
                className={`flex-1 h-10 rounded-lg font-black transition-all border-2 ${
                  !formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-white/95 border-muted-foreground/10"
                }`}
              >
                YO'Q
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {formData.mashinadaYetkazildi ? (
              <input
                type="text"
                list="mashinaRaqamlari"
                value={formData.mashinaRaqami}
                onChange={(e) => handleInputChange("mashinaRaqami", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
                placeholder="Mashina raqami"
              />
            ) : (
              <div className="hidden lg:block h-10" />
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={handleReset} className="h-10 flex-1 bg-black text-white rounded-lg font-black text-sm hover:opacity-90 transition-all uppercase">Tozalash</button>
            <button
              type="submit"
              disabled={loading || isSaveDisabled}
              className="h-10 flex-[1.5] bg-accent text-white rounded-lg font-black text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase shadow-lg shadow-accent/20"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Saqlash"}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 p-4 rounded-2xl text-danger font-bold">{error}</div>}
      {success && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-success text-white px-8 py-4 rounded-2xl font-black z-50">SAQLANDI ✓</div>}
    </form>
  );
}
