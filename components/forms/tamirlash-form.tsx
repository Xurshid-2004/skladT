"use client";

import { useState } from "react";
import { addSubmission } from "@/lib/firebase/submissions-service";
import { appendFuelRecordForErjuJu } from "@/lib/firebase/fuel-record-writer";
import { getSession } from "@/lib/utils/session";
import { parsePdfNumber } from "@/lib/utils/pdf-number";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { SERIYA_LIST, TAMIRLASH_TURI_LIST } from "@/lib/data/sections-config";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface TamirlashFormProps {
  stationId: string;
  onSaved?: () => void;
}

export default function TamirlashForm({ stationId, onSaved }: TamirlashFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    seriya: "",
    raqami: "",
    tamirlashTuri: "" as any,
    qanchaBerildi: "",
    dizMasla: "",
    masulShaxs: "",
    mashinadaYetkazildi: false,
    mashinaRaqami: "",
  });

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSaveDisabled = !formData.seriya || !formData.raqami || !formData.tamirlashTuri || !formData.qanchaBerildi || !formData.masulShaxs ||
    (formData.mashinadaYetkazildi && !formData.mashinaRaqami.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const session = getSession();
    if (!session) {
      setError("Sessiya muddati tugagan.");
      setLoading(false);
      return;
    }

    try {
      const submissionData = {
        staffCode: session.code,
        staffName: session.displayName,
        nodeId: session.nodeId!,
        stationId: stationId,
        category: 'tamirlash',
        seriya: formData.seriya,
        raqami: formData.raqami,
        tamirlashTuri: formData.tamirlashTuri,
        qanchaBerildi: parsePdfNumber(formData.qanchaBerildi),
        dizMasla: formData.dizMasla ? parsePdfNumber(formData.dizMasla) : undefined,
        masulShaxs: formData.masulShaxs,
        mashinadaYetkazildi: formData.mashinadaYetkazildi,
        mashinaRaqami: formData.mashinaRaqami || undefined,
      };

      if (navigator.onLine) {
        await addSubmission('tamirlash', submissionData);
        try {
          await appendFuelRecordForErjuJu('tamirlash', {
            stationId,
            staffCode: session.code,
            staffName: session.displayName,
            fuelAmountKg: submissionData.qanchaBerildi,
            dizMaslaKg: submissionData.dizMasla,
            locoSeries: submissionData.seriya,
            locoCode: String(submissionData.raqami),
            trainIndex: `${String(submissionData.tamirlashTuri)} · ${submissionData.masulShaxs}`,
          });
        } catch (fe) {
          console.warn("fuelRecords (tamirlash) yozilmadi:", fe);
        }
      } else {
        await savePendingSubmission(submissionData);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      handleReset();
      onSaved?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      tamirlashTuri: "",
      qanchaBerildi: "",
      dizMasla: "",
      masulShaxs: "",
      mashinadaYetkazildi: false,
      mashinaRaqami: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-2.5">
      <div className="p-3.5 sm:p-4 rounded-[22px] border-2 border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-rose-50 shadow-lg backdrop-blur-md">
        <h2 className="text-base sm:text-lg font-black text-primary mb-3 uppercase tracking-tight">Teplovozlar ta'mirlash</h2>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 xl:grid-cols-[minmax(8rem,0.7fr)_minmax(7rem,0.65fr)_minmax(19rem,1.25fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_minmax(12rem,1fr)]">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">1. Seriya</label>
            <select
              value={formData.seriya}
              onChange={(e) => handleInputChange("seriya", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
            >
              <option value="">Tanlang</option>
              {SERIYA_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">2. Raqami</label>
            <input
              type="text"
              value={formData.raqami}
              onChange={(e) => handleInputChange("raqami", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0000"
            />
          </div>

          <div className="space-y-1 md:col-span-3 xl:col-span-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">3. Ta'mirlash turi</label>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {TAMIRLASH_TURI_LIST.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleInputChange("tamirlashTuri", t.value)}
                  className={`h-10 rounded-lg border-2 px-2 text-xs sm:text-sm font-black transition-all ${
                    formData.tamirlashTuri === t.value ? "bg-primary border-primary text-white shadow-lg shadow-primary/20" : "bg-white/95 border-muted-foreground/10 text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">4. Qancha berildi (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.qanchaBerildi}
              onChange={(e) => handleInputChange("qanchaBerildi", e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">5. Diz masla (kg)</label>
            <input
              type="text"
              inputMode="decimal"
              value={formData.dizMasla}
              onChange={(e) => handleInputChange("dizMasla", e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0"
            />
          </div>

          <div className="space-y-1 md:col-span-2 xl:col-span-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">6. Mas'ul shaxs</label>
            <input
              type="text"
              value={formData.masulShaxs}
              onChange={(e) => handleInputChange("masulShaxs", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-white/95 border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="F.I.SH"
            />
          </div>
        </div>

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
                onClick={() => { handleInputChange("mashinadaYetkazildi", false); handleInputChange("mashinaRaqami", ""); }}
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
            <button
              type="button"
              onClick={handleReset}
              className="h-10 flex-1 bg-black text-white rounded-lg font-black text-sm hover:opacity-90 transition-all uppercase"
            >
              Tozalash
            </button>
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
