"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { subscribeToSubmissions } from "@/lib/firebase/submissions-service";
import { useMidnightReset } from "@/lib/hooks/use-midnight-reset";
import { TamirlashSubmission } from "@/lib/types";
import { format } from "date-fns";
import { History, Loader2, Pencil, Download } from "lucide-react";
import { Submission } from "@/lib/types";
import { SubmissionEditDrawer } from "@/components/admin/submission-edit-drawer";
import { buildCategoryDetailPdfTitle, exportCategoryDetailPdf } from "@/lib/pdf/lokomotiv-detail-pdf";
import { formatPdfNonZeroNumber, formatPdfNumber, parsePdfNumber } from "@/lib/utils/pdf-number";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TamirlashRecentTableProps {
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

const TAMIR_LABEL: Record<string, string> = {
  katta: "Katta ta'mirlash",
  kichik: "Kichik ta'mirlash",
  profilaktika: "Profilaktika",
};

function exportTamirlashPdf(rows: TamirlashSubmission[]) {
  const now = new Date();
  const dateStr = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
  const doc = new jsPDF("landscape", "mm", "a4");
  const W = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const title = `${dateStr} kuni teplovozlar ta'mirlashiga berilgan dizel yoqilg'isi haqida ma'lumot`;
  const lines = doc.splitTextToSize(title, W - 28);
  let y = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, y, { align: "center" }); y += 5; });

  const head = [[
    "Vaqt",
    "Seriya",
    "Raqami",
    "Ta'mirlash Turi",
    "Qancha Berildi (kg)",
    "Diz Masla (kg)",
    "Mas'ul shaxs",
    "Mashinada yetkazildi",
  ]];

  const body = rows.map((sub) => {
    const mashinaStr = sub.mashinadaYetkazildi
      ? (sub.mashinaRaqami ? `Ha · ${sub.mashinaRaqami}` : "Ha")
      : "Yo'q";
    return [
      formatTimestamp(sub.timestamp),
      sub.seriya,
      sub.raqami,
      TAMIR_LABEL[sub.tamirlashTuri] ?? sub.tamirlashTuri,
      formatPdfNonZeroNumber(sub.qanchaBerildi, "—"),
      formatPdfNonZeroNumber(sub.dizMasla, "—"),
      sub.masulShaxs,
      mashinaStr,
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y + 4,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [80, 60, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [252, 250, 242] },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 38 },
      4: { cellWidth: 32, halign: "right" as const },
      5: { cellWidth: 28, halign: "right" as const },
      6: { cellWidth: 50 },
      7: { cellWidth: 32 },
    },
  });

  const totalFuel = rows.reduce((s, r) => s + parsePdfNumber(r.qanchaBerildi ?? 0), 0);
  const totalMasla = rows.reduce((s, r) => s + parsePdfNumber(r.dizMasla ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Jami yoqilg'i: ${formatPdfNumber(totalFuel)} kg`, 14, fY + 8);
  if (totalMasla > 0) {
    doc.text(`Jami diz masla: ${formatPdfNumber(totalMasla)} kg`, 14, fY + 14);
  }
  doc.save(`tamirlash_${dateStr}.pdf`);
}

export default function TamirlashRecentTable({ stationId }: TamirlashRecentTableProps) {
  const [submissions, setSubmissions] = useState<TamirlashSubmission[]>([]);
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
    const unsubscribe = subscribeToSubmissions(stationId, 'tamirlash', (data) => {
      setSubmissions(data as TamirlashSubmission[]);
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
          category: "tamirlash",
          fileSlug: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
          titleLine: buildCategoryDetailPdfTitle("tamirlash", now),
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
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 text-white bg-amber-700 hover:bg-amber-800 active:scale-95"
        >
          {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          PDF
        </button>
      </div>

      <div className="hidden md:block bg-background/70 backdrop-blur-md rounded-3xl border-2 border-primary/15 overflow-hidden shadow-lg">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col style={{ width: "11%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead className="bg-primary/5 text-[10px] font-black uppercase tracking-widest text-primary">
            <tr>
              <th className="px-6 py-4">Vaqt</th>
              <th className="px-6 py-4">Seriya/Raqam</th>
              <th className="px-6 py-4">Ta'mir turi</th>
              <th className="px-6 py-4">Berildi (kg)</th>
              <th className="px-6 py-4">Diz Masla</th>
              <th className="px-6 py-4 text-center">Mashina</th>
              <th className="px-6 py-4">Mas'ul</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {todaySubmissions.map((sub) => (
              <tr key={sub.id}>
                <td className="px-6 py-4 font-bold truncate">{formatTimestamp(sub.timestamp)}</td>
                <td className="px-6 py-4 font-black truncate">{sub.seriya}-{sub.raqami}</td>
                <td className="px-6 py-4 text-xs font-black uppercase truncate">{sub.tamirlashTuri}</td>
                <td className="px-6 py-4 text-right font-black tabular-nums whitespace-nowrap">{sub.qanchaBerildi} kg</td>
                <td className="px-6 py-4 text-right font-bold tabular-nums whitespace-nowrap">{sub.dizMasla || 0} kg</td>
                <td className="px-6 py-4 text-center text-sm">
                  {sub.mashinadaYetkazildi
                    ? <span className="text-blue-600 font-bold">{sub.mashinaRaqami ? sub.mashinaRaqami : "Ha"}</span>
                    : <span className="text-muted-foreground">Yo'q</span>}
                </td>
                <td className="px-6 py-4 text-xs font-bold truncate">{sub.masulShaxs}</td>
                <td className="px-6 py-4">
                  {isToday(sub.timestamp) && (
                    <button onClick={() => { setEditSub(sub as unknown as Submission); setEditOpen(true); }}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4 pb-20">
        {todaySubmissions.map((sub) => (
          <div key={sub.id} className="p-6 rounded-3xl border-2 border-primary/15 bg-background/70 backdrop-blur-md shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-black text-lg">{sub.seriya}-{sub.raqami}</h3>
              <span className="text-xs font-bold opacity-60">{formatTimestamp(sub.timestamp)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-[10px] font-black uppercase opacity-60">Ta'mir turi</p><p className="font-bold uppercase">{sub.tamirlashTuri}</p></div>
              <div><p className="text-[10px] font-black uppercase opacity-60">Berildi</p><p className="font-bold">{sub.qanchaBerildi} kg</p></div>
              <div><p className="text-[10px] font-black uppercase opacity-60">Diz Masla</p><p className="font-bold">{sub.dizMasla || 0} kg</p></div>
              <div><p className="text-[10px] font-black uppercase opacity-60">Mashina</p>
                <p className="font-bold text-xs">
                  {sub.mashinadaYetkazildi ? (sub.mashinaRaqami ? sub.mashinaRaqami : "Ha") : "Yo'q"}
                </p>
              </div>
              <div className="col-span-2"><p className="text-[10px] font-black uppercase opacity-60">Mas'ul</p><p className="font-bold">{sub.masulShaxs}</p></div>
            </div>
            {isToday(sub.timestamp) && (
              <div className="mt-4 pt-4 border-t border-primary/5 flex justify-end">
                <button onClick={() => { setEditSub(sub as unknown as Submission); setEditOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black uppercase transition-all active:scale-95">
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
          setSubmissions(prev => prev.map(s => s.id === updated.id ? (updated as unknown as TamirlashSubmission) : s));
          setEditOpen(false);
        }}
      />
    </>
  );
}
