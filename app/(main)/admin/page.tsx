"use client";

import AdminLayout from "@/components/admin/admin-layout";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import Link from "next/link";
import { TrendingUp, TrendingDown, Users } from "lucide-react";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import {
  subscribePresenceSessions,
  isPresenceOnline,
  isPresenceTableVisible,
  type PresenceSessionDoc,
} from "@/lib/firebase/presence-service";

const PRESENCE_UI_TICK_MS = 5_000;
import {
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

/** To'liq raqamlarni chiqarmasdan kg ni ming ga yaxlitlab ko'rsatish. */
function formatKgThousands(kg: number): string {
  const rounded = Math.round(kg / 1000) * 1000;
  return rounded.toLocaleString("uz-UZ", { maximumFractionDigits: 0 });
}

function fuelKg(d: Record<string, unknown>): number {
  return Number(d.qanchaBerildi ?? d.qancha ?? d.qanchaOlindi ?? 0);
}

function submissionTs(sub: Record<string, unknown>): number {
  const t = sub.timestamp;
  if (t == null) return 0;
  if (typeof t === "number") return t;
  if (typeof (t as { toMillis?: () => number }).toMillis === "function") {
    return (t as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function zapravkaNom(stationId: string | null): string {
  if (!stationId) return "—";
  const z = ZAPRAVKALAR.find((x) => x.id === stationId);
  return z ? z.name : stationId;
}

function displayFullName(p: PresenceSessionDoc): string {
  if (p.staffVaultFullName?.trim()) return p.staffVaultFullName.trim();
  if (p.displayName?.trim()) return p.displayName.trim();
  return "—";
}

function rolLabel(role: string): string {
  if (role === "worker") return "Ishchi";
  if (role === "admin") return "Admin";
  if (role === "developer") return "Dasturchi";
  return role;
}

function roleBadgeClass(role: string): string {
  if (role === "admin") return "bg-red-500 text-white shadow-md shadow-red-900/30";
  if (role === "developer") return "bg-teal-600 text-white shadow-md shadow-teal-900/30";
  if (role === "worker") return "bg-orange-500 text-white shadow-md shadow-orange-900/30";
  return "bg-slate-600 text-white";
}

function sortPresenceRows(rows: PresenceSessionDoc[], now: number): PresenceSessionDoc[] {
  return [...rows].sort((a, b) => {
    const ao = isPresenceOnline(a.lastSeen, now) ? 1 : 0;
    const bo = isPresenceOnline(b.lastSeen, now) ? 1 : 0;
    if (bo !== ao) return bo - ao;
    return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);
  });
}

export default function AdminDashboard() {
  const [todayKg, setTodayKg] = useState(0);
  const [yesterdayKg, setYesterdayKg] = useState(0);
  const [presence, setPresence] = useState<PresenceSessionDoc[]>([]);
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [presenceNow, setPresenceNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setPresenceNow(Date.now()), PRESENCE_UI_TICK_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const dayStart = startOfDay(new Date()).getTime();
      const dayEnd = endOfDay(new Date()).getTime();
      const yStart = startOfDay(subDays(new Date(), 1)).getTime();
      const yEnd = endOfDay(subDays(new Date(), 1)).getTime();

      const q = query(
        collection(db, "submissions"),
        where("timestamp", ">=", yStart),
        where("timestamp", "<=", dayEnd),
      );
      const snap = await getDocs(q);
      let tSum = 0;
      let ySum = 0;
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const ts = submissionTs(data);
        const kg = fuelKg(data);
        if (ts >= dayStart && ts <= dayEnd) tSum += kg;
        else if (ts >= yStart && ts <= yEnd) ySum += kg;
      });
      if (!cancelled) {
        setTodayKg(tSum);
        setYesterdayKg(ySum);
      }
    };

    load();

    const unsubPresence = subscribePresenceSessions(
      (rows) => {
        setPresence(rows);
        setPresenceError(null);
      },
      (msg) => setPresenceError(msg),
    );

    return () => {
      cancelled = true;
      unsubPresence();
    };
  }, []);

  const sortedPresence = sortPresenceRows(presence, presenceNow);
  const tablePresence = sortedPresence.filter((p) =>
    isPresenceTableVisible(p.lastSeen, presenceNow, p.createdAt),
  );
  const onlinePresence = tablePresence.filter((p) => isPresenceOnline(p.lastSeen, presenceNow));
  const onlineWorkers = onlinePresence.filter((p) => p.role === "worker").length;

  const todayR = Math.round(todayKg / 1000) * 1000;
  const yesterdayR = Math.round(yesterdayKg / 1000) * 1000;
  const diffR = todayR - yesterdayR;
  const more = diffR >= 0;
  const diffAbs = Math.abs(diffR);

  const donutData =
    todayR <= 0 && yesterdayR <= 0
      ? []
      : [
          { name: "Kecha (barcha ERJ)", value: yesterdayR },
          { name: "Bugun (barcha ERJ)", value: todayR },
        ];

  return (
    <AdminLayout>
      <div className="space-y-10 max-w-5xl mx-auto">
        <div>
          <p className="text-red-500 font-bold uppercase text-[10px] tracking-widest">
            Bugun vs kecha — barcha ERJ bo&apos;yicha yig&apos;ma sarflanma
          </p>
          <p className="text-[11px] font-bold text-red-500 mt-2">
            Ishchilar vaultdagi tabel = kirish kodi bo&apos;lsa, F.I.Sh chiqadi. Login real-time;
            saytdan chiqqan ishchi bugun ishlagan bo&apos;lsa &quot;Oflayn&quot; holatida soat 00:00 gacha
            jadvalda qoladi.
          </p>
        </div>

        {/* Ulangan foydalanuvchilar — premium jadval */}
        <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-xl shadow-slate-300/40">
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <h2 className="flex items-center gap-3 text-base font-black uppercase tracking-tight text-slate-900 sm:text-lg">
              <Users className="h-6 w-6 text-indigo-600" />
              Ulangan foydalanuvchilar
            </h2>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 shadow-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.9)]" aria-hidden />
                Onlayn ishchilar: {onlineWorkers}
              </span>
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Jami onlayn: {onlinePresence.length}
              </span>
              <Link
                href="/admin/hisobotlar/"
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700"
              >
                Hisobotlar
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto bg-gradient-to-br from-emerald-600 via-green-600 to-emerald-700">
            <table className="presence-table w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-emerald-900/35 text-[10px] font-black uppercase tracking-[0.14em]">
                  <th className="px-5 py-3.5 text-white sm:px-7">Holat</th>
                  <th className="px-5 py-3.5 text-white sm:px-7">F.I.Sh / nom</th>
                  <th className="px-5 py-3.5 text-white sm:px-7">Kirilgan kod</th>
                  <th className="px-5 py-3.5 text-white sm:px-7">Zapravka</th>
                  <th className="px-5 py-3.5 text-white sm:px-7">Rol</th>
                  <th className="px-5 py-3.5 text-white sm:px-7">Oxirgi signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/15">
                {tablePresence.map((p) => {
                  const on = isPresenceOnline(p.lastSeen, presenceNow);
                  const ls = p.lastSeen;
                  return (
                    <tr
                      key={p.uid}
                      className="transition-colors hover:bg-white/10"
                    >
                      <td className="px-5 py-4 sm:px-7">
                        <span
                          className={[
                            "inline-flex min-w-[5.5rem] items-center justify-center rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider",
                            on
                              ? "bg-emerald-300 text-emerald-950 shadow-[0_0_14px_rgba(134,239,172,0.85)] ring-1 ring-emerald-100/80"
                              : "bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.75)] ring-1 ring-red-300/60",
                          ].join(" ")}
                        >
                          {on ? "Onlayn" : "Oflayn"}
                        </span>
                      </td>
                      <td className="px-5 py-4 sm:px-7">
                        <p className="text-sm font-black text-white drop-shadow-sm">
                          {displayFullName(p)}
                        </p>
                        {p.staffVaultFullName && p.displayName && (
                          <p className="mt-0.5 text-[10px] font-bold text-emerald-100/90">
                            Sessiya: {p.displayName}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-sm font-black text-white sm:px-7">
                        {p.code || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-white sm:px-7">
                        {zapravkaNom(p.stationId)}
                      </td>
                      <td className="px-5 py-4 sm:px-7">
                        <span
                          className={[
                            "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide",
                            roleBadgeClass(p.role),
                          ].join(" ")}
                        >
                          {rolLabel(p.role)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-bold tabular-nums text-emerald-50 sm:px-7">
                        {ls ? format(new Date(ls), "HH:mm, dd.MM.yyyy") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {presenceError && (
              <p className="border-t border-red-300/40 bg-red-950/40 px-6 py-4 text-center text-sm font-bold text-red-100">
                {presenceError}. Admin sifatida qayta kiring; ishchi tomonda Anonymous Auth
                yoqilganini tekshiring.
              </p>
            )}
            {!tablePresence.length && !presenceError && (
              <p className="py-14 text-center text-sm font-bold text-white/90">
                Hozircha faol sessiyalar yo&apos;q. Ishchi kirganda Firebase Anonymous Auth
                yoqilgan bo&apos;lishi kerak.
              </p>
            )}
          </div>
        </div>

        {/* Taqqoslash blok — qatorlar qo‘shilgani sari balandlik avtomatik */}
        <section className="rounded-[32px] overflow-hidden border border-violet-900/30 shadow-2xl shadow-violet-950/20">
          <div className="bg-gradient-to-br from-violet-950 via-slate-900 to-violet-950 px-6 sm:px-10 py-8 sm:py-10 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-violet-300/90 mb-2">
              Yoqilg&apos;i sarfi
            </p>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">
              {format(new Date(), "dd.MM.yyyy")}{" "}
              <span className="text-violet-300 font-bold text-base">· barcha zapravkalar yig&apos;indisi</span>
            </h2>
            <p className="text-[11px] font-bold text-violet-200/80 mb-8">
              Ko&apos;rsatilgan miqdorlar ming kg ga yaxlitlangan; uzun raqamlar soddalashtiriladi.
            </p>

            <div className="grid sm:grid-cols-2 gap-8 mb-8">
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <p className="text-[10px] font-black uppercase text-white/50 mb-1">Bugun jami</p>
                <p className="text-3xl sm:text-4xl font-black tabular-nums">
                  {formatKgThousands(todayKg)}{" "}
                  <span className="text-lg text-white/70">kg</span>
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                <p className="text-[10px] font-black uppercase text-white/50 mb-1">Kecha jami</p>
                <p className="text-3xl sm:text-4xl font-black tabular-nums text-violet-200">
                  {formatKgThousands(yesterdayKg)}{" "}
                  <span className="text-lg text-white/60">kg</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-black/25 ring-1 ring-white/10 px-5 py-6 mb-8">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                {more ? (
                  <TrendingUp className="w-6 h-6 text-red-400" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-emerald-400" />
                )}
                <span className="text-[11px] font-black uppercase tracking-widest text-white/60">
                  Kechagi kunning nisbati
                </span>
              </div>
              <p
                className={`text-3xl sm:text-4xl font-black tabular-nums ${
                  more ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {more ? "+" : "−"}
                {diffAbs.toLocaleString("uz-UZ")} kg
              </p>
              <p className="text-sm font-bold text-white/70 mt-2">
                {more
                  ? `Kechagiga nisbatan ${diffAbs.toLocaleString("uz-UZ")} kg ko‘proq ishlatilgan`
                  : `Kechagiga nisbatan ${diffAbs.toLocaleString("uz-UZ")} kg kam ishlatilgan`}
              </p>
            </div>

            <div className="mx-auto max-w-md w-full">
              {!donutData.length ? (
                <p className="flex min-h-[220px] items-center justify-center text-center text-sm font-bold text-white/50 px-6">
                  Kecha va bugun uchun yaxlitlangan sarf — 0 kg. Grafik uchun ma&apos;lumot
                  kam.
                </p>
              ) : (
                <>
                  <div className="relative h-56 sm:h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="48%"
                          outerRadius="78%"
                          paddingAngle={4}
                        >
                          {donutData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={i === 0 ? "#818cf8" : "#d946ef"}
                              stroke="rgba(15,23,42,0.45)"
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#1e1b4b",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 12,
                            fontWeight: 700,
                          }}
                          formatter={(value) =>
                            `${
                              typeof value === "number"
                                ? value.toLocaleString("uz-UZ")
                                : Number(value).toLocaleString("uz-UZ")
                            } kg`
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center px-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-300/90">
                          Bugun jami
                        </p>
                        <p className="text-lg sm:text-xl font-black tabular-nums text-white">
                          {formatKgThousands(todayKg)}
                        </p>
                        <p className="text-[10px] font-bold text-white/55">kg</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] font-black uppercase text-violet-100/90">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: "#818cf8" }}
                      />
                      Kecha — {formatKgThousands(yesterdayKg)} kg
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: "#d946ef" }}
                      />
                      Bugun — {formatKgThousands(todayKg)} kg
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
