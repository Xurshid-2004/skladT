"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { subscribeToSubmissions } from "@/lib/firebase/submissions-service";
import { useMidnightReset } from "@/lib/hooks/use-midnight-reset";
import { KorxonaSubmission } from "@/lib/types";
import { format } from "date-fns";
import { History, Loader2, Pencil, Download } from "lucide-react";
import { Submission } from "@/lib/types";
import { SubmissionEditDrawer } from "@/components/admin/submission-edit-drawer";
import { buildCategoryDetailPdfTitle, exportCategoryDetailPdf } from "@/lib/pdf/lokomotiv-detail-pdf";
import { formatPdfNumber, parsePdfNumber } from "@/lib/utils/pdf-number";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface KorxonaRecentTableProps {
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

function exportKorxonaPdf(rows: KorxonaSubmission[]) {
  const now = new Date();
  const dateStr = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
  const doc = new jsPDF("landscape", "mm", "a4");
  const W = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const title = `${dateStr} kuni korxonalarga berilgan dizel yoqilg'isi haqida ma'lumot`;
  const lines = doc.splitTextToSize(title, W - 28);
  let y = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, y, { align: "center" }); y += 5; });

  const head = [[
    "Vaqt",
    "Korxona nomi",
    "Poyezd raqami",
    "Index",
    "Qancha (kg)",
    "Necha sutkalik",
    "Mashinada",
    "Mas'ul",
  ]];

  const body = rows.map((sub) => {
    const mashinaStr = sub.mashinadaYetkazildi
      ? (sub.mashinaRaqami ? `Ha · ${sub.mashinaRaqami}` : "Ha")
      : "Yo'q";
    return [
      formatTimestamp(sub.timestamp),
      sub.korxonaNomi,
      sub.poyezdNumber ?? "—",
      sub.ruxsatIndeksi ?? "—",
      formatPdfNumber(sub.qancha),
      String(sub.nechaSutkalik),
      mashinaStr,
      sub.staffName ?? "—",
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y + 4,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [20, 80, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 252, 245] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { cellWidth: 30, halign: "right" as const },
      5: { cellWidth: 24 },
      6: { cellWidth: 28 },
      7: { cellWidth: 40 },
    },
  });

  const total = rows.reduce((s, r) => s + parsePdfNumber(r.qancha ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Jami berildi: ${formatPdfNumber(total)} kg`, 14, fY + 8);
  doc.save(`korxona_${dateStr}.pdf`);
}

export default function KorxonaRecentTable({ stationId }: KorxonaRecentTableProps) {
  const [submissions, setSubmissions] = useState<KorxonaSubmission[]>([]);
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
    const unsubscribe = subscribeToSubmissions(stationId, "korxona", (data) => {
      setSubmissions(data as KorxonaSubmission[]);
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
          category: "korxona",
          fileSlug: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
          titleLine: buildCategoryDetailPdfTitle("korxona", now),
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
        {/* PDF button bar */}
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs font-black uppercase text-muted-foreground">
            Bugun: <span className="text-primary">{todaySubmissions.length}</span> ta yozuv
          </span>
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95"
          >
            {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </button>
        </div>

        {/* Desktop */}
        <div className="hidden md:block bg-background/70 backdrop-blur-md rounded-3xl border-2 border-primary/15 overflow-hidden shadow-lg">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "11%" }} />
            </colgroup>
            <thead className="bg-primary/5 text-[10px] font-black uppercase tracking-widest text-primary">
              <tr>
                <th className="px-4 py-3">Vaqt</th>
                <th className="px-4 py-3">Korxona</th>
                <th className="px-4 py-3">Poyezd</th>
                <th className="px-4 py-3">Index</th>
                <th className="px-4 py-3">Qancha</th>
                <th className="px-4 py-3">Sutka</th>
                <th className="px-4 py-3 text-center">Mashina</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {todaySubmissions.map((sub) => (
                <tr key={sub.id}>
                  <td className="px-4 py-3 font-bold text-sm truncate">{formatTimestamp(sub.timestamp)}</td>
                  <td className="px-4 py-3 font-black truncate">{sub.korxonaNomi}</td>
                  <td className="px-4 py-3 font-bold truncate">{sub.poyezdNumber ?? "—"}</td>
                  <td className="px-4 py-3 font-bold truncate">{sub.ruxsatIndeksi ?? "—"}</td>
                  <td className="px-4 py-3 font-black tabular-nums whitespace-nowrap">{sub.qancha} kg</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">{sub.nechaSutkalik}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    {sub.mashinadaYetkazildi
                      ? <span className="text-blue-600 font-bold">{sub.mashinaRaqami ? `Ha · ${sub.mashinaRaqami}` : "Ha"}</span>
                      : <span className="text-muted-foreground">Yo'q</span>}
                  </td>
                  <td className="px-4 py-3">
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-3 pb-20">
          {todaySubmissions.map((sub) => (
            <div
              key={sub.id}
              className="p-4 rounded-2xl border-2 backdrop-blur-md bg-background/50 border-primary/10"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-black text-base">{sub.korxonaNomi}</h3>
                <span className="text-xs font-bold opacity-60">{formatTimestamp(sub.timestamp)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-[9px] font-black uppercase opacity-60">Qancha</p><p className="font-bold">{sub.qancha} kg</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Poyezd</p><p className="font-bold">{sub.poyezdNumber ?? "—"}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Index</p><p className="font-bold">{sub.ruxsatIndeksi ?? "—"}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Sutka</p><p className="font-bold">{sub.nechaSutkalik}</p></div>
                <div><p className="text-[9px] font-black uppercase opacity-60">Mashina</p>
                  <p className="font-bold text-xs">
                    {sub.mashinadaYetkazildi ? (sub.mashinaRaqami ? sub.mashinaRaqami : "Ha") : "Yo'q"}
                  </p>
                </div>
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
          setSubmissions(prev => prev.map(s => s.id === updated.id ? (updated as unknown as KorxonaSubmission) : s));
          setEditOpen(false);
        }}
      />
    </>
  );
}
