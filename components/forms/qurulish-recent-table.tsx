"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { subscribeToSubmissions } from "@/lib/firebase/submissions-service";
import { useMidnightReset } from "@/lib/hooks/use-midnight-reset";
import { QurulishSubmission } from "@/lib/types";
import { format } from "date-fns";
import { History, Loader2, Pencil, Download } from "lucide-react";
import { Submission } from "@/lib/types";
import { SubmissionEditDrawer } from "@/components/admin/submission-edit-drawer";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface QurulishRecentTableProps {
  stationId: string;
}

function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (typeof ts?.toDate === "function") return ts.toDate();
  return new Date(Number(ts));
}

function formatTimestamp(ts: any): string {
  const date = toDate(ts);
  return Number.isNaN(date.getTime()) ? "--:--" : format(date, "HH:mm");
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

function exportQurulishPdf(rows: QurulishSubmission[]) {
  const now = new Date();
  const dateStr = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
  const doc = new jsPDF("landscape", "mm", "a4");
  const W = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const title = `${dateStr} kuni qurilish tashkilotlariga berilgan dizel yoqilg'isi haqida ma'lumot`;
  const lines = doc.splitTextToSize(title, W - 28);
  let y = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, y, { align: "center" }); y += 5; });

  const head = [[
    "Vaqt",
    "Korxona nomi",
    "Obyekt",
    "Texnika soni",
    "Lavozimi",
    "Qancha (kg)",
    "Limit (kg)",
    "Dop limit (kg)",
    "Holat",
    "Mashinada",
    "Mas'ul shaxs",
  ]];

  const body = rows.map((sub) => {
    const mashinaStr = sub.mashinadaYetkazildi
      ? (sub.mashinaRaqami ? `Ha · ${sub.mashinaRaqami}` : "Ha")
      : "Yo'q";
    return [
      formatTimestamp(sub.timestamp),
      sub.korxonaNomi,
      sub.obyekt,
      String(sub.texnikaSoni),
      sub.lavozim ?? "—",
      String(sub.qanchaOlindi),
      sub.limit ? String(sub.limit) : "—",
      sub.dopLimit != null ? String(sub.dopLimit) : "—",
      sub.isOverLimit ? `Oshgan (+${sub.oshiqMiqdor ?? 0} kg)` : "Norma",
      mashinaStr,
      sub.masulShaxs,
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y + 4,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.8, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [180, 80, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [252, 248, 244] },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 38 },
      2: { cellWidth: 34 },
      3: { cellWidth: 18 },
      4: { cellWidth: 24 },
      5: { cellWidth: 22, halign: "right" as const },
      6: { cellWidth: 20, halign: "right" as const },
      7: { cellWidth: 22, halign: "right" as const },
      8: { cellWidth: 24 },
      9: { cellWidth: 22 },
      10: { cellWidth: 34 },
    },
  });

  const total = rows.reduce((s, r) => s + Number(r.qanchaOlindi ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Jami berildi: ${total.toLocaleString("uz-UZ")} kg`, 14, fY + 8);
  doc.save(`qurulish_${dateStr}.pdf`);
}

export default function QurulishRecentTable({ stationId }: QurulishRecentTableProps) {
  const [submissions, setSubmissions] = useState<QurulishSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const dateKey = useMidnightReset();

  const isToday = (ts: any) => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const d = toDate(ts); d.setHours(0, 0, 0, 0);
    return !Number.isNaN(d.getTime()) && t.getTime() === d.getTime();
  };

  useEffect(() => {
    const unsubscribe = subscribeToSubmissions(stationId, "qurulish", (data) => {
      setSubmissions(data as QurulishSubmission[]);
      setLoading(false);
    }, 100);
    return () => unsubscribe();
  }, [stationId, dateKey]);

  const todaySubmissions = useMemo(
    () => submissions.filter(s => isToday(s.timestamp)),
    [submissions, dateKey]
  );

  const handlePdf = useCallback(() => {
    if (!todaySubmissions.length) return;
    setPdfLoading(true);
    setTimeout(() => {
      try { exportQurulishPdf(todaySubmissions); }
      finally { setPdfLoading(false); }
    }, 50);
  }, [todaySubmissions]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>;
  if (todaySubmissions.length === 0) return <div className="text-center py-10 opacity-50"><History className="mx-auto mb-2" /> Bugun yozuv yo'q</div>;

  return (
    <>
      <div className="space-y-4">
        {/* PDF button bar */}
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs font-black uppercase text-muted-foreground">
            Bugun: <span className="text-primary">{todaySubmissions.length}</span> ta yozuv
          </span>
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 text-white bg-orange-600 hover:bg-orange-700 active:scale-95"
          >
            {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
        </div>

        {/* Desktop */}
        <div className="hidden md:block bg-background/70 backdrop-blur-md rounded-3xl border-2 border-primary/15 overflow-hidden shadow-lg overflow-x-auto">
          <table className="table-fixed text-left" style={{ minWidth: 900 }}>
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "2%" }} />
            </colgroup>
            <thead className="bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">Vaqt</th>
                <th className="px-3 py-3 whitespace-nowrap">Korxona</th>
                <th className="px-3 py-3 whitespace-nowrap">Texnika</th>
                <th className="px-3 py-3 whitespace-nowrap">Obyekt</th>
                <th className="px-3 py-3 whitespace-nowrap">Lavozim</th>
                <th className="px-3 py-3 whitespace-nowrap">Qancha</th>
                <th className="px-3 py-3 whitespace-nowrap">Limit</th>
                <th className="px-3 py-3 whitespace-nowrap">Dop Limit</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Mashina</th>
                <th className="px-3 py-3 whitespace-nowrap">Mas'ul</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5 text-sm">
              {todaySubmissions.map((sub) => {
                const mashinaCell = sub.mashinadaYetkazildi
                  ? <span className="text-blue-600 font-bold">{sub.mashinaRaqami ? sub.mashinaRaqami : "Ha"}</span>
                  : <span className="text-muted-foreground">Yo'q</span>;
                return (
                  <tr key={sub.id} className={sub.isOverLimit ? "text-danger" : ""}>
                    <td className="px-3 py-3 font-bold truncate">{formatTimestamp(sub.timestamp)}</td>
                    <td className="px-3 py-3 font-black max-w-[160px] truncate">{sub.korxonaNomi}</td>
                    <td className="px-3 py-3 text-center font-bold whitespace-nowrap">{sub.texnikaSoni}</td>
                    <td className="px-3 py-3 max-w-[120px] truncate">{sub.obyekt}</td>
                    <td className="px-3 py-3 max-w-[110px] truncate">{sub.lavozim ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-black tabular-nums whitespace-nowrap">{sub.qanchaOlindi} kg</td>
                    <td className="px-3 py-3 whitespace-nowrap">{sub.limit ? `${sub.limit} kg` : "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{sub.dopLimit != null ? `${sub.dopLimit} kg` : "—"}</td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">{mashinaCell}</td>
                    <td className="px-3 py-3 text-xs font-bold max-w-[110px] truncate">{sub.masulShaxs}</td>
                    <td className="px-3 py-3">
                      {isToday(sub.timestamp) && (
                        <button
                          onClick={() => { setEditSub(sub as unknown as Submission); setEditOpen(true); }}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-3 pb-20">
          {todaySubmissions.map((sub) => (
            <div
              key={sub.id}
              className={`p-4 rounded-2xl border-2 backdrop-blur-md ${sub.isOverLimit ? "bg-danger/5 border-danger/20 text-danger" : "bg-background/50 border-primary/10"}`}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-base leading-tight">{sub.korxonaNomi}</h3>
                <span className="text-xs font-bold opacity-60 ml-2 shrink-0">{formatTimestamp(sub.timestamp)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="col-span-2"><p className="text-[9px] font-black uppercase opacity-60">Obyekt</p><p className="font-bold text-sm">{sub.obyekt}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Texnika soni</p><p className="font-bold">{sub.texnikaSoni}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Lavozim</p><p className="font-bold text-xs">{sub.lavozim ?? "—"}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Qancha</p><p className="font-bold">{sub.qanchaOlindi} kg</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Limit</p><p className="font-bold">{sub.limit ? `${sub.limit} kg` : "—"}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Dop limit</p><p className="font-bold">{sub.dopLimit != null ? `${sub.dopLimit} kg` : "—"}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Mashina</p>
                  <p className="font-bold text-xs">
                    {sub.mashinadaYetkazildi ? (sub.mashinaRaqami ? sub.mashinaRaqami : "Ha") : "Yo'q"}
                  </p>
                </div>
                <div className="col-span-2"><p className="text-[9px] font-black uppercase opacity-60">Mas'ul</p><p className="font-bold text-xs">{sub.masulShaxs}</p></div>
                {sub.isOverLimit && <div className="col-span-2 font-black text-xs uppercase">Limitdan oshgan: +{sub.oshiqMiqdor} kg</div>}
              </div>
              {isToday(sub.timestamp) && (
                <div className="mt-3 pt-3 border-t border-primary/5 flex justify-end">
                  <button
                    onClick={() => { setEditSub(sub as unknown as Submission); setEditOpen(true); }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase transition-all active:scale-95"
                  >
                    <Pencil className="w-3 h-3" /> Tahrirlash
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <SubmissionEditDrawer
        open={editOpen}
        submission={editSub}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setSubmissions(prev => prev.map(s => s.id === updated.id ? (updated as unknown as QurulishSubmission) : s));
          setEditOpen(false);
        }}
      />
    </>
  );
}
