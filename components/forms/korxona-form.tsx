"use client";

import { useState, useEffect, useMemo } from "react";
import { subscribeToLimits, checkKorxonaLimit, LimitsSettings } from "@/lib/firebase/limits-service";
import { addSubmission } from "@/lib/firebase/submissions-service";
import { appendFuelRecordForErjuJu } from "@/lib/firebase/fuel-record-writer";
import { subscribeToActiveApprovals } from "@/lib/firebase/approval-service";
import { getSession } from "@/lib/utils/session";
import { notifyOverLimitEntry } from "@/lib/telegram/bot-service";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Approval } from "@/lib/types";

interface KorxonaFormProps {
  stationId: string;
  onSaved?: () => void;
}

export default function KorxonaForm({ stationId, onSaved }: KorxonaFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [limits, setLimits] = useState<LimitsSettings | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const [formData, setFormData] = useState({
    korxonaNomi: "",
    qancha: "",
    nechaSutkalik: "1",
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
    const info = checkKorxonaLimit(
      formData.korxonaNomi,
      Number(formData.qancha),
      Number(formData.nechaSutkalik),
      limits
    );

    // Check for existing approval
    const hasApproval = approvals.some(a => 
      a.requestType === 'korxona' && 
      a.korxonaNomi === formData.korxonaNomi &&
      a.isActive
    );

    if (hasApproval) {
      return { ...info, isOverLimit: false }; // Override limit if approved
    }

    return info;
  }, [formData.korxonaNomi, formData.qancha, formData.nechaSutkalik, limits, approvals]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSaveDisabled = useMemo(() => {
    if (!formData.korxonaNomi || !formData.qancha || !formData.nechaSutkalik) return true;
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
        category: 'korxona',
        korxonaNomi: formData.korxonaNomi,
        qancha: Number(formData.qancha),
        nechaSutkalik: Number(formData.nechaSutkalik),
        buyruqNumber: limitInfo.isOverLimit ? formData.buyruqNumber : undefined,
        kimTomonidan: limitInfo.isOverLimit ? formData.kimTomonidan : undefined,
        buyruqVaqti: limitInfo.isOverLimit ? new Date(formData.buyruqVaqti).getTime() : undefined,
        mashinadaYetkazildi: formData.mashinadaYetkazildi,
        mashinaRaqami: formData.mashinaRaqami || undefined,
        limit: limitInfo.limit,
        isOverLimit: limitInfo.isOverLimit,
        oshiqMiqdor: limitInfo.oshiqMiqdor,
      };

      if (navigator.onLine) {
        await addSubmission('korxona', submissionData);
        try {
          let ti = submissionData.korxonaNomi || "";
          if (submissionData.mashinadaYetkazildi && submissionData.mashinaRaqami)
            ti = ti ? `${ti} · M:${submissionData.mashinaRaqami}` : `M:${submissionData.mashinaRaqami}`;
          await appendFuelRecordForErjuJu("korxona", {
            stationId,
            staffCode: session.code,
            staffName: session.displayName,
            fuelAmountKg: submissionData.qancha,
            trainIndex: ti,
          });
        } catch (fe) {
          console.warn("fuelRecords (korxona) yozilmadi:", fe);
        }

        if (limitInfo.isOverLimit) {
          notifyOverLimitEntry(
            'korxona',
            session.displayName,
            stationId,
            Number(formData.qancha),
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

  const handleReset = () => {
    setFormData({
      korxonaNomi: "",
      qancha: "",
      nechaSutkalik: "1",
      buyruqNumber: "",
      kimTomonidan: "",
      buyruqVaqti: "",
      mashinadaYetkazildi: false,
      mashinaRaqami: "",
    });
    setError("");
  };

  const korxonalar = limits?.korxonaList?.[stationId] || limits?.korxonaList?.default || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`p-8 rounded-3xl border-2 transition-all duration-500 shadow-xl backdrop-blur-md ${
        limitInfo.isOverLimit ? "bg-danger/10 border-danger/30" : "bg-background/70 border-primary/15"
      }`}>
        <h2 className={`text-2xl font-black mb-8 uppercase tracking-tighter ${
          limitInfo.isOverLimit ? "text-danger" : "text-primary"
        }`}>
          Korxona uchun yoqilg'i berish
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Korxona Nomi */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest ${limitInfo.isOverLimit ? "text-danger" : "text-primary"}`}>
              1. Korxona Nomi
            </label>
            <input
              type="text"
              list="korxonalar"
              value={formData.korxonaNomi}
              onChange={(e) => handleInputChange("korxonaNomi", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-lg text-foreground transition-all"
              placeholder="Tanlang yoki yozing"
            />
            <datalist id="korxonalar">
              {korxonalar.map(k => <option key={k} value={k} />)}
            </datalist>
          </div>

          {/* Qancha */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest ${limitInfo.isOverLimit ? "text-danger" : "text-primary"}`}>
              2. Qancha (kg)
            </label>
            <input
              type="number"
              value={formData.qancha}
              onChange={(e) => handleInputChange("qancha", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-lg text-foreground transition-all"
              placeholder="0"
            />
          </div>

          {/* Necha Sutkalik */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-widest ${limitInfo.isOverLimit ? "text-danger" : "text-primary"}`}>
              3. Necha Sutkalik
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.nechaSutkalik}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, "");
                handleInputChange("nechaSutkalik", val);
              }}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-lg text-foreground transition-all"
              placeholder="1"
            />
          </div>

          {/* Limit Info */}
          <div className="flex items-center gap-3">
            <div className={`p-4 rounded-2xl font-bold text-sm ${
              limitInfo.isOverLimit ? "bg-danger text-white" : "bg-primary/10 text-primary"
            }`}>
              Limit: {limitInfo.limit} kg/sutka
            </div>
            {limitInfo.isOverLimit && (
              <div className="text-danger font-black animate-pulse">
                Limitdan oshgan: +{limitInfo.oshiqMiqdor} kg
              </div>
            )}
          </div>
        </div>

        {/* Over Limit Fields */}
        {limitInfo.isOverLimit && (
          <div className="mt-8 pt-8 border-t border-danger/20 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-2">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Buyruq №</label>
              <input
                type="text"
                value={formData.buyruqNumber}
                onChange={(e) => handleInputChange("buyruqNumber", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-14 px-5 bg-background border-2 border-danger/20 rounded-2xl focus:outline-none focus:border-danger font-bold"
                placeholder="Buyruq raqami"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Kim Tomonidan</label>
              <input
                type="text"
                list="buyruqEgalari"
                value={formData.kimTomonidan}
                onChange={(e) => handleInputChange("kimTomonidan", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-14 px-5 bg-background border-2 border-danger/20 rounded-2xl focus:outline-none focus:border-danger font-bold"
                placeholder="Ism sharif"
              />
              <datalist id="buyruqEgalari">
                {(limits?.buyruqEgalariList?.[stationId] || limits?.buyruqEgalariList?.default || []).map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Vaqti</label>
              <input
                type="datetime-local"
                value={formData.buyruqVaqti}
                onChange={(e) => handleInputChange("buyruqVaqti", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-14 px-5 bg-background border-2 border-danger/20 rounded-2xl focus:outline-none focus:border-danger font-bold"
              />
            </div>
          </div>
        )}

        {/* Mashina */}
        <div className="mt-8 space-y-4">
          <label className={`text-xs font-black uppercase tracking-widest ${limitInfo.isOverLimit ? "text-danger" : "text-primary"}`}>
            Mashinada yetkazildimi?
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => handleInputChange("mashinadaYetkazildi", true)}
              className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${
                formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/10"
              }`}
            >
              HA
            </button>
            <button
              type="button"
              onClick={() => handleInputChange("mashinadaYetkazildi", false)}
              className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${
                !formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/10"
              }`}
            >
              YO'Q
            </button>
          </div>
          {formData.mashinadaYetkazildi && (
            <input
              type="text"
              list="mashinaRaqamlari"
              value={formData.mashinaRaqami}
              onChange={(e) => handleInputChange("mashinaRaqami", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all animate-in zoom-in-95"
              placeholder="Mashina raqami"
            />
          )}
          <datalist id="mashinaRaqamlari">
            {(limits?.mashinaRaqamlari?.[stationId] || limits?.mashinaRaqamlari?.default || []).map(m => <option key={m} value={m} />)}
          </datalist>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 py-5 bg-muted rounded-2xl font-black text-lg hover:opacity-80 transition-all uppercase"
          >
            Tozalash
          </button>
          <button
            type="submit"
            disabled={loading || isSaveDisabled}
            className="flex-[2] py-5 bg-accent text-white rounded-2xl font-black text-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase shadow-xl shadow-accent/20"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 p-4 rounded-2xl flex items-center gap-3 text-danger font-bold animate-in shake">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-success text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-10">
          <CheckCircle2 className="w-6 h-6" />
          SAQLANDI ✓
        </div>
      )}
    </form>
  );
}
