"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Approval } from "@/lib/types";
import { format } from "date-fns";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

export default function RuxsatnomalarPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "lokomotiv" | "korxona">("all");

  useEffect(() => {
    const q = query(collection(db, "approvals"), orderBy("approvedAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setApprovals(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Approval));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = approvals.filter((a) => a.validUntil > now).length;
    const expired = approvals.length - active;
    return { active, expired, total: approvals.length };
  }, [approvals]);

  const filtered = approvals.filter((a) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (a.lokomotivNumber && a.lokomotivNumber.includes(searchTerm)) ||
      (a.korxonaNomi && a.korxonaNomi.toLowerCase().includes(q)) ||
      a.approvedByName.toLowerCase().includes(q) ||
      a.stationId.toLowerCase().includes(q);

    const matchesType = filterType === "all" || a.requestType === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-900 p-[1px] shadow-xl">
          <div className="rounded-[31px] bg-background px-6 sm:px-10 py-8 sm:py-10">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                      Admin
                    </span>
                  </div>
                  <h1 className="text-3xl font-black text-primary tracking-tighter uppercase leading-tight">
                    Ruxsatnomalar
                  </h1>
                  <p className="text-muted-foreground font-bold text-sm mt-2 max-w-xl">
                    Chat orqali berilgan tasdiqlar va aktiv limit davrlari bir joyda.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 min-w-[min(100%,260px)]">
                <StatPill label="Jami" value={stats.total} muted />
                <StatPill label="Faol" value={stats.active} variant="success" />
                <StatPill label="Tugagan" value={stats.expired} variant="muted" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "Hammasi"],
                ["lokomotiv", "Lokomotiv"],
                ["korxona", "Korxona"],
              ] as const
            ).map(([k, lab]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilterType(k)}
                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${
                  filterType === k
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {lab}
              </button>
            ))}
          </div>
          <div className="relative max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Lokomotiv, korxona, kod, zapravka..."
              className="w-full pl-11 pr-4 h-12 bg-background border-2 border-primary/10 rounded-2xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="rounded-[28px] border border-primary/10 bg-background/80 backdrop-blur-sm shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="bg-gradient-to-r from-primary/95 to-primary text-white text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-6 py-4">Vaqt</th>
                <th className="px-6 py-4">Turi</th>
                <th className="px-6 py-4">Tafsilot</th>
                <th className="px-6 py-4">Zapravka</th>
                <th className="px-6 py-4 text-center">Kunlar</th>
                <th className="px-6 py-4">Kim berdi</th>
                <th className="px-6 py-4 text-right">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {filtered.map((a) => {
                const isActive = a.validUntil > Date.now();
                return (
                  <tr key={a.id} className="hover:bg-primary/[0.035] transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-black text-sm text-foreground tabular-nums">
                        {format(new Date(a.approvedAt ?? 0), "dd.MM.yyyy")}
                      </p>
                      <p className="text-[10px] font-bold opacity-40 uppercase">
                        {format(new Date(a.approvedAt ?? 0), "HH:mm")}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-primary/10 text-primary ring-1 ring-primary/15">
                        {a.requestType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-sm">
                      {a.requestType === "lokomotiv"
                        ? `${a.seriya ?? ""}-${a.lokomotivNumber ?? ""}`
                        : a.korxonaNomi ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold font-mono opacity-70 uppercase">
                      {a.stationId}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-sm">{a.sutkalikLimit}</td>
                    <td className="px-6 py-4">
                      <p className="font-black text-sm">{a.approvedByName}</p>
                      <p className="text-[10px] font-bold opacity-35">{a.approvedBy}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Faol
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground text-[10px] font-black uppercase opacity-50">
                          <Clock className="w-3.5 h-3.5" /> Tugagan
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center text-muted-foreground font-bold">
                    Hech narsa topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatPill({
  label,
  value,
  variant = "default",
  muted = false,
}: {
  label: string;
  value: number;
  variant?: "default" | "success" | "muted";
  muted?: boolean;
}) {
  const cls =
    variant === "success"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20"
      : variant === "muted" || muted
        ? "bg-muted text-muted-foreground ring-primary/5"
        : "bg-primary/10 text-primary ring-primary/15";
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ring-1 ${cls}`}>
      <p className="text-[9px] font-black uppercase opacity-60 tracking-wider">{label}</p>
      <p className="text-xl font-black tabular-nums mt-0.5">{value}</p>
    </div>
  );
}
