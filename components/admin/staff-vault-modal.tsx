"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (!open) return;
    return subscribeStaff(setStaffList);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Yopish"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      />

      <div
        className="relative z-[201] flex w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0d1424] shadow-2xl sm:max-w-5xl sm:rounded-3xl"
        style={{ maxHeight: "92vh" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0f1e]/95 px-5 py-4">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:flex-row sm:overflow-hidden">
          {/* CHAP: ERJU */}
          <div className="w-full shrink-0 overflow-y-auto border-white/10 p-3 sm:w-52 sm:border-r">
            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Mintaqalar
            </p>
            {ERJU_STAFF_GROUPS.map((erju) => {
              const cnt = staffList.filter((s) => s.erju === erju.name).length;
              const isActive = selectedErju === erju.name;
              return (
                <button
                  key={erju.name}
                  type="button"
                  onClick={() => handleErjuSelect(erju.name)}
                  className={`mb-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <div>
                    <p className="text-xs font-semibold">{erju.name}</p>
                    <p
                      className={`mt-0.5 text-[10px] ${isActive ? "opacity-80" : "text-slate-500"}`}
                    >
                      {cnt} ta xodim
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-60" />
                </button>
              );
            })}
          </div>

          {/* O'RTA: zapravka + forma */}
          <div className="w-full shrink-0 space-y-4 overflow-y-auto border-white/10 p-4 sm:w-64 sm:border-r">
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
          <div className="min-h-[200px] flex-1 overflow-y-auto p-4 sm:min-h-0">
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
    </div>
  );
}
