"use client";

import { useState, useMemo } from "react";
import { addSubmission } from "@/lib/firebase/submissions-service";
import { appendFuelRecordForErjuJu } from "@/lib/firebase/fuel-record-writer";
import { getSession } from "@/lib/utils/session";
import { parsePdfNumber } from "@/lib/utils/pdf-number";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { Loader2 } from "lucide-react";

interface QurulishFormProps {
  stationId: string;
  onSaved?: () => void;
}

export default function QurulishForm({ stationId, onSaved }: QurulishFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    seriya: "",
    raqami: "",
    poyezdNumber: "",
    ruxsatIndeksi: "",
    qoldiq: "",
    poyezdVazni: "",
    qanchaBerildi: "",
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSaveDisabled = useMemo(() => {
    return false;
  }, []);

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
      const qanchaBerildi = parsePdfNumber(formData.qanchaBerildi);
      const submissionData = {
        staffCode: session.code,
        staffName: session.displayName,
        nodeId: session.nodeId!,
        stationId,
        category: "qurulish",
        seriya: formData.seriya.trim(),
        raqami: formData.raqami.trim(),
        poyezdNumber: formData.poyezdNumber.trim(),
        ruxsatIndeksi: formData.ruxsatIndeksi.trim(),
        qoldiq: parsePdfNumber(formData.qoldiq),
        poyezdVazni: parsePdfNumber(formData.poyezdVazni),
        qanchaBerildi,
        qanchaOlindi: qanchaBerildi,
        mashinadaYetkazildi: false,
      };

      if (navigator.onLine) {
        await addSubmission("qurulish", submissionData);
        try {
          await appendFuelRecordForErjuJu("qurulish", {
            stationId,
            staffCode: session.code,
            staffName: session.displayName,
            locoSeries: submissionData.seriya,
            locoCode: submissionData.raqami,
            fuelAmountKg: submissionData.qanchaBerildi,
            balanceBeforeKg: submissionData.qoldiq,
            trainIndex: submissionData.ruxsatIndeksi,
            weight: String(submissionData.poyezdVazni),
          });
        } catch (fe) {
          console.warn("fuelRecords (qurulish) yozilmadi:", fe);
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
      seriya: "",
      raqami: "",
      poyezdNumber: "",
      ruxsatIndeksi: "",
      qoldiq: "",
      poyezdVazni: "",
      qanchaBerildi: "",
    });
    setError("");
  };

  const inputClass = "w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all";

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-2.5">
      <div className="p-3.5 sm:p-4 rounded-[22px] border-2 transition-all duration-500 shadow-lg backdrop-blur-md bg-gradient-to-br from-sky-50 via-white to-emerald-50 border-sky-200/70">
        <h2 className="text-base sm:text-lg font-black mb-3 uppercase tracking-tight text-primary">
          Qurilish ishlari uchun yoqilg'i
        </h2>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_minmax(10rem,0.9fr)_minmax(10rem,0.9fr)_minmax(9rem,0.75fr)_minmax(9rem,0.75fr)_minmax(9rem,0.75fr)_minmax(10rem,0.85fr)]">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">1. Seriya</label>
            <input
              type="text"
              value={formData.seriya}
              onChange={(e) => handleInputChange("seriya", e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="TEM2"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">2. Raqami</label>
            <input
              type="text"
              value={formData.raqami}
              onChange={(e) => handleInputChange("raqami", e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="1141"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">3. Stansya va P.raqami</label>
            <input
              type="text"
              value={formData.poyezdNumber}
              onChange={(e) => handleInputChange("poyezdNumber", e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="3606"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">4. Index</label>
            <input
              type="text"
              value={formData.ruxsatIndeksi}
              onChange={(e) => handleInputChange("ruxsatIndeksi", e.target.value)}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="Index"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">5. Bak qoldig'i (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.qoldiq}
              onChange={(e) => handleInputChange("qoldiq", e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">
              6. Berilgan yoqilg'i (kg)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.qanchaBerildi}
              onChange={(e) => handleInputChange("qanchaBerildi", e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">7. Poyezd vazni</label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.poyezdVazni}
              onChange={(e) => handleInputChange("poyezdVazni", e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={handleKeyDown}
              className={inputClass}
              placeholder="0"
            />
          </div>

        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={handleReset} className="h-10 min-w-32 bg-black text-white rounded-lg font-black text-sm hover:opacity-90 transition-all uppercase">Tozalash</button>
          <button
            type="submit"
            disabled={loading || isSaveDisabled}
            className="h-10 min-w-40 bg-accent text-white rounded-lg font-black text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase shadow-lg shadow-accent/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 p-4 rounded-2xl text-danger font-bold">{error}</div>}
      {success && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-success text-white px-8 py-4 rounded-2xl font-black z-50">SAQLANDI</div>}
    </form>
  );
}
