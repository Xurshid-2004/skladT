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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart,
  Pie,
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

/** Jadvalda biriktirilgan zapravka (stationId, kod yoki sessiya nomi) */
function presenceZapravka(p: PresenceSessionDoc): string {
  const byStation = zapravkaNom(p.stationId);
  if (byStation !== "—") return byStation;

  if (p.role === "admin") return "Admin panel";

  if (p.code) {
    const byCode = ZAPRAVKALAR.find(
      (z) => z.workerCodes.includes(p.code) || z.reserveCodes.includes(p.code),
    );
    if (byCode) return byCode.name;
  }

  const dn = p.displayName?.trim();
  if (dn && p.role === "worker") {
    return dn.replace(/\s*\(Zaxira\)\s*$/i, "").trim() || dn;
  }

  return "—";
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

  const hasFuelData = todayR > 0 || yesterdayR > 0;
  const pctVsYesterday =
    yesterdayR > 0
      ? Math.round((diffR / yesterdayR) * 100)
      : todayR > 0
        ? 100
        : 0;

  const barChartData = [
    { label: "Kecha", kg: yesterdayR, fill: "#0d9488" },
    { label: "Bugun", kg: todayR, fill: more ? "#fbbf24" : "#4ade80" },
  ];

  const pieChartData = [
    ...(yesterdayR > 0
      ? [{ label: "Kecha", kg: yesterdayR, fill: "#0f766e" }]
      : []),
    ...(todayR > 0 ? [{ label: "Bugun", kg: todayR, fill: "#4ade80" }] : []),
  ];

  const compareTotal = Math.max(yesterdayR + todayR, 1);
  const kechaShare = Math.round((yesterdayR / compareTotal) * 100);
  const bugunShare = 100 - kechaShare;

  const compareCaption =
    !hasFuelData
      ? "Kecha va bugun uchun sarf 0 kg — taqqoslash uchun ma'lumot yo'q."
      : yesterdayR === 0 && todayR > 0
        ? "Kecha sarf qayd etilmagan; bugun sarflanish boshlangan."
        : more
          ? `Kechagiga nisbatan ${diffAbs.toLocaleString("uz-UZ")} kg (${pctVsYesterday > 0 ? "+" : ""}${pctVsYesterday}%) ko'proq`
          : diffR === 0
            ? "Kecha bilan bir xil sarf."
            : `Kechagiga nisbatan ${diffAbs.toLocaleString("uz-UZ")} kg (${pctVsYesterday}%) kam`;

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

          <div className="overflow-x-auto bg-gradient-to-br from-emerald-700 via-green-600 to-emerald-800 p-2 sm:p-3">
            <table className="presence-table w-full min-w-[600px] border-separate border-spacing-y-1 text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-[0.12em]">
                  <th className="px-3 py-2 text-white sm:px-5">Holat</th>
                  <th className="px-3 py-2 text-white sm:px-5">F.I.Sh / nom</th>
                  <th className="px-3 py-2 text-white sm:px-5">Biriktirilgan zapravka</th>
                  <th className="px-3 py-2 text-white sm:px-5">Rol</th>
                  <th className="px-3 py-2 text-white sm:px-5">Oxirgi signal</th>
                </tr>
              </thead>
              <tbody>
                {tablePresence.map((p) => {
                  const on = isPresenceOnline(p.lastSeen, presenceNow);
                  const ls = p.lastSeen;
                  const zap = presenceZapravka(p);
                  return (
                    <tr
                      key={p.uid}
                      className="rounded-lg ring-1 ring-slate-900/10"
                    >
                      <td className="rounded-l-lg px-3 py-2 sm:px-5">
                        <span
                          className={[
                            "inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                            on
                              ? "bg-emerald-500 text-white ring-1 ring-emerald-300"
                              : "bg-red-600 text-white ring-1 ring-red-300",
                          ].join(" ")}
                        >
                          {on ? "Onlayn" : "Oflayn"}
                        </span>
                      </td>
                      <td className="px-3 py-2 sm:px-5">
                        <p className="text-sm font-black leading-tight text-slate-900">
                          {displayFullName(p)}
                        </p>
                      </td>
                      <td className="px-3 py-2 sm:px-5">
                        <span className="inline-block rounded-md border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-900">
                          {zap}
                        </span>
                      </td>
                      <td className="px-3 py-2 sm:px-5">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                            roleBadgeClass(p.role),
                          ].join(" ")}
                        >
                          {rolLabel(p.role)}
                        </span>
                      </td>
                      <td className="rounded-r-lg px-3 py-2 text-[11px] font-bold tabular-nums text-slate-600 sm:px-5">
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

        {/* Yoqilg'i — kecha vs bugun (yashil panel, donut + ustun) */}
        <section className="fuel-compare-panel overflow-hidden rounded-[28px] border border-emerald-900/50 shadow-2xl shadow-emerald-950/40">
          <div className="bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 px-5 py-6 text-white sm:px-8 sm:py-8">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-200/90">
              Yoqilg&apos;i sarfi
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
              {format(new Date(), "dd.MM.yyyy")}
              <span className="ml-2 text-sm font-bold text-emerald-100/75">
                · barcha zapravkalar
              </span>
            </h2>
            <p className="mt-1 text-[11px] font-bold text-white/55">
              Ming kg ga yaxlitlangan · aylana va ustun diagrammalar
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-emerald-300/25 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase text-emerald-100/70">Bugun</p>
                <p className="text-2xl font-black tabular-nums text-white">
                  {formatKgThousands(todayKg)}
                  <span className="ml-1 text-sm text-white/50">kg</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 ring-1 ring-emerald-300/25 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase text-emerald-100/70">Kecha</p>
                <p className="text-2xl font-black tabular-nums text-emerald-50">
                  {formatKgThousands(yesterdayKg)}
                  <span className="ml-1 text-sm text-white/50">kg</span>
                </p>
              </div>
              <div
                className={`rounded-xl px-4 py-3 ring-2 backdrop-blur-sm ${
                  more
                    ? "bg-amber-950/40 ring-amber-400/45"
                    : diffR === 0
                      ? "bg-white/10 ring-emerald-300/30"
                      : "bg-emerald-800/50 ring-emerald-300/50"
                }`}
              >
                <p className="text-[9px] font-black uppercase text-white/55">Farq</p>
                <div className="flex items-center gap-2">
                  {diffR !== 0 &&
                    (more ? (
                      <TrendingUp className="h-5 w-5 shrink-0 text-orange-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 shrink-0 text-emerald-400" />
                    ))}
                  <p
                    className={`text-2xl font-black tabular-nums ${
                      more ? "text-orange-400" : diffR === 0 ? "text-slate-300" : "text-emerald-400"
                    }`}
                  >
                    {diffR === 0
                      ? "0"
                      : (more ? "+" : "−") + diffAbs.toLocaleString("uz-UZ")}
                    <span className="ml-1 text-sm">kg</span>
                  </p>
                </div>
                {yesterdayR > 0 && diffR !== 0 && (
                  <p className="mt-0.5 text-[11px] font-bold text-white/60">
                    {pctVsYesterday > 0 ? "+" : ""}
                    {pctVsYesterday}% kechaga nisbatan
                  </p>
                )}
              </div>
            </div>

            <p className="mt-4 text-center text-xs font-bold text-emerald-50/90">{compareCaption}</p>

            {hasFuelData ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-emerald-400/20">
                  <p className="mb-2 text-center text-[9px] font-black uppercase tracking-widest text-emerald-100/60">
                    Nisbat (aylana)
                  </p>
                  <div className="relative mx-auto h-56 w-full max-w-[280px] sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="88%"
                          paddingAngle={pieChartData.length > 1 ? 3 : 0}
                          dataKey="kg"
                          nameKey="label"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth={2}
                        >
                          {pieChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                      aria-hidden
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200/70">
                        Bugun
                      </span>
                      <span className="text-4xl font-black tabular-nums text-white drop-shadow-sm">
                        {bugunShare}%
                      </span>
                      <span className="mt-0.5 text-[10px] font-bold text-white/50">
                        kecha {kechaShare}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] font-black uppercase">
                    <span className="flex items-center gap-1.5 text-teal-100">
                      <span className="h-3 w-3 rounded-full bg-teal-700 ring-2 ring-white/20" />
                      Kecha · {yesterdayR.toLocaleString("uz-UZ")} kg
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-100">
                      <span className="h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-white/20" />
                      Bugun · {todayR.toLocaleString("uz-UZ")} kg
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-emerald-400/20">
                  <p className="mb-3 text-center text-[9px] font-black uppercase tracking-widest text-emerald-100/60">
                    Kecha vs bugun (kg)
                  </p>
                  <div className="h-52 w-full sm:h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={barChartData}
                        margin={{ top: 28, right: 8, left: 8, bottom: 4 }}
                        barCategoryGap="28%"
                      >
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#f8fafc", fontSize: 12, fontWeight: 800 }}
                        />
                        <YAxis hide domain={[0, Math.max(todayR, yesterdayR, 1000)]} />
                        <Bar dataKey="kg" radius={[10, 10, 4, 4]} maxBarSize={64}>
                          {barChartData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                          <LabelList
                            dataKey="kg"
                            position="top"
                            formatter={(v) =>
                              `${Number(v ?? 0).toLocaleString("uz-UZ")} kg`
                            }
                            style={{ fill: "#fff", fontWeight: 800, fontSize: 11 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 rounded-xl bg-white/5 p-3 ring-1 ring-emerald-300/15">
                    <div className="mb-2 flex justify-between text-[9px] font-black uppercase text-emerald-100/55">
                      <span>Kecha {kechaShare}%</span>
                      <span>Bugun {bugunShare}%</span>
                    </div>
                    <div className="flex h-3 overflow-hidden rounded-full ring-2 ring-white/20">
                      <div className="bg-teal-700" style={{ width: `${kechaShare}%` }} />
                      <div
                        className={more ? "bg-amber-400" : "bg-emerald-400"}
                        style={{ width: `${bugunShare}%` }}
                      />
                    </div>
                    <p className="mt-2 text-center text-[10px] font-bold text-white/50">
                      {more ? "Bugun ko‘proq" : diffR === 0 ? "Teng sarf" : "Bugun kamroq"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-xl bg-black/30 py-10 text-center text-sm font-bold text-white/45 ring-1 ring-white/10">
                Grafik uchun kecha yoki bugun bo‘yicha ma’lumot yo‘q
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
