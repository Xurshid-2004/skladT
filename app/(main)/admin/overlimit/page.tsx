"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { subDays } from "date-fns";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { parsePdfNumber } from "@/lib/utils/pdf-number";

export default function AdminOverlimitPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const sinceDate = subDays(new Date(), 21);
    const since = sinceDate.getTime();
    let timestampRows: any[] = [];
    let numericRows: any[] = [];
    const publish = () => {
      const byId = new Map<string, any>();
      for (const row of timestampRows) byId.set(row.id, row);
      for (const row of numericRows) byId.set(row.id, row);
      setRows([...byId.values()].filter((r: any) => r.isOverLimit === true).slice(0, 120));
    };

    const timestampQuery = query(
      collection(db, "submissions"),
      where("timestamp", ">=", Timestamp.fromDate(sinceDate)),
      orderBy("timestamp", "desc"),
      limit(400),
    );
    const numericTimestampQuery = query(
      collection(db, "submissions"),
      where("timestamp", ">=", since),
      orderBy("timestamp", "desc"),
      limit(400),
    );

    const unsubTimestamp = onSnapshot(timestampQuery, (snap) => {
      timestampRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      publish();
    });
    const unsubNumeric = onSnapshot(numericTimestampQuery, (snap) => {
      numericRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      publish();
    });

    return () => {
      unsubTimestamp();
      unsubNumeric();
    };
  }, []);

  function ts(m: unknown): number {
    if (m == null) return 0;
    if (typeof m === "number") return m;
    if (typeof (m as { toMillis?: () => number }).toMillis === "function")
      return (m as { toMillis: () => number }).toMillis();
    return 0;
  }

  function kg(s: any): number {
    return parsePdfNumber(s?.qanchaBerildi ?? s?.qancha ?? s?.qanchaOlindi ?? 0);
  }

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
              <AlertTriangle className="w-9 h-9 text-danger" /> Limitdan oshganlar
            </h1>
            <p className="text-muted-foreground font-bold text-sm mt-2">
              So‘nggi 21 kunda <code className="text-xs">isOverLimit</code> belgilangan yozuvlar.
            </p>
          </div>
          <Link
            href="/admin/hisobotlar/"
            className="text-xs font-black uppercase text-primary hover:underline"
          >
            To‘liq hisobotlar →
          </Link>
        </div>

        <div className="bg-background rounded-[28px] border-2 border-danger/20 overflow-x-auto shadow-sm">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-danger/10 text-[10px] font-black uppercase tracking-widest text-danger">
              <tr>
                <th className="px-5 py-3">Vaqt</th>
                <th className="px-5 py-3">Zapravka</th>
                <th className="px-5 py-3">Kategoriya</th>
                <th className="px-5 py-3">Xodim</th>
                <th className="px-5 py-3 text-right">Miqdor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5 text-sm">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3 font-bold whitespace-nowrap">
                    {format(new Date(ts(s.timestamp)), "dd.MM HH:mm")}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{s.stationId}</td>
                  <td className="px-5 py-3 uppercase text-[10px] font-black">{s.category}</td>
                  <td className="px-5 py-3">
                    <span className="font-bold">{s.staffName}</span>
                    <span className="block text-[10px] opacity-50">{s.staffCode}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-black text-danger">{kg(s).toLocaleString()} kg</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground font-bold">
                    Tanlangan davrda limitdan oshgan yozuv topilmadi
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
