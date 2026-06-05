"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ERJU_STAFF_GROUPS } from "@/lib/data/staff-erju-data";
import {
  subscribeStaff,
  addStaffDoc,
  updateStaffDoc,
  deleteStaffDoc,
} from "@/lib/firebase/staff-service";
import {
  addLokomotivRusum,
  deleteLokomotivRusum,
  deleteStaticLokomotivRusum,
  subscribeLokomotivRusumSettings,
  type CustomLokomotivRusum,
  type LokomotivRusumSettings,
  updateLokomotivRusum,
  updateStaticLokomotivRusum,
} from "@/lib/firebase/lokomotiv-rusum-service";
import {
  HARAKAT_TURI_LIST,
  RUSUMI_FILTER,
  RUSUMI_LIST,
} from "@/lib/data/lokomotiv-config";
import { getSession } from "@/lib/utils/session";
import type { HarakatTuri, StaffVaultRecord } from "@/lib/types";
import {
  X,
  Pencil,
  Trash2,
  ShieldBan,
  ShieldCheck,
  ChevronRight,
  Users,
  PlusCircle,
  TrainFront,
  CheckCircle2,
} from "lucide-react";

export type StaffVaultModalProps = {
  open: boolean;
  onClose: () => void;
  rusumOpenRequest?: number;
  blockedCodes: Set<string>;
  /** Tabel raqam = kirish kodi sifatida blocked_codes ga yoziladi */
  onBlockByTabel: (tabel: string, note: string) => Promise<void>;
  onUnblockByTabel: (tabel: string) => Promise<void>;
};

/** ERJU tugmalari — kirill matn va admin sidebar ranglari */
const ERJU_REGION_UI: Record<
  string,
  { labelCy: string; active: string; idle: string }
> = {
  "Toshkent ERJU": {
    labelCy: "ТОШКЕНТ ЕРЖУ",
    active: "bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.6)] ring-2 ring-white/45",
    idle: "bg-blue-600/45 border-2 border-blue-400/60",
  },
  "Buxoro ERJU": {
    labelCy: "БУХОРО ЕРЖУ",
    active: "bg-emerald-500 shadow-[0_0_18px_rgba(34,197,94,0.6)] ring-2 ring-white/45",
    idle: "bg-emerald-600/45 border-2 border-emerald-400/60",
  },
  "Qarshi ERJU": {
    labelCy: "ҚАРШИ ЕРЖУ",
    active: "bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.6)] ring-2 ring-white/45",
    idle: "bg-sky-600/45 border-2 border-sky-400/60",
  },
  "Qo'qon ERJU": {
    labelCy: "ҚОҚОН ЕРЖУ",
    active:
      "bg-gradient-to-r from-blue-600 to-violet-600 shadow-[0_0_18px_rgba(99,102,241,0.55)] ring-2 ring-white/45",
    idle: "border-2 border-violet-400/60 bg-gradient-to-r from-blue-700/50 to-violet-700/50",
  },
  "Termiz ERJU": {
    labelCy: "ТЕРМИЗ ЕРЖУ",
    active: "bg-orange-500 shadow-[0_0_18px_rgba(249,115,22,0.6)] ring-2 ring-white/45",
    idle: "bg-orange-600/45 border-2 border-orange-400/60",
  },
  "Qo'ng'irot ERJU": {
    labelCy: "ҚУНГИРОТ ЕРЖУ",
    active: "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.6)] ring-2 ring-white/45",
    idle: "bg-red-600/45 border-2 border-red-400/60",
  },
};

const HARAKAT_RUSUM_LABEL: Record<HarakatTuri, string> = {
  yuk: "\u042e\u041a",
  manyovr: "\u041c\u0410\u041d\u0401\u0412\u0420",
  yolovchi: "\u0419\u040e\u041b\u041e\u0412\u0427\u0418",
  xojalik: "\u0425\u040e\u0416\u0410\u041b\u0418\u041a",
  ijara: "\u0418\u0416\u0410\u0420\u0410",
};

