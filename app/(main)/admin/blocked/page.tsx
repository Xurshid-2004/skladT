"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import StaffVaultModal from "@/components/admin/staff-vault-modal";
import AdminVaultModal from "@/components/admin/admin-vault-modal";
import { ShieldOff, TrainFront, Trash2, UserCog, Users } from "lucide-react";
import {
  subscribeBlockedCodes,
  blockCode,
  unblockCode,
  type BlockedCodeDoc,
} from "@/lib/firebase/blocked-codes-service";
import { getSession } from "@/lib/utils/session";
import { format } from "date-fns";

const ADMIN_VAULT_PASSWORD = "20042004";

export default function AdminBlockedPage() {
  const [rows, setRows] = useState<BlockedCodeDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [adminVaultOpen, setAdminVaultOpen] = useState(false);
  const [rusumOpenRequest, setRusumOpenRequest] = useState(0);

  const blockedSet = useMemo(
    () => new Set(rows.map((r) => r.code.trim())),
    [rows],
  );

  useEffect(() => subscribeBlockedCodes(setRows), []);

  async function blockByTabel(tabel: string, note: string) {
    const c = tabel.replace(/\s/g, "");
    if (c.length < 3) {
      window.alert("Kod kamida 3 belgi bo‘lishi kerak.");
      throw new Error("short-code");
    }
    const s = getSession();
    try {
      await blockCode({
        code: c,
        note,
        blockedAt: Date.now(),
        blockedByDisplayName: s?.displayName,
      });
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Bloklashda xato");
      throw e;
    }
  }

  async function unblockByTabel(tabel: string) {
    try {
      await unblockCode(tabel.replace(/\s/g, ""));
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Xato");
      throw e;
    }
  }

  async function handleUnblock(code: string) {
    if (!confirm(`${code} kodini blokdan chiqarish?`)) return;
    setBusy(true);
    try {
      await unblockCode(code);
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "Xato");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenAdminVault() {
    const password = window.prompt("Admin qo'shish parolini kiriting:");
    if (password === null) return;

    if (password.trim() !== ADMIN_VAULT_PASSWORD) {
      window.alert("Parol xato. Admin qo'shish bo'limi ochilmadi.");
      return;
    }

    setAdminVaultOpen(true);
  }

  function handleOpenRusumVault() {
    setVaultOpen(true);
    setRusumOpenRequest((value) => value + 1);
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl space-y-8 pb-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
              <ShieldOff className="w-9 h-9" /> Bloklangan kirish kodlari
            </h1>
            <p className="text-muted-foreground font-bold text-sm mt-2 max-w-xl">
              Bunday kod bilan tizimga kirish rad etiladi. Xodimlar vaultida tabel raqam shu kirish kodi
              (parol) bilan bir xil bo‘lsa, shu raqamni bloklash kifoya. Hisobotlar va boshqa bo‘limlarga
              taʼsir qilmaydi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setVaultOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(34,197,94,0.55)]"
            >
              <Users className="w-5 h-5" />
              Xodim qo'shish
            </button>
            <button
              type="button"
              onClick={handleOpenRusumVault}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3.5 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(249,115,22,0.5)]"
            >
              <TrainFront className="w-5 h-5" />
              Rusum qo'shish
            </button>
            <button
              type="button"
              onClick={handleOpenAdminVault}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3.5 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(124,58,237,0.5)]"
            >
              <UserCog className="w-5 h-5" />
              Admin qo'shish
            </button>
          </div>
        </div>

        <StaffVaultModal
          open={vaultOpen}
          onClose={() => setVaultOpen(false)}
          rusumOpenRequest={rusumOpenRequest}
          blockedCodes={blockedSet}
          onBlockByTabel={blockByTabel}
          onUnblockByTabel={unblockByTabel}
        />
        <AdminVaultModal
          open={adminVaultOpen}
          onClose={() => setAdminVaultOpen(false)}
          blockedCodes={blockedSet}
        />

        <div className="bg-background rounded-[28px] border-2 border-primary/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-primary/5 font-black text-xs uppercase opacity-40">
            Ro‘yxat
          </div>
          <div className="divide-y divide-primary/5">
            {rows.map((r) => (
              <div key={r.code} className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-lg text-primary tracking-tight">{r.code}</p>
                  {r.note && <p className="text-xs text-muted-foreground font-semibold">{r.note}</p>}
                  <p className="text-[10px] font-bold opacity-35 uppercase mt-1">
                    {r.blockedByDisplayName && `${r.blockedByDisplayName} · `}
                    {r.blockedAt ? format(r.blockedAt, "dd.MM.yyyy HH:mm") : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(r.code)}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-primary/10 text-xs font-black uppercase"
                >
                  <Trash2 className="w-4 h-4" /> Chiqarish
                </button>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="px-6 py-12 text-center text-muted-foreground font-bold text-sm">
                Hozircha bloklangan kod yo‘q
              </p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
