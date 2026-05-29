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
import type { StaffVaultRecord } from "@/lib/types";
import { X, Pencil, Trash2, ShieldBan, ShieldCheck, ChevronRight, Users } from "lucide-react";

export type StaffVaultModalProps = {
  open: boolean;
  onClose: () => void;
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

export default function StaffVaultModal({
  open,
  onClose,
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
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    return subscribeStaff(setStaffList);
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

  const closeModal = () => {
    onClose();
    setSelectedErju("");
    setSelectedZapravka("");
    setNewStaffName("");
    setNewStaffTabel("");
    setEditingStaffId(null);
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
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-red-400/30 bg-red-500/80 p-2 text-white transition-all hover:bg-red-600"
          >
            <X className="h-5 w-5" />
          </button>
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
                        Tabel raqam (parol bilan bir xil bo&apos;lishi mumkin)
                      </label>
                      <input
                        value={newStaffTabel}
                        onChange={(e) => setNewStaffTabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void addStaff();
                          }
                        }}
                        placeholder="12345"
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
                                setEditStaff((p) => ({ ...p, tabel: e.target.value }))
                              }
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
      </div>
    </div>,
    document.body,
  );
}
