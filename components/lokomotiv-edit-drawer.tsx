"use client";

import { useMemo, useState, useEffect } from "react";
import { Drawer } from "vaul";
import type { HarakatTuri, LokomotivSubmission } from "@/lib/types";
import { RUSUMI_LIST as STATIC_RUSUMI_LIST } from "@/lib/data/lokomotiv-config";
import {
  subscribeLokomotivRusumSettings,
  type LokomotivRusumSettings,
} from "@/lib/firebase/lokomotiv-rusum-service";
import { Loader2, X, Save, Train, CheckCircle2 } from "lucide-react";
import { updateSubmissionWithSummary } from "@/lib/firebase/submission-mutations";
import { parsePdfNumber } from "@/lib/utils/pdf-number";

const HARAKAT_LIST = [
  { value: "yuk",      label: "Yuk" },
  { value: "yolovchi", label: "Yo'lovchi" },
  { value: "manyovr",  label: "Manyovr" },
  { value: "xojalik",  label: "Xo'jalik" },
  { value: "ijara",    label: "Ijara" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  submission: LokomotivSubmission | null;
  onSaved: (updated: LokomotivSubmission) => void;
}

const inp = "w-full bg-[#0d160d] border border-[#2a3a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
const sel = "w-full bg-[#0d160d] border border-[#2a3a2a] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</label>
      {children}
    </div>
  );
}

