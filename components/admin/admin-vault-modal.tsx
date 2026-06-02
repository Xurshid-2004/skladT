"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, UserCog, Save } from "lucide-react";
import {
  subscribeAdminCodes,
  upsertAdminCode,
  type AdminCodeRecord,
} from "@/lib/firebase/admin-codes-service";
import { subscribeStaff } from "@/lib/firebase/staff-service";
import { getSession } from "@/lib/utils/session";
import type { StaffVaultRecord } from "@/lib/types";

type AdminVaultModalProps = {
  open: boolean;
  onClose: () => void;
  blockedCodes: Set<string>;
};

function normalizeCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export default function AdminVaultModal({
  open,
  onClose,
  blockedCodes,
}: AdminVaultModalProps) {
  const [portalReady, setPortalReady] = useState(false);
  const [rows, setRows] = useState<AdminCodeRecord[]>([]);
  const [staffRows, setStaffRows] = useState<StaffVaultRecord[]>([]);
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    return subscribeAdminCodes(setRows);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return subscribeStaff(setStaffRows);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const existing = useMemo(
    () => rows.find((r) => r.code === code.trim()),
    [rows, code],
  );
  const staffCodeSet = useMemo(
    () => new Set(staffRows.map((s) => s.tabelNumber.trim()).filter(Boolean)),
    [staffRows],
  );

  const closeModal = () => {
    setCode("");
    setDisplayName("");
    onClose();
  };

  const saveAdmin = async () => {
    const cleanCode = code.trim();
    const cleanName = displayName.trim();

    if (cleanCode.length !== 4) {
      window.alert("Admin kodi 4 ta raqamdan iborat bo'lishi kerak.");
      return;
    }
    if (!cleanName) {
      window.alert("Admin ismini kiriting.");
      return;
    }
    if (staffCodeSet.has(cleanCode)) {
      window.alert("Bu kod xodim paroli bilan bir xil. Boshqa kod tanlang.");
      return;
    }
    if (blockedCodes.has(cleanCode)) {
      window.alert("Bu kod bloklangan. Avval blokdan chiqaring yoki boshqa kod tanlang.");
      return;
    }

    const session = getSession();
    setBusy(true);
    try {
      await upsertAdminCode({
        code: cleanCode,
        displayName: cleanName,
        actorCode: session?.code ?? "admin",
        actorName: session?.displayName ?? "Admin",
      });
      setCode("");
      setDisplayName("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Admin kodini saqlashda xato");
    } finally {
      setBusy(false);
    }
  };

  if (!open || !portalReady) return null;

  return createPortal(
    <div className="fixed inset-0 z-[520] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Yopish"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeModal}
      />

      <div className="relative z-[521] flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0f1e] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-900/30">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase text-white">Admin qo'shish</h2>
              <p className="text-xs font-semibold text-slate-400">
                Admin ismi va 4 xonali kirish kodi bir-biriga bog'lanadi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-red-400/30 bg-red-500/80 p-2 text-white hover:bg-red-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-4 border-white/10 p-5 md:border-r">
            <div>
              <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Admin kodi
              </label>
              <input
                value={code}
                onChange={(e) => setCode(normalizeCode(e.target.value))}
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
                className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-[#111a2d] px-4 text-xl font-black tracking-[0.35em] text-white outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">
                Admin ismi
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveAdmin();
                  }
                }}
                placeholder="Masalan: Aliyev V."
                className="mt-1 h-12 w-full rounded-2xl border border-white/10 bg-[#111a2d] px-4 text-base font-bold text-white outline-none focus:border-violet-400"
              />
            </div>

            {existing && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-200">
                Bu kod mavjud. Saqlasangiz, faqat admin ismi yangilanadi.
              </div>
            )}

            <button
              type="button"
              onClick={() => void saveAdmin()}
              disabled={busy || code.length !== 4 || !displayName.trim()}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 text-sm font-black uppercase text-white shadow-lg shadow-violet-900/30 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Save className="h-5 w-5" />
              Saqlash
            </button>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
              Admin kodlari
            </p>

            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 font-mono text-xs font-bold text-slate-500">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">
                        {row.displayName || "Admin"}
                      </p>
                      <p className="font-mono text-xs font-bold text-violet-300">
                        #{row.code}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {blockedCodes.has(row.code) && (
                      <span className="rounded-full bg-red-500/20 px-2 py-1 text-[10px] font-black uppercase text-red-300">
                        Bloklangan
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Faol
                    </span>
                  </div>
                </div>
              ))}

              {rows.length === 0 && (
                <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm font-semibold text-slate-400">
                  Hozircha Firestore admin kodi yo'q
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