const HARAKAT_RUSUM_CARD: Record<HarakatTuri, string> = {
  yuk: "bg-blue-700 border-blue-800 shadow-blue-900/25",
  manyovr: "bg-orange-600 border-orange-700 shadow-orange-900/25",
  yolovchi: "bg-red-500 border-red-700 shadow-red-900/25",
  xojalik: "bg-emerald-600 border-emerald-700 shadow-emerald-900/25",
  ijara: "bg-violet-700 border-violet-800 shadow-violet-900/25",
};

function normalizeLoginCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function staticRusumEditId(value: string): string {
  return `static:${value}`;
}

function isStaticRusumEditId(value: string | null): value is string {
  return !!value && value.startsWith("static:");
}

function staticValueFromEditId(value: string): string {
  return value.slice("static:".length);
}

export default function StaffVaultModal({
  open,
  onClose,
  rusumOpenRequest = 0,
  blockedCodes,
  onBlockByTabel,
  onUnblockByTabel,
}: StaffVaultModalProps) {
  const [staffList, setStaffList] = useState<StaffVaultRecord[]>([]);
  const [selectedErju, setSelectedErju] = useState("");
  const [selectedZapravka, setSelectedZapravka] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffTabel, setNewStaffTabel] = useState("");
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editStaff, setEditStaff] = useState({
    name: "",
    tabel: "",
    zapravka: "",
  });
  const [busy, setBusy] = useState(false);
  const [rusumModalOpen, setRusumModalOpen] = useState(false);
  const [rusumSettings, setRusumSettings] = useState<LokomotivRusumSettings>({
    items: [],
    hiddenStaticValues: [],
  });
  const [newRusumName, setNewRusumName] = useState("");
  const [newRusumCode, setNewRusumCode] = useState("");
  const [newRusumHarakat, setNewRusumHarakat] = useState<HarakatTuri[]>([]);
  const [editingRusumId, setEditingRusumId] = useState<string | null>(null);
  const [editRusumName, setEditRusumName] = useState("");
  const [editRusumCode, setEditRusumCode] = useState("");
  const [editRusumHarakat, setEditRusumHarakat] = useState<HarakatTuri[]>([]);
  const [rusumBusy, setRusumBusy] = useState(false);
  const [rusumError, setRusumError] = useState("");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    return subscribeStaff(setStaffList);
  }, [open]);

  useEffect(() => {
    if (!open || !rusumOpenRequest) return;
    setRusumModalOpen(true);
  }, [open, rusumOpenRequest]);

  useEffect(() => {
    if (!open) return;
    return subscribeLokomotivRusumSettings(setRusumSettings);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const selectedErjuData = useMemo(
    () => ERJU_STAFF_GROUPS.find((e) => e.name === selectedErju),
    [selectedErju],
  );

  const erjuAllStaff = useMemo(() => {
    return staffList.filter((s) => s.erju === selectedErju);
  }, [staffList, selectedErju]);

  const customRusumlar = rusumSettings.items;

  const staticRusumlar = useMemo(() => {
    const hiddenStatic = new Set(rusumSettings.hiddenStaticValues.map((value) => value.toLowerCase()));
    return RUSUMI_LIST
      .filter((rusum) => !hiddenStatic.has(String(rusum.value).toLowerCase()))
      .map((rusum) => ({
        value: String(rusum.value),
        label: rusum.label,
        code: String(rusum.number),
        harakatTurlari: HARAKAT_TURI_LIST
          .map((item) => item.value as HarakatTuri)
          .filter((harakat) => RUSUMI_FILTER[harakat].includes(rusum.value)),
      }));
  }, [rusumSettings.hiddenStaticValues]);

  const closeModal = () => {
    onClose();
    setSelectedErju("");
    setSelectedZapravka("");
    setNewStaffName("");
    setNewStaffTabel("");
    setEditingStaffId(null);
    setRusumModalOpen(false);
    setNewRusumName("");
    setNewRusumCode("");
    setNewRusumHarakat([]);
    setEditingRusumId(null);
    setEditRusumName("");
    setEditRusumCode("");
    setEditRusumHarakat([]);
    setRusumError("");
  };

  const handleErjuSelect = (name: string) => {
    setSelectedErju(name);
    setSelectedZapravka("");
    setNewStaffName("");
    setNewStaffTabel("");
    setEditingStaffId(null);
  };

  const addStaff = async () => {
    if (
      !selectedErju ||
      !selectedZapravka ||
      !newStaffName.trim() ||
      !newStaffTabel.trim()
    )
      return;

    const tabel = newStaffTabel.trim();
    if (tabel.length !== 4) {
      window.alert("Xodim paroli 4 ta raqamdan iborat bo'lishi kerak.");
      return;
    }
    const duplicate = staffList.find((s) => s.tabelNumber === tabel);
    if (duplicate) {
      window.alert("Bu tabel raqam allaqachon mavjud!");
      return;
    }

    setBusy(true);
    try {
      await addStaffDoc({
        erju: selectedErju,
        zapravka: selectedZapravka,
        tabelNumber: tabel,
        fullName: newStaffName.trim(),
      });
      setNewStaffName("");
      setNewStaffTabel("");
    } finally {
      setBusy(false);
    }
  };

  const startEditStaff = (staff: StaffVaultRecord) => {
    setEditingStaffId(staff.id);
    setEditStaff({
      name: staff.fullName,
      tabel: staff.tabelNumber,
      zapravka: staff.zapravka,
    });
  };

  const cancelEdit = () => {
    setEditingStaffId(null);
  };

  const saveStaffEdit = async () => {
    if (!editStaff.name.trim() || !editStaff.tabel.trim() || !editingStaffId)
      return;

    const tabel = editStaff.tabel.trim();
    if (tabel.length !== 4) {
      window.alert("Xodim paroli 4 ta raqamdan iborat bo'lishi kerak.");
      return;
    }
    const duplicate = staffList.find(
      (s) => s.tabelNumber === tabel && s.id !== editingStaffId,
    );
    if (duplicate) {
      window.alert("Bu tabel raqam allaqachon boshqa xodimda bor!");
      return;
    }

    setBusy(true);
    try {
      await updateStaffDoc(editingStaffId, {
        fullName: editStaff.name.trim(),
        tabelNumber: tabel,
        zapravka: editStaff.zapravka,
      });
      setEditingStaffId(null);
    } finally {
      setBusy(false);
    }
  };

  const deleteStaff = async (staffId: string) => {
    setBusy(true);
    try {
      await deleteStaffDoc(staffId);
      if (editingStaffId === staffId) setEditingStaffId(null);
    } finally {
      setBusy(false);
    }
  };

  const handleBlockStaff = async (staff: StaffVaultRecord) => {
    const t = staff.tabelNumber.trim();
    if (!t) return;
    if (blockedCodes.has(t)) return;
    if (!confirm(`${t} tabel bloklansinmi? (${staff.fullName})`)) return;
    setBusy(true);
    try {
      await onBlockByTabel(
        t,
        `Xodim: ${staff.fullName} · ${staff.erju} · ${staff.zapravka}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUnblockStaff = async (staff: StaffVaultRecord) => {
    const t = staff.tabelNumber.trim();
    if (!blockedCodes.has(t)) return;
    if (!confirm(`${t} tabel blokdan chiqarilsinmi?`)) return;
    setBusy(true);
    try {
      await onUnblockByTabel(t);
    } finally {
      setBusy(false);
    }
  };

  const toggleRusumHarakat = (value: HarakatTuri) => {
    setNewRusumHarakat((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
    setRusumError("");
  };

  const toggleEditRusumHarakat = (value: HarakatTuri) => {
    setEditRusumHarakat((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
    setRusumError("");
  };

  const saveRusum = async () => {
    const label = newRusumName.trim();
    const code = newRusumCode.trim();
    if (!label) {
      setRusumError("Rusum nomini kiriting.");
      return;
    }
    if (!code) {
      setRusumError("Rusum raqamini kiriting.");
      return;
    }
    if (newRusumHarakat.length === 0) {
      setRusumError("Kamida bitta harakat turini tanlang.");
      return;
    }

    setRusumBusy(true);
    setRusumError("");
    try {
      const session = getSession();
      await addLokomotivRusum({
        label,
        code,
        harakatTurlari: newRusumHarakat,
        createdBy: session?.displayName ?? "Admin",
      });
      setNewRusumName("");
      setNewRusumCode("");
      setNewRusumHarakat([]);
    } catch (err: any) {
      setRusumError(err?.message || "Rusumni saqlab bo'lmadi.");
    } finally {
      setRusumBusy(false);
    }
  };

  const startEditRusum = (rusum: CustomLokomotivRusum) => {
    setEditingRusumId(rusum.id);
    setEditRusumName(rusum.label);
    setEditRusumCode(rusum.code ?? "");
    setEditRusumHarakat(rusum.harakatTurlari);
    setRusumError("");
  };

  const startEditStaticRusum = (rusum: { value: string; label: string; code: string; harakatTurlari: HarakatTuri[] }) => {
    setEditingRusumId(staticRusumEditId(rusum.value));
    setEditRusumName(rusum.label);
    setEditRusumCode(rusum.code);
    setEditRusumHarakat(rusum.harakatTurlari);
    setRusumError("");
  };

  const cancelRusumEdit = () => {
    setEditingRusumId(null);
    setEditRusumName("");
    setEditRusumCode("");
    setEditRusumHarakat([]);
    setRusumError("");
  };

  const saveRusumEdit = async () => {
    if (!editingRusumId) return;
    const label = editRusumName.trim();
    const code = editRusumCode.trim();
    if (!label) {
      setRusumError("Rusum nomini kiriting.");
      return;
    }
    if (!code) {
      setRusumError("Rusum raqamini kiriting.");
      return;
    }
    if (editRusumHarakat.length === 0) {
      setRusumError("Kamida bitta harakat turini tanlang.");
      return;
    }

    setRusumBusy(true);
    setRusumError("");
    try {
      if (isStaticRusumEditId(editingRusumId)) {
        const session = getSession();
        await updateStaticLokomotivRusum({
          originalValue: staticValueFromEditId(editingRusumId),
          label,
          code,
          harakatTurlari: editRusumHarakat,
          createdBy: session?.displayName ?? "Admin",
        });
      } else {
        await updateLokomotivRusum(editingRusumId, {
          label,
          code,
          harakatTurlari: editRusumHarakat,
        });
      }
      cancelRusumEdit();
    } catch (err: any) {
      setRusumError(err?.message || "Rusumni tahrirlab bo'lmadi.");
    } finally {
      setRusumBusy(false);
    }
  };

  const deleteStaticRusum = async (rusum: { value: string; label: string }) => {
    if (!confirm(`${rusum.label} asosiy rusumi user paneldan o'chirilsinmi?`)) return;
    setRusumBusy(true);
    setRusumError("");
    try {
      await deleteStaticLokomotivRusum(rusum.value);
      if (editingRusumId === staticRusumEditId(rusum.value)) cancelRusumEdit();
    } catch (err: any) {
      setRusumError(err?.message || "Rusumni o'chirib bo'lmadi.");
    } finally {
      setRusumBusy(false);
    }
  };

  const deleteRusum = async (rusum: CustomLokomotivRusum) => {
    if (!confirm(`${rusum.label} rusumi o'chirilsinmi?`)) return;
    setRusumBusy(true);
    setRusumError("");
    try {
      await deleteLokomotivRusum(rusum.id);
      if (editingRusumId === rusum.id) cancelRusumEdit();
    } catch (err: any) {
      setRusumError(err?.message || "Rusumni o'chirib bo'lmadi.");
    } finally {
      setRusumBusy(false);
    }
  };

  if (!open || !portalReady) return null;

  return createPortal(
    <div className="staff-vault-modal fixed inset-0 z-[500] flex flex-col">
      <button
        type="button"
        aria-label="Yopish"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={closeModal}
      />

      <div className="relative z-[501] flex h-full w-full flex-col overflow-hidden bg-[#0d1424]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0f1e] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Xodimlarni boshqarish</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              ERJU va zapravka tanlang. Tabel raqam — kirish kodi bilan bir xil bo&apos;lsa, bloklash
              shu raqam bo&apos;yicha ishlaydi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRusumModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Rusum qo&apos;shish</span>
              <span className="sm:hidden">Rusum</span>
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-full border border-red-400/30 bg-red-500/80 p-2 text-white transition-all hover:bg-red-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* CHAP: ERJU — scroll yo‘q, tugmalar balandlikka taqsimlanadi */}
          <div className="flex w-full shrink-0 flex-col overflow-hidden border-white/10 p-3 md:h-full md:w-[min(18rem,22vw)] md:border-r md:p-4">
            <p className="shrink-0 px-2 pb-2 text-[11px] font-black uppercase tracking-widest text-slate-300">
              МИНТАҚАЛАР
            </p>
            <div className="staff-vault-erju-list flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden md:gap-2">
            {ERJU_STAFF_GROUPS.map((erju) => {
              const cnt = staffList.filter((s) => s.erju === erju.name).length;
              const isActive = selectedErju === erju.name;
              const ui = ERJU_REGION_UI[erju.name];
              return (
                <button
                  key={erju.name}
                  type="button"
                  onClick={() => handleErjuSelect(erju.name)}
                  className={`flex min-h-0 flex-1 w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-white transition-all md:py-2.5 ${
                    isActive ? ui?.active ?? "bg-blue-500" : ui?.idle ?? "bg-white/10"
                  } ${isActive ? "scale-[1.01]" : "opacity-95"}`}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-black uppercase leading-tight tracking-tight drop-shadow-sm">
                      {ui?.labelCy ?? erju.short}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-white/90">
                      {cnt} ходим
                    </p>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-white/70"}`}
                  />
                </button>
              );
            })}
            </div>
          </div>

          {/* O'RTA: zapravka + forma */}
          <div className="w-full shrink-0 space-y-4 overflow-y-auto border-white/10 p-5 md:w-[min(22rem,26vw)] md:border-r">
            {!selectedErju && (
              <p className="pt-6 text-center text-sm text-slate-400">ERJU tanlang</p>
            )}
            {selectedErju && (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Zapravka
                  </p>
                  <select
                    value={selectedZapravka}
                    onChange={(e) => setSelectedZapravka(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0d1424] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">Tanlang...</option>
                    {selectedErjuData?.zapravkalar.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedZapravka && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Yangi xodim
                    </p>
                    <div>
                      <label className="ml-1 text-[10px] font-bold uppercase text-slate-400">
                        Parol/kod (4 raqam)
                      </label>
                      <input
                        value={newStaffTabel}
                        onChange={(e) => setNewStaffTabel(normalizeLoginCode(e.target.value))}
                        inputMode="numeric"
                        maxLength={4}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addStaff();
                          }
                        }}
                        placeholder="1234"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1424] px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="ml-1 text-[10px] font-bold uppercase text-slate-400">
                        F.I.Sh
                      </label>
                      <input
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addStaff();
                          }
                        }}
                        placeholder="Ism Familya"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1424] px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void addStaff()}
                      disabled={
                        busy || !newStaffName.trim() || !newStaffTabel.trim()
                      }
                      className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Saqlash
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* O'NG: ro'yxat */}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5 md:min-h-0">
            {!selectedErju && (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-12 opacity-40">
                <Users className="h-10 w-10 text-slate-500" />
                <p className="text-sm text-slate-400">
                  ERJU tanlang — xodimlar ro&apos;yxati chiqadi
                </p>
              </div>
            )}
            {selectedErju && (
              <>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {selectedErju} — {erjuAllStaff.length} ta xodim
                </p>
                {erjuAllStaff.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    Hozircha xodim yo&apos;q
                  </p>
                )}
                <div className="space-y-2">
                  {erjuAllStaff.map((staff, i) => (
                    <div
                      key={staff.id}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5"
                    >
                      {editingStaffId === staff.id ? (
                        <div className="space-y-2">
                          <select
                            value={editStaff.zapravka}
                            onChange={(e) =>
                              setEditStaff((p) => ({ ...p, zapravka: e.target.value }))
                            }
                            className="w-full rounded-lg border border-white/10 bg-[#0d1424] px-2 py-1.5 text-xs text-white"
                          >
                            {selectedErjuData?.zapravkalar.map((z) => (
                              <option key={z} value={z}>
                                {z}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input
                              value={editStaff.tabel}
                              onChange={(e) =>
                                setEditStaff((p) => ({
                                  ...p,
                                  tabel: normalizeLoginCode(e.target.value),
                                }))
                              }
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="Tabel"
                              className="w-24 rounded-lg border border-white/10 bg-[#0d1424] px-2 py-1.5 text-xs text-white"
                            />
                            <input
                              value={editStaff.name}
                              onChange={(e) =>
                                setEditStaff((p) => ({ ...p, name: e.target.value }))
                              }
                              placeholder="F.I.Sh"
                              className="flex-1 rounded-lg border border-white/10 bg-[#0d1424] px-2 py-1.5 text-xs text-white"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveStaffEdit()}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Saqlash
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-slate-300"
                            >
                              Bekor
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="w-5 font-mono text-xs text-slate-600">{i + 1}</span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="break-words text-sm font-semibold text-white">
                                  {staff.fullName}
                                </span>
                                <span className="rounded-full bg-blue-600/30 px-2 py-0.5 font-mono text-[10px] text-blue-300">
                                  #{staff.tabelNumber}
                                </span>
                                {blockedCodes.has(staff.tabelNumber.trim()) && (
                                  <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[9px] font-black uppercase text-red-300">
                                    Bloklangan
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[10px] text-slate-500">{staff.zapravka}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 sm:shrink-0">
                            {blockedCodes.has(staff.tabelNumber.trim()) ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleUnblockStaff(staff)}
                                title="Blokdan chiqarish"
                                className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-50"
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleBlockStaff(staff)}
                                title="Bloklash"
                                className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-400/10 disabled:opacity-50"
                              >
                                <ShieldBan className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startEditStaff(staff)}
                              className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-400/10"
                              title="Tahrirlash"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void deleteStaff(staff.id)}
                              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                              title="O'chirish"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {rusumModalOpen && (
          <div className="absolute inset-0 z-[520] flex items-center justify-center bg-slate-950/78 p-3 backdrop-blur-sm sm:p-5">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-slate-950 via-[#082f49] to-[#064e3b] shadow-2xl shadow-cyan-950/50">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cyan-300/25 bg-gradient-to-r from-cyan-700 via-emerald-600 to-blue-700 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-lg shadow-emerald-950/25">
                    <TrainFront className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black uppercase tracking-wide text-white">
                      Rusum qo&apos;shish
                    </h3>
                    <p className="truncate text-[11px] font-semibold text-cyan-50/85">
                      Rusum tanlangan harakat turlarida user panelda chiqadi
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRusumModalOpen(false);
                    cancelRusumEdit();
                    setRusumError("");
                  }}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-950/25 hover:bg-red-600"
                  aria-label="Yopish"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                  <div className="space-y-4 rounded-2xl border border-cyan-300/20 bg-white/10 p-4 shadow-xl shadow-black/15">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-cyan-100">
                          Rusum nomi
                        </label>
                        <input
                          value={newRusumName}
                          onChange={(e) => {
                            setNewRusumName(e.target.value);
                            setRusumError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveRusum();
                            }
                          }}
                          placeholder="Masalan: TEM18"
                          className="h-12 w-full rounded-xl border-2 border-cyan-200/45 bg-white px-3.5 text-base font-black uppercase text-slate-950 shadow-lg shadow-cyan-950/10 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-300/35"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-cyan-100">
                          Rusum raqami
                        </label>
                        <input
                          value={newRusumCode}
                          inputMode="numeric"
                          onChange={(e) => {
                            setNewRusumCode(e.target.value.replace(/\D/g, ""));
                            setRusumError("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveRusum();
                            }
                          }}
                          placeholder="Masalan: 77"
                          className="h-12 w-full rounded-xl border-2 border-emerald-200/55 bg-white px-3.5 text-base font-black text-slate-950 shadow-lg shadow-emerald-950/10 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-4 focus:ring-cyan-300/35"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-100">
                        Harakat turi
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                        {HARAKAT_TURI_LIST.map((item) => {
                          const value = item.value as HarakatTuri;
                          const active = newRusumHarakat.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleRusumHarakat(value)}
                              className={`relative flex min-h-[82px] flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-2 py-2 text-white shadow-lg transition-none ${
                                HARAKAT_RUSUM_CARD[value]
                              } ${active ? "ring-2 ring-white ring-offset-2 ring-offset-black" : ""}`}
                            >
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-base font-black text-white ring-1 ring-white/25">
                                {item.number}
                              </span>
                              <span className="text-center text-[11px] font-black uppercase leading-none tracking-wide text-white sm:text-[12px]">
                                {HARAKAT_RUSUM_LABEL[value]}
                              </span>
                              {active && (
                                <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-black shadow-sm">
                                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {rusumError && (
                      <p className="rounded-xl border border-red-200/60 bg-red-500 px-3 py-2 text-xs font-black text-white shadow-lg shadow-red-950/20">
                        {rusumError}
                      </p>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => void saveRusum()}
                        disabled={rusumBusy}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 text-sm font-black uppercase text-white shadow-lg shadow-emerald-950/25 hover:from-emerald-400 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <PlusCircle className="h-4 w-4" />
                        Saqlash
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewRusumName("");
                          setNewRusumCode("");
                          setNewRusumHarakat([]);
                          setRusumError("");
                        }}
                        className="h-11 rounded-xl border border-white/30 bg-white/15 px-5 text-sm font-black text-white hover:bg-white/25"
                      >
                        Tozalash
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 space-y-3 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-3 shadow-xl shadow-black/20">
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-100">
                        Hozirgi rusumlar
                      </p>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {staticRusumlar.map((rusum) => {
                          const editing = editingRusumId === staticRusumEditId(rusum.value);
                          return (
                            <div
                              key={rusum.value}
                              className="rounded-xl border border-cyan-300/20 bg-white/[0.10] px-3 py-2 shadow-sm shadow-black/10"
                            >
                              {editing ? (
                                  <div className="space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                                      <input
                                        value={editRusumName}
                                        onChange={(e) => {
                                          setEditRusumName(e.target.value);
                                          setRusumError("");
                                        }}
                                        className="h-10 w-full rounded-lg border-2 border-cyan-200/45 bg-white px-3 text-sm font-black uppercase text-slate-950 focus:border-emerald-400 focus:outline-none"
                                      />
                                      <input
                                        value={editRusumCode}
                                        inputMode="numeric"
                                        onChange={(e) => {
                                          setEditRusumCode(e.target.value.replace(/\D/g, ""));
                                          setRusumError("");
                                        }}
                                        className="h-10 w-full rounded-lg border-2 border-emerald-200/55 bg-white px-3 text-sm font-black text-slate-950 focus:border-cyan-400 focus:outline-none"
                                      />
                                    </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {HARAKAT_TURI_LIST.map((item) => {
                                      const value = item.value as HarakatTuri;
                                      const active = editRusumHarakat.includes(value);
                                      return (
                                        <button
                                          key={value}
                                          type="button"
                                          onClick={() => toggleEditRusumHarakat(value)}
                                          className={`rounded-lg px-2 py-1.5 text-[9px] font-black uppercase text-white ${
                                            active ? HARAKAT_RUSUM_CARD[value] : "border border-cyan-200/20 bg-white/10 text-cyan-100"
                                          }`}
                                        >
                                          {HARAKAT_RUSUM_LABEL[value]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void saveRusumEdit()}
                                      disabled={rusumBusy}
                                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-400 disabled:opacity-50"
                                    >
                                      Saqlash
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelRusumEdit}
                                      className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-black text-white hover:bg-white/30"
                                    >
                                      Bekor
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="break-words text-sm font-black text-white">{rusum.label}</p>
                                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-200">
                                        # {rusum.code}
                                      </span>
                                      <span className="shrink-0 rounded-full bg-slate-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-slate-300">
                                        Asosiy
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {rusum.harakatTurlari.map((h) => (
                                        <span
                                          key={h}
                                          className="rounded-full bg-cyan-400/18 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-50"
                                        >
                                          {HARAKAT_RUSUM_LABEL[h]}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditStaticRusum(rusum)}
                                      className="rounded-lg bg-blue-500/15 p-1.5 text-blue-200 hover:bg-blue-400/25"
                                      title="Tahrirlash"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteStaticRusum(rusum)}
                                      disabled={rusumBusy}
                                      className="rounded-lg bg-rose-500/15 p-1.5 text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                                      title="O'chirish"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-cyan-300/20 pt-3">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-100">
                        Qo&apos;shilgan rusumlar
                      </p>
                      {customRusumlar.length === 0 ? (
                        <p className="py-8 text-center text-xs font-semibold text-slate-500">
                          Hozircha qo&apos;shimcha rusum yo&apos;q
                        </p>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {customRusumlar.map((rusum) => {
                            const editing = editingRusumId === rusum.id;
                            return (
                              <div
                                key={rusum.id}
                                className="rounded-xl border border-emerald-300/20 bg-emerald-950/35 px-3 py-2 shadow-sm shadow-black/10"
                              >
                                {editing ? (
                                  <div className="space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                                      <input
                                        value={editRusumName}
                                        onChange={(e) => {
                                          setEditRusumName(e.target.value);
                                          setRusumError("");
                                        }}
                                        className="h-10 w-full rounded-lg border-2 border-cyan-200/45 bg-white px-3 text-sm font-black uppercase text-slate-950 focus:border-emerald-400 focus:outline-none"
                                      />
                                      <input
                                        value={editRusumCode}
                                        inputMode="numeric"
                                        onChange={(e) => {
                                          setEditRusumCode(e.target.value.replace(/\D/g, ""));
                                          setRusumError("");
                                        }}
                                        className="h-10 w-full rounded-lg border-2 border-emerald-200/55 bg-white px-3 text-sm font-black text-slate-950 focus:border-cyan-400 focus:outline-none"
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {HARAKAT_TURI_LIST.map((item) => {
                                        const value = item.value as HarakatTuri;
                                        const active = editRusumHarakat.includes(value);
                                        return (
                                          <button
                                            key={value}
                                            type="button"
                                            onClick={() => toggleEditRusumHarakat(value)}
                                            className={`rounded-lg px-2 py-1.5 text-[9px] font-black uppercase text-white ${
                                              active ? HARAKAT_RUSUM_CARD[value] : "border border-cyan-200/20 bg-white/10 text-cyan-100"
                                            }`}
                                          >
                                            {HARAKAT_RUSUM_LABEL[value]}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void saveRusumEdit()}
                                        disabled={rusumBusy}
                                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-400 disabled:opacity-50"
                                      >
                                        Saqlash
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelRusumEdit}
                                        className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-black text-white hover:bg-white/30"
                                      >
                                        Bekor
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="break-words text-sm font-black text-white">{rusum.label}</p>
                                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-200">
                                          # {rusum.code ?? "-"}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {rusum.harakatTurlari.map((h) => (
                                          <span
                                            key={h}
                                            className="rounded-full bg-cyan-400/18 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-50"
                                          >
                                            {HARAKAT_RUSUM_LABEL[h]}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEditRusum(rusum)}
                                        className="rounded-lg bg-blue-500/15 p-1.5 text-blue-200 hover:bg-blue-400/25"
                                        title="Tahrirlash"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void deleteRusum(rusum)}
                                        disabled={rusumBusy}
                                        className="rounded-lg bg-rose-500/15 p-1.5 text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                                        title="O'chirish"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