export function LokomotivEditDrawer({ open, onClose, submission, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [form,   setForm]   = useState<Partial<LokomotivSubmission>>({});
  const [rusumSettings, setRusumSettings] = useState<LokomotivRusumSettings>({
    items: [],
    hiddenStaticValues: [],
  });

  useEffect(() => {
    if (submission) setForm({ ...submission });
    setSaved(false);
  }, [submission?.id]);

  useEffect(() => {
    if (!open) return;
    return subscribeLokomotivRusumSettings(setRusumSettings);
  }, [open]);

  function set(key: keyof LokomotivSubmission, value: any) {
    setForm(p => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    if (!submission) return;
    setSaving(true);
    try {
      const { id: _id, category: _c, staffCode: _sc, staffName: _sn,
              stationId: _sid, nodeId: _nid, timestamp: _ts, createdAt: _ca, ...editable } = form as any;
      const changes = {
        ...editable,
        poyezdVazni: editable.poyezdVazni === '' || editable.poyezdVazni == null ? undefined : parsePdfNumber(editable.poyezdVazni),
        qoldiq: parsePdfNumber(editable.qoldiq),
        qanchaBerildi: parsePdfNumber(editable.qanchaBerildi),
        dizMasla: parsePdfNumber(editable.dizMasla),
        isEdited: true,
        editedAt: Date.now(),
      };
      const updated = await updateSubmissionWithSummary(submission as any, changes);
      onSaved(updated as LokomotivSubmission);
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 900);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const f = form as any;
  const rusumiOptions = useMemo(() => {
    const hiddenStatic = new Set(rusumSettings.hiddenStaticValues.map((value) => value.toLowerCase()));
    const items = STATIC_RUSUMI_LIST
      .filter((item) => !hiddenStatic.has(String(item.value).toLowerCase()))
      .map((item) => ({
        value: String(item.value),
        label: item.label,
      }));
    const seen = new Set(items.map((item) => item.value.toLowerCase()));
    const harakat = f.harakatTuri as HarakatTuri | undefined;
    rusumSettings.items
      .filter((item) => !harakat || item.harakatTurlari.includes(harakat))
      .forEach((item) => {
        const key = item.value.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        items.push({ value: item.value, label: item.label });
      });
    return items;
  }, [rusumSettings, f.harakatTuri]);

  return (
    <Drawer.Root open={open} onOpenChange={v => { if (!v) onClose(); }} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Drawer.Content
          className="right-0 top-0 bottom-0 fixed z-50 outline-none w-full sm:w-[400px] flex"
          style={{ "--initial-transform": "calc(100% + 8px)" } as React.CSSProperties}
        >
          <div className="flex flex-col h-full w-full overflow-hidden" style={{ background: "#0d160d", borderLeft: "1.5px solid #2a3a2a" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b" style={{ borderColor: "#1f2f1f" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
                  <Train className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Drawer.Title className="text-white font-black text-base leading-tight">Tahrirlash</Drawer.Title>
                  <Drawer.Description className="text-gray-500 text-[11px] mt-0.5">
                    ID: ...{submission?.id.slice(-8)}
                  </Drawer.Description>
                </div>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

              {/* Harakat turi */}
              <Field label="Harakat turi">
                <div className="grid grid-cols-2 gap-2">
                  {HARAKAT_LIST.map(h => (
                    <button
                      key={h.value}
                      type="button"
                      onClick={() => set("harakatTuri", h.value)}
                      className={`py-2.5 rounded-xl font-black text-xs uppercase transition-all border ${
                        f.harakatTuri === h.value
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                          : "bg-transparent border-[#2a3a2a] text-gray-400 hover:border-primary/40 hover:text-white"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Rusumi */}
              <Field label="Rusumi">
                <div className="grid grid-cols-3 gap-2">
                  {rusumiOptions.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => set("rusumi", r.value)}
                      className={`py-2 rounded-xl font-bold text-[11px] transition-all border ${
                        f.rusumi === r.value
                          ? "bg-primary border-primary text-white"
                          : "bg-transparent border-[#2a3a2a] text-gray-400 hover:border-primary/40 hover:text-white"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Lokomotiv raqami */}
              <Field label="Lokomotiv raqami">
                <input className={inp} value={f.lokomotivNumber ?? ""} onChange={e => set("lokomotivNumber", e.target.value)} />
              </Field>

              {/* Poyezd raqami */}
              <Field label="Poyezd raqami">
                <input className={inp} value={f.poyezdNumber ?? ""} onChange={e => set("poyezdNumber", e.target.value)} />
              </Field>

              {/* Ruxsat indeksi */}
              <Field label="Ruxsat indeksi">
                <input className={inp} value={f.ruxsatIndeksi ?? ""} onChange={e => set("ruxsatIndeksi", e.target.value)} />
              </Field>

              {/* Poyezd vazni */}
              <Field label="Poyezd vazni (tonna)">
                <input className={inp} type="text" inputMode="decimal" value={f.poyezdVazni ?? ""} onChange={e => set("poyezdVazni", e.target.value.replace(/[^0-9.,]/g, ""))} />
              </Field>

              {/* Manyovr → stansiya */}
              {f.harakatTuri === "manyovr" && (
                <Field label="Stansiya">
                  <input className={inp} value={f.stansiya ?? ""} onChange={e => set("stansiya", e.target.value)} />
                </Field>
              )}
              {f.harakatTuri === "xojalik" && (
                <Field label="Tashkilot">
                  <input className={inp} value={f.tashkilot ?? ""} onChange={e => set("tashkilot", e.target.value)} />
                </Field>
              )}
              {f.harakatTuri === "ijara" && (
                <Field label="Ijarachi">
                  <input className={inp} value={f.ijarachi ?? ""} onChange={e => set("ijarachi", e.target.value)} />
                </Field>
              )}

              {/* Miqdorlar */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Qoldiq (kg)">
                  <input className={inp} type="text" inputMode="decimal" value={f.qoldiq ?? ""} onChange={e => set("qoldiq", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Field>
                <Field label="Berildi (kg)">
                  <input className={inp} type="text" inputMode="decimal" value={f.qanchaBerildi ?? ""} onChange={e => set("qanchaBerildi", e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Field>
              </div>

              <Field label="Diz. masla (kg)">
                <input className={inp} type="text" inputMode="decimal" value={f.dizMasla ?? ""} onChange={e => set("dizMasla", e.target.value.replace(/[^0-9.,]/g, ""))} />
              </Field>

              {/* Olib borish */}
              <Field label="Mashinada yetkazildimi?">
                <div className="grid grid-cols-2 gap-3">
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => set("mashinadaYetkazildi", val)}
                      className={`py-3 rounded-xl font-black text-sm uppercase transition-all border ${
                        f.mashinadaYetkazildi === val
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                          : "bg-transparent border-[#2a3a2a] text-gray-400 hover:border-primary/40"
                      }`}
                    >
                      {val ? "HA" : "YO'Q"}
                    </button>
                  ))}
                </div>
              </Field>

              {f.mashinadaYetkazildi && (
                <Field label="Mashina raqami">
                  <input className={inp} value={f.mashinaRaqami ?? ""} onChange={e => set("mashinaRaqami", e.target.value)} />
                </Field>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 shrink-0 border-t" style={{ borderColor: "#1f2f1f" }}>
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm uppercase transition-all ${
                  saved
                    ? "bg-emerald-600 text-white"
                    : "bg-primary hover:bg-primary/90 active:scale-95 text-white disabled:opacity-50"
                }`}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saqlanmoqda...</>
                ) : saved ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saqlandi!</>
                ) : (
                  <><Save className="w-4 h-4" /> Saqlash</>
                )}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
