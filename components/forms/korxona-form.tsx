"use client";

import { useState, useMemo } from "react";
import { addSubmission } from "@/lib/firebase/submissions-service";
import { appendFuelRecordForErjuJu } from "@/lib/firebase/fuel-record-writer";
import { getSession } from "@/lib/utils/session";
import { savePendingSubmission } from "@/lib/offline/offline-storage";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface KorxonaFormProps {
  stationId: string;
  onSaved?: () => void;
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized || normalized === "." || normalized === ",") return NaN;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

const KORXONA_DEFAULT_NOMI = "Predpriyatie";

export default function KorxonaForm({ stationId, onSaved }: KorxonaFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    poyezdNumber: "",
    ruxsatIndeksi: "",
    qancha: "",
    nechaSutkalik: "1",
    mashinadaYetkazildi: false,
    mashinaRaqami: "",
  });

  const qanchaAmount = useMemo(() => parseDecimalInput(formData.qancha), [formData.qancha]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSaveDisabled = useMemo(() => {
    if (!formData.qancha || !Number.isFinite(qanchaAmount) || !formData.nechaSutkalik) return true;
    if (formData.mashinadaYetkazildi && !formData.mashinaRaqami) return true;
    return false;
  }, [formData, qanchaAmount]);

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

    if (!Number.isFinite(qanchaAmount)) {
      setError("Qancha (kg) maydoniga to'g'ri son kiriting. Masalan: 12,5");
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
        korxonaNomi: KORXONA_DEFAULT_NOMI,
        poyezdNumber: formData.poyezdNumber.trim() || undefined,
        ruxsatIndeksi: formData.ruxsatIndeksi.trim() || undefined,
        qancha: qanchaAmount,
        nechaSutkalik: Number(formData.nechaSutkalik),
        mashinadaYetkazildi: formData.mashinadaYetkazildi,
        mashinaRaqami: formData.mashinaRaqami || undefined,
      };

      if (navigator.onLine) {
        await addSubmission('korxona', submissionData);
        try {
          await appendFuelRecordForErjuJu("korxona", {
            stationId,
            staffCode: session.code,
            staffName: session.displayName,
            locoNumber: submissionData.poyezdNumber,
            fuelAmountKg: submissionData.qancha,
            trainIndex: submissionData.ruxsatIndeksi,
          });
        } catch (fe) {
          console.warn("fuelRecords (korxona) yozilmadi:", fe);
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
      poyezdNumber: "",
      ruxsatIndeksi: "",
      qancha: "",
      nechaSutkalik: "1",
      mashinadaYetkazildi: false,
      mashinaRaqami: "",
    });
    setError("");
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-2.5">
      <div className="p-3.5 sm:p-4 rounded-[22px] border-2 transition-all duration-500 shadow-lg backdrop-blur-md bg-background/70 border-primary/15">
        <h2 className="text-base sm:text-lg font-black mb-3 uppercase tracking-tight text-primary">
          Korxona uchun yoqilg'i berish
        </h2>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 lg:grid-cols-[minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(8rem,0.7fr)_minmax(8rem,0.65fr)_minmax(12rem,1fr)]">
          {/* Poyezd raqami */}
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">
              1. Poyezd raqami
            </label>
            <input
              type="text"
              value={formData.poyezdNumber}
              onChange={(e) => handleInputChange("poyezdNumber", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-background border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="3606"
            />
          </div>

          {/* Index */}
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">
              2. Index
            </label>
            <input
              type="text"
              value={formData.ruxsatIndeksi}
              onChange={(e) => handleInputChange("ruxsatIndeksi", e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-background border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="Index"
            />
          </div>

          {/* Qancha */}
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">
              3. Qancha (kg)
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              value={formData.qancha}
              onChange={(e) => handleInputChange("qancha", e.target.value.replace(/[^0-9.,]/g, ""))}
              onKeyDown={handleKeyDown}
              className="w-full h-10 px-3 bg-background border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="0 yoki 12,5"
            />
          </div>

          {/* Necha Sutkalik */}
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-widest text-primary">
              4. Necha Sutkalik
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
              className="w-full h-10 px-3 bg-background border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all"
              placeholder="1"
            />
          </div>

        </div>

        {/* Legacy disabled fields */}
        {false && (
          <div className="mt-3 pt-3 border-t border-danger/20 grid grid-cols-1 md:grid-cols-3 gap-2.5 animate-in slide-in-from-top-4 duration-500">
            <div className="space-y-1">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Buyruq №</label>
              <input
                type="text"
                value=""
                readOnly
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-background border-2 border-danger/20 rounded-lg focus:outline-none focus:border-danger font-black text-sm sm:text-base text-foreground"
                placeholder=""
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Kim Tomonidan</label>
              <input
                type="text"
                list="legacyList"
                value=""
                readOnly
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-background border-2 border-danger/20 rounded-lg focus:outline-none focus:border-danger font-black text-sm sm:text-base text-foreground"
                placeholder=""
              />
              <datalist id="legacyList">
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-danger uppercase tracking-widest">Vaqti</label>
              <input
                type="datetime-local"
                value=""
                readOnly
                onKeyDown={handleKeyDown}
                className="w-full h-10 px-3 bg-background border-2 border-danger/20 rounded-lg focus:outline-none focus:border-danger font-black text-sm sm:text-base text-foreground"
              />
            </div>
          </div>
        )}

        {/* Mashina */}
        <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(14rem,0.75fr)_minmax(12rem,0.65fr)_minmax(16rem,0.9fr)] lg:items-end">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-primary">
              Mashinada yetkazildimi?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleInputChange("mashinadaYetkazildi", true)}
                className={`flex-1 h-10 rounded-lg font-black transition-all border-2 ${
                  formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/10"
                }`}
              >
                HA
              </button>
              <button
                type="button"
                onClick={() => handleInputChange("mashinadaYetkazildi", false)}
                className={`flex-1 h-10 rounded-lg font-black transition-all border-2 ${
                  !formData.mashinadaYetkazildi ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/10"
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
                className="w-full h-10 px-3 bg-background border-2 border-primary/20 rounded-lg focus:border-primary focus:ring-4 focus:ring-primary/10 font-black text-sm sm:text-base text-foreground transition-all animate-in zoom-in-95"
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
