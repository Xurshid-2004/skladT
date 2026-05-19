"use client";

import { useState } from "react";
import { addSubmission } from "@/lib/firebase/submissions-service";
import { appendFuelRecordForErjuJu } from "@/lib/firebase/fuel-record-writer";
import { getSession } from "@/lib/utils/session";
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
        qanchaBerildi: Number(formData.qanchaBerildi),
        dizMasla: formData.dizMasla ? Number(formData.dizMasla) : undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-8 rounded-3xl border-2 border-primary/15 bg-background/70 shadow-xl backdrop-blur-md">
        <h2 className="text-2xl font-black text-primary mb-8 uppercase tracking-tighter">Teplovozlar ta'mirlash</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">1. Seriya</label>
            <select
              value={formData.seriya}
              onChange={(e) => handleInputChange("seriya", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all"
            >
              <option value="">Tanlang</option>
              {SERIYA_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">2. Raqami</label>
            <input
              type="text"
              value={formData.raqami}
              onChange={(e) => handleInputChange("raqami", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all"
              placeholder="0000"
            />
          </div>

          <div className="col-span-full space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">3. Ta'mirlash Turi</label>
            <div className="grid grid-cols-3 gap-3">
              {TAMIRLASH_TURI_LIST.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleInputChange("tamirlashTuri", t.value)}
                  className={`py-4 rounded-2xl font-black transition-all border-2 ${
                    formData.tamirlashTuri === t.value ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/10"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">4. Qancha Berildi (kg)</label>
            <input
              type="number"
              value={formData.qanchaBerildi}
              onChange={(e) => handleInputChange("qanchaBerildi", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">5. Diz Masla (kg)</label>
            <input
              type="number"
              value={formData.dizMasla}
              onChange={(e) => handleInputChange("dizMasla", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">6. Mas'ul shaxs</label>
            <input
              type="text"
              value={formData.masulShaxs}
              onChange={(e) => handleInputChange("masulShaxs", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all"
              placeholder="F.I.SH"
            />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-primary">Mashinada yetkazildimi?</label>
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
              onClick={() => { handleInputChange("mashinadaYetkazildi", false); handleInputChange("mashinaRaqami", ""); }}
              className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${
                !formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/10"
              }`}
            >
              YO'Q
            </button>
          </div>
          {formData.mashinadaYetkazildi && (
            <div className="space-y-2 mt-4">
              <label className="text-xs font-black uppercase tracking-widest text-primary">Mashina raqami</label>
              <input
                type="text"
                value={formData.mashinaRaqami}
                onChange={(e) => handleInputChange("mashinaRaqami", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-14 px-5 bg-background border-2 border-primary/20 rounded-2xl focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-foreground transition-all"
                placeholder="Masalan: 01 A 123 BC"
              />
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <button type="button" onClick={handleReset} className="flex-1 py-5 bg-muted rounded-2xl font-black uppercase">Tozalash</button>
          <button
            type="submit"
            disabled={loading || isSaveDisabled}
            className="flex-[2] py-5 bg-accent text-white rounded-2xl font-black text-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 uppercase shadow-xl shadow-accent/20"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Saqlash"}
          </button>
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/20 p-4 rounded-2xl text-danger font-bold">{error}</div>}
      {success && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-success text-white px-8 py-4 rounded-2xl font-black z-50">SAQLANDI ✓</div>}
    </form>
  );
}
