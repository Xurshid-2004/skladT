"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { subscribeToSubmissions } from "@/lib/firebase/submissions-service";
import { useMidnightReset } from "@/lib/hooks/use-midnight-reset";
import { QurulishSubmission } from "@/lib/types";
import { format } from "date-fns";
import { History, Loader2, Pencil, Download } from "lucide-react";
import { Submission } from "@/lib/types";
import { SubmissionEditDrawer } from "@/components/admin/submission-edit-drawer";
import { buildCategoryDetailPdfTitle, exportCategoryDetailPdf } from "@/lib/pdf/lokomotiv-detail-pdf";
import { formatPdfNonZeroNumber, formatPdfNumber, parsePdfNumber } from "@/lib/utils/pdf-number";
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

function getFuel(sub: any): number {
  return parsePdfNumber(sub.qanchaBerildi ?? sub.qanchaOlindi ?? 0);
}

function getQoldiq(sub: any): number {
  return parsePdfNumber(sub.qoldiq ?? 0);
}

function val(raw: unknown, fallback = "-"): string {
  if (raw == null || String(raw) === "") return fallback;
  return String(raw);
}

function exportQurulishPdf(rows: QurulishSubmission[]) {
  const now = new Date();
  const dateStr = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
  const doc = new jsPDF("landscape", "mm", "a4");
  const W = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const title = `${dateStr} kuni qurilish ishlari uchun berilgan dizel yoqilg'isi haqida ma'lumot`;
  const lines = doc.splitTextToSize(title, W - 28);
  let y = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, y, { align: "center" }); y += 5; });

  const head = [
    [
      { content: "Vaqt\n1", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Teplovozlar bo'yicha ma'lumot", colSpan: 2, styles: { halign: "center" as const } },
      { content: "Poyezdlar va tashkilotlar bo'yicha ma'lumot", colSpan: 4, styles: { halign: "center" as const } },
      { content: "Diz.yoqilg'i berishdan\noldingi bakdagi\nqoldiq\n8", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Berilgan diz\nyoqilg'i miqdori\n9", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Umumiy miqdor, kg\n10", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
    ],
    [
      { content: "Seriya\n2", styles: { halign: "center" as const } },
      { content: "Raqami\n3", styles: { halign: "center" as const } },
      { content: "Yo'nalish\n4", styles: { halign: "center" as const } },
      { content: "Poyezd raqami\n5", styles: { halign: "center" as const } },
      { content: "Indeksi\n6", styles: { halign: "center" as const } },
      { content: "Poyezd vazni\n7", styles: { halign: "center" as const } },
    ],
  ];

  const body = rows.map((sub) => {
    const qoldiq = getQoldiq(sub);
    const fuel = getFuel(sub);
    return [
      formatTimestamp(sub.timestamp),
      val((sub as any).seriya ?? (sub as any).korxonaNomi),
      val((sub as any).raqami),
      "Qurilish",
      val((sub as any).poyezdNumber),
      val((sub as any).ruxsatIndeksi),
      val((sub as any).poyezdVazni),
      formatPdfNonZeroNumber(qoldiq, "-"),
      formatPdfNonZeroNumber(fuel, "-"),
      formatPdfNumber(qoldiq + fuel),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y + 4,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.15, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 28 },
      6: { cellWidth: 20 },
      7: { cellWidth: 26, halign: "right" as const },
      8: { cellWidth: 22, halign: "right" as const },
      9: { cellWidth: 22, halign: "right" as const },
    },
  });

  const total = rows.reduce((s, r) => s + getFuel(r), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Jami berildi: ${formatPdfNumber(total)} kg`, 14, fY + 8);
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
      try {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        exportCategoryDetailPdf(todaySubmissions, {
          category: "qurulish",
          fileSlug: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
          titleLine: buildCategoryDetailPdfTitle("qurulish", now),
        });
      }
      finally { setPdfLoading(false); }
    }, 50);
  }, [todaySubmissions]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>;
  if (todaySubmissions.length === 0) return <div className="text-center py-10 opacity-50"><History className="mx-auto mb-2" /> Bugun yozuv yo'q</div>;

  return (
    <>
      <div className="space-y-4">
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

        <div className="hidden md:block bg-background/70 backdrop-blur-md rounded-3xl border-2 border-primary/15 overflow-hidden shadow-lg overflow-x-auto">
          <table className="table-fixed text-left" style={{ minWidth: 960 }}>
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "4%" }} />
            </colgroup>
            <thead className="bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">Vaqt</th>
                <th className="px-3 py-3 whitespace-nowrap">Seriya</th>
                <th className="px-3 py-3 whitespace-nowrap">Raqami</th>
                <th className="px-3 py-3 whitespace-nowrap">Poyezd raqami</th>
                <th className="px-3 py-3 whitespace-nowrap">Index</th>
                <th className="px-3 py-3 whitespace-nowrap">Poyezd vazni</th>
                <th className="px-3 py-3 whitespace-nowrap">Bak qoldig'i</th>
                <th className="px-3 py-3 whitespace-nowrap">Berilgan</th>
                <th className="px-3 py-3 whitespace-nowrap">Hisob</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5 text-sm">
              {todaySubmissions.map((sub) => {
                const qoldiq = getQoldiq(sub);
                const fuel = getFuel(sub);
                return (
                  <tr key={sub.id}>
                    <td className="px-3 py-3 font-bold truncate">{formatTimestamp(sub.timestamp)}</td>
                    <td className="px-3 py-3 font-black truncate">{val((sub as any).seriya ?? (sub as any).korxonaNomi)}</td>
                    <td className="px-3 py-3 font-bold truncate">{val((sub as any).raqami)}</td>
                    <td className="px-3 py-3 font-bold truncate">{val((sub as any).poyezdNumber)}</td>
                    <td className="px-3 py-3 font-bold truncate">{val((sub as any).ruxsatIndeksi)}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{val((sub as any).poyezdVazni)}</td>
                    <td className="px-3 py-3 text-right font-black tabular-nums">{qoldiq ? qoldiq.toLocaleString("uz-UZ") : "-"}</td>
                    <td className="px-3 py-3 text-right font-black tabular-nums">{fuel ? fuel.toLocaleString("uz-UZ") : "-"}</td>
                    <td className="px-3 py-3 text-right font-black tabular-nums">{(qoldiq + fuel).toLocaleString("uz-UZ")}</td>
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

        <div className="md:hidden space-y-3 pb-20">
          {todaySubmissions.map((sub) => {
            const qoldiq = getQoldiq(sub);
            const fuel = getFuel(sub);
            return (
              <div
                key={sub.id}
                className="p-4 rounded-2xl border-2 backdrop-blur-md bg-background/50 border-primary/10"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-black text-base leading-tight">{val((sub as any).seriya ?? (sub as any).korxonaNomi)}-{val((sub as any).raqami)}</h3>
                  <span className="text-xs font-bold opacity-60 ml-2 shrink-0">{formatTimestamp(sub.timestamp)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-[9px] font-black uppercase opacity-60">Poyezd raqami</p><p className="font-bold">{val((sub as any).poyezdNumber)}</p></div>
                  <div><p className="text-[9px] font-black uppercase opacity-60">Index</p><p className="font-bold">{val((sub as any).ruxsatIndeksi)}</p></div>
                  <div><p className="text-[9px] font-black uppercase opacity-60">Poyezd vazni</p><p className="font-bold">{val((sub as any).poyezdVazni)}</p></div>
                  <div><p className="text-[9px] font-black uppercase opacity-60">Bak qoldig'i</p><p className="font-bold">{qoldiq ? qoldiq.toLocaleString("uz-UZ") : "-"} kg</p></div>
                  <div><p className="text-[9px] font-black uppercase opacity-60">Berilgan</p><p className="font-bold">{fuel ? fuel.toLocaleString("uz-UZ") : "-"} kg</p></div>
                  <div><p className="text-[9px] font-black uppercase opacity-60">Hisob</p><p className="font-bold">{(qoldiq + fuel).toLocaleString("uz-UZ")} kg</p></div>
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
            );
          })}
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
