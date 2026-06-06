"use client";

import { useEffect, useState, useMemo, useCallback, useTransition } from "react";
import { useMidnightReset } from "@/lib/hooks/use-midnight-reset";
import { useStaffMap } from "@/lib/hooks/use-staff-map";
import {
  collection, query, where, orderBy,
  getDocs, onSnapshot, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Submission, LokomotivSubmission, Category } from "@/lib/types";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { downloadErjuYpdf } from "@/lib/pdf/erju-malumotnoma-html";
import {
  buildCategoryDetailPdfTitle,
  buildLokomotivDetailPdfTitle,
  exportCategoryDetailPdf,
  exportLokomotivDetailPdf,
} from "@/lib/pdf/lokomotiv-detail-pdf";
import type { FuelRecord } from "@/lib/pdf/erju-html-pdf";
import { pdfText } from "@/lib/utils/pdf-text";
import { formatPdfNonZeroNumber, formatPdfNumber, parsePdfNumber } from "@/lib/utils/pdf-number";
import { PDF_CYRILLIC_FONT, useCyrillicPdfFont } from "@/lib/pdf/cyrillic-font";
import { SubmissionEditDrawer } from "@/components/admin/submission-edit-drawer";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Loader2, Download, Car, Pencil,
  History, ChevronLeft, ChevronRight,
} from "lucide-react";

interface LokomotivRecentTableProps {
  stationId: string;
}

// ── constants ──────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  lokomotiv: "Lokomotiv",
  korxona:   "Korxona",
  qurulish:  "Qurulish",
  tamirlash: "Ta'mirlash",
};

const CAT_COLOR: Record<string, string> = {
  lokomotiv: "text-primary bg-primary/10",
  korxona:   "text-accent bg-accent/10",
  qurulish:  "text-warning bg-warning/10",
  tamirlash: "text-slate-500 bg-slate-100 dark:bg-slate-800",
};

const RECENT_FILTER_LABEL: Record<string, string> = {
  all:       "ВСЕ",
  lokomotiv: "ЛОКОМОТИВ",
  korxona:   "ПРЕДПРИЯТИЕ",
  qurulish:  "СТРОИТЕЛЬСТВО",
  tamirlash: "РЕМОНТ",
};

const RECENT_FILTER_BG: Record<string, string> = {
  all:       "#2f80ed",
  lokomotiv: "#7c3aed",
  korxona:   "#059669",
  qurulish:  "#f59e0b",
  tamirlash: "#e11d48",
};

const RECENT_PDF_LABEL: Record<string, string> = {
  all: "PDF",
  lokomotiv: "LOK PDF",
  korxona: "PRED PDF",
  qurulish: "STROY PDF",
  tamirlash: "REM PDF",
};

const HARAKAT_LABEL: Record<string, string> = {
  yuk:      "Yuk",
  manyovr:  "Manyovr",
  yolovchi: "Yo'lovchi",
  xojalik:  "Xo'jalik",
  ijara:    "Ijara",
  arenda:   "Ijara",
};

const PAGE_SIZE = 20;

function renderMashinaCell(s: any) {
  if (!s.mashinadaYetkazildi) {
    return <span className="block text-center text-gray-500 text-[10px] font-bold">Yo'q</span>;
  }

  return (
    <span className="mx-auto flex w-full min-w-0 items-center justify-center gap-0.5 text-blue-400 font-black text-[10px]">
      <Car className="h-3 w-3 shrink-0" />
      <span className="min-w-0 truncate">{s.mashinaRaqami ?? "Ha"}</span>
    </span>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtTime(ts: any): string {
  if (!ts) return "—";
  const d = typeof ts?.toDate === "function" ? ts.toDate() : new Date(Number(ts));
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toIsoDateLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getAmount(s: any): number {
  return parsePdfNumber(s.qanchaBerildi ?? s.qancha ?? s.qanchaOlindi ?? 0);
}

function cellVal(raw: unknown, fallback = "—"): string {
  if (raw == null || String(raw) === "") return fallback;
  return String(raw);
}

type PdfStationStaffGroup = {
  stationId: string;
  staffName: string;
  rows: any[];
};

function pdfStaffGroupName(row: any, staffMap: Map<string, string>) {
  const code = String(row?.staffCode ?? "").trim();
  const byCode = code ? staffMap.get(code) : undefined;
  return String(byCode ?? row?.staffName ?? code ?? "").trim();
}

function pdfStaffGroupKey(row: any) {
  const code = String(row?.staffCode ?? "").trim();
  if (code) return `code:${code}`;

  const name = String(row?.staffName ?? "").trim();
  if (name) return `name:${name.toLowerCase()}`;

  return "unknown";
}

function groupRowsByStationAndStaff(rows: any[], staffMap: Map<string, string>): PdfStationStaffGroup[] {
  const groups = new Map<string, PdfStationStaffGroup>();

  for (const row of rows) {
    const stationId = String(row?.stationId ?? "other");
    const groupKey = `${stationId}__${pdfStaffGroupKey(row)}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        stationId,
        staffName: pdfStaffGroupName(row, staffMap),
        rows: [],
      });
    }
    groups.get(groupKey)!.rows.push(row);
  }

  return [...groups.values()];
}

function rowCreatedMs(row: any): number {
  const ts = row?.timestamp ?? row?.createdAt;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();

  const numeric = Number(ts);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const date = String(row?.dateISO ?? row?.date ?? "").trim();
  const time = String(row?.time ?? "").trim();
  const parsed = date && time ? Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}`) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortRowsOldestFirst<T>(rows: T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = rowCreatedMs(a.row) - rowCreatedMs(b.row);
      return diff || a.index - b.index;
    })
    .map(({ row }) => row);
}

function buildPdfTitle(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} sutkasi mobaynida tarqatilgan dizel yoqilg'isi tarqatilishi haqida ma'lumot`;
}

function buildErjuTitle(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} сведения о распределении дизельного топлива за сутки`;
}

// ── PDF export ─────────────────────────────────────────────────────────────────

function exportPDF(rows: any[], fileSlug: string, titleLine: string, staffMap: Map<string, string>) {
  const sortedRows = sortRowsOldestFirst(rows);
  const doc = new jsPDF("landscape", "mm", "a4");
  useCyrillicPdfFont(doc);
  const W   = doc.internal.pageSize.width;
  const tableWidth = 214;
  const tableMarginX = (W - tableWidth) / 2;
  doc.setFontSize(9);
  doc.setFont(PDF_CYRILLIC_FONT, "bold");
  const lines = doc.splitTextToSize(titleLine, tableWidth);
  let y = 8.5;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, y, { align: "center" }); y += 4.2; });
  doc.setFont(PDF_CYRILLIC_FONT, "normal");

  const head = [
    [
      { content: "Vaqt\n1", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Teplovozlar bo'yicha ma'lumot", colSpan: 2, styles: { halign: "center" as const } },
      { content: "Poyezdlar va tashkilotlar bo'yicha ma'lumot", colSpan: 4, styles: { halign: "center" as const } },
      { content: "Diz.Yoqilg'i berishdan\noldingi bakdagi\nqoldiq\n8", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Berilgan diz\nyoqilg'i miqdori\n9", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Umumiy miqdor,\nkg\n10", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
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

  const body: any[] = [];
  for (const group of groupRowsByStationAndStaff(sortedRows, staffMap)) {
    const sid = group.stationId;
    const stRows = group.rows;
    const nm = ZAPRAVKALAR.find(z => z.id === sid)?.name ?? sid;
    const headerLabel = group.staffName ? `${nm} - ${group.staffName}` : nm;
    const tot = stRows.reduce((a, r) => a + getAmount(r), 0);
    const hBg: [number,number,number] = [210,220,210];
    const hFg: [number,number,number] = [30,60,30];
    const hp = { top:0.8, bottom:0.8, left:2.2, right:2 };

    body.push([
      { content: pdfText(headerLabel), colSpan: 5, styles: { halign:"left" as const, fontStyle:"bold" as const, fontSize:8, fillColor:hBg, textColor:hFg, cellPadding:hp } },
      { content: `итого: ${formatPdfNumber(tot)} кг`, colSpan: 5, styles: { halign:"right" as const, fontStyle:"italic" as const, fontSize:7, fillColor:hBg, textColor:hFg, cellPadding:hp } },
    ]);
    for (const s of stRows) {
      const amount = getAmount(s);
      const qoldiq = parsePdfNumber(s.qoldiq ?? 0);
      const hisob  = qoldiq + amount;
      const pn = s.harakatTuri === "manyovr"
        ? String(s.stansiya ?? "—")
        : s.harakatTuri === "xojalik"
          ? String(s.tashkilot ?? "—")
          : String(s.poyezdNumber ?? "—");
      const indexVal = String(s.ruxsatIndeksi ?? "—");
      body.push([
        fmtTime(s.timestamp),
        pdfText(s.rusumi ?? s.seriya),
        pdfText(s.lokomotivNumber ?? s.raqami),
        pdfText(HARAKAT_LABEL[s.harakatTuri] ?? s.harakatTuri ?? s.tamirlashTuri ?? s.category),
        pdfText(pn),
        pdfText(indexVal),
        s.poyezdVazni != null && String(s.poyezdVazni) !== "" ? String(s.poyezdVazni) : "—",
        formatPdfNonZeroNumber(qoldiq, "—"),
        formatPdfNonZeroNumber(amount, "—"),
        formatPdfNumber(hisob),
      ]);
    }
  }

  autoTable(doc, {
    head, body, startY: y + 1,
    theme: "grid",
    styles:             { font: PDF_CYRILLIC_FONT, fontSize:6.1, cellPadding:0.55, valign:"middle", lineColor:[0,0,0], lineWidth:0.18 },
    headStyles:         { font: PDF_CYRILLIC_FONT, fillColor:[255,255,255], textColor:[0,0,0], fontStyle:"bold", fontSize:6.1, lineColor:[0,0,0], lineWidth:0.25, cellPadding:0.55 },
    alternateRowStyles: { fillColor:[250,250,250] },
    columnStyles: {
      0:{cellWidth:14}, 1:{cellWidth:20}, 2:{cellWidth:18},
      3:{cellWidth:22}, 4:{cellWidth:22}, 5:{cellWidth:28},
      6:{cellWidth:20}, 7:{cellWidth:26,halign:"right" as const},
      8:{cellWidth:22,halign:"right" as const}, 9:{cellWidth:22,halign:"right" as const},
    },
    tableWidth,
    margin: { left: tableMarginX, right: tableMarginX },
  });

  const grand = sortedRows.reduce((s:number,r:any)=>s+getAmount(r),0);
  const mg=tableMarginX, fY=(doc as any).lastAutoTable?.finalY??100, pH=doc.internal.pageSize.height;
  let gY=fY+10; if(gY>pH-mg){doc.addPage();gY=mg;}
  doc.setFontSize(8); doc.setFont(PDF_CYRILLIC_FONT,"bold");
  doc.text(`Общий итог топлива: ${formatPdfNumber(grand)} кг`, mg, gY, {align:"left"});
  doc.save(`hisobot_${fileSlug}.pdf`);
}

// ── Korxona PDF ────────────────────────────────────────────────────────────────

function exportKorxonaCatPdf(rows: any[]) {
  const sortedRows = sortRowsOldestFirst(rows);
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

  const head = [["Vaqt", "Korxona nomi", "Poyezd raqami", "Index", "Qancha (kg)", "Necha sutkalik", "Mashinada", "Mas'ul"]];

  const body = sortedRows.map((sub) => {
    const mashinaStr = sub.mashinadaYetkazildi
      ? (sub.mashinaRaqami ? `Ha · ${sub.mashinaRaqami}` : "Ha")
      : "Yo'q";
    return [
      fmtTime(sub.timestamp),
      sub.korxonaNomi,
      sub.poyezdNumber ?? "—",
      sub.ruxsatIndeksi ?? "—",
      formatPdfNumber(sub.qancha ?? 0),
      String(sub.nechaSutkalik ?? "—"),
      mashinaStr,
      sub.staffName ?? "—",
    ];
  });

  autoTable(doc, {
    head, body, startY: y + 4, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [20, 80, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 252, 245] },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 50 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 },
      4: { cellWidth: 30, halign: "right" as const }, 5: { cellWidth: 24 },
      6: { cellWidth: 28 }, 7: { cellWidth: 40 },
    },
  });

  const total = sortedRows.reduce((s, r) => s + parsePdfNumber(r.qancha ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`Jami berildi: ${formatPdfNumber(total)} kg`, 14, fY + 8);
  doc.save(`korxona_${dateStr}.pdf`);
}

// ── Qurulish PDF ───────────────────────────────────────────────────────────────

function exportQurulishCatPdf(rows: any[]) {
  const sortedRows = sortRowsOldestFirst(rows);
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

  const head = [
    [
      { content: "Vaqt\n1", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
      { content: "Teplovozlar bo'yicha ma'lumot", colSpan: 2, styles: { halign: "center" as const } },
      { content: "Poyezdlar va tashkilotlar bo'yicha ma'lumot", colSpan: 4, styles: { halign: "center" as const } },
      { content: "Diz.Yoqilg'i berishdan\noldingi bakdagi\nqoldiq\n8", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
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

  const body = sortedRows.map((sub) => {
    const amount = getAmount(sub);
    const qoldiq = parsePdfNumber(sub.qoldiq ?? 0);
    const hisob = qoldiq + amount;
    return [
      fmtTime(sub.timestamp),
      cellVal(sub.seriya ?? sub.korxonaNomi),
      cellVal(sub.raqami),
      "Qurilish",
      cellVal(sub.poyezdNumber),
      cellVal(sub.ruxsatIndeksi),
      cellVal(sub.poyezdVazni),
      formatPdfNonZeroNumber(qoldiq, "—"),
      formatPdfNonZeroNumber(amount, "—"),
      formatPdfNumber(hisob),
    ];
  });

  autoTable(doc, {
    head, body, startY: y + 4, theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.15, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 20 }, 2: { cellWidth: 18 },
      3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 28 },
      6: { cellWidth: 20 }, 7: { cellWidth: 26, halign: "right" as const },
      8: { cellWidth: 22, halign: "right" as const }, 9: { cellWidth: 22, halign: "right" as const },
    },
  });

  const total = sortedRows.reduce((s, r) => s + getAmount(r), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`Jami berildi: ${formatPdfNumber(total)} kg`, 14, fY + 8);
  doc.save(`qurulish_${dateStr}.pdf`);
}

// ── Tamirlash PDF ──────────────────────────────────────────────────────────────

const TAMIR_LABEL: Record<string, string> = {
  katta: "Katta ta'mirlash",
  kichik: "Kichik ta'mirlash",
  profilaktika: "Profilaktika",
};

function exportTamirlashCatPdf(rows: any[]) {
  const sortedRows = sortRowsOldestFirst(rows);
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

  const head = [["Vaqt", "Seriya", "Raqami", "Ta'mirlash Turi", "Qancha Berildi (kg)", "Diz Masla (kg)", "Mas'ul shaxs", "Mashinada yetkazildi"]];

  const body = sortedRows.map((sub) => {
    const mashinaStr = sub.mashinadaYetkazildi
      ? (sub.mashinaRaqami ? `Ha · ${sub.mashinaRaqami}` : "Ha")
      : "Yo'q";
    return [
      fmtTime(sub.timestamp),
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
    head, body, startY: y + 4, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [80, 60, 20], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [252, 250, 242] },
    columnStyles: {
      0: { cellWidth: 16 }, 1: { cellWidth: 24 }, 2: { cellWidth: 20 },
      3: { cellWidth: 38 }, 4: { cellWidth: 32, halign: "right" as const },
      5: { cellWidth: 28, halign: "right" as const }, 6: { cellWidth: 50 }, 7: { cellWidth: 32 },
    },
  });

  const totalFuel = sortedRows.reduce((s, r) => s + parsePdfNumber(r.qanchaBerildi ?? 0), 0);
  const totalMasla = sortedRows.reduce((s, r) => s + parsePdfNumber(r.dizMasla ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text(`Jami yoqilg'i: ${formatPdfNumber(totalFuel)} kg`, 14, fY + 8);
  if (totalMasla > 0) {
    doc.text(`Jami diz masla: ${formatPdfNumber(totalMasla)} kg`, 14, fY + 14);
  }
  doc.save(`tamirlash_${dateStr}.pdf`);
}

// ── component ──────────────────────────────────────────────────────────────────

export default function LokomotivRecentTable({ stationId }: LokomotivRecentTableProps) {
  const staffMap = useStaffMap();
  const [subs,        setSubs]        = useState<Submission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [category,    setCategory]    = useState<Category | "all">("all");
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [ypdfLoading, setYpdfLoading] = useState(false);
  const [page,        setPage]        = useState(1);
  const [editSub,     setEditSub]     = useState<Submission | null>(null);
  const [editOpen,    setEditOpen]    = useState(false);
  const [,            startTransition] = useTransition();

  const dateKey = useMidnightReset();

  // ── bugun chegaralari — dateKey o'zgarganda qayta hisoblanadi (soat 00:00) ──
  const { todayStart, todayEnd } = useMemo(() => {
    const s = new Date(); s.setHours(0,0,0,0);
    const e = new Date(); e.setHours(23,59,59,999);
    return { todayStart: s, todayEnd: e };
  }, [dateKey]);

  // ── fetch — faqat bugungi shu stansiya ────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setSubs([]);

    const q = query(
      collection(db, "submissions"),
      where("stationId", "==", stationId),
      orderBy("timestamp", "desc"),
      limit(500),
    );

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Submission[];
      const today = all.filter(s => {
        const ts = typeof (s as any).timestamp?.toDate === "function"
          ? (s as any).timestamp.toDate().getTime()
          : Number((s as any).timestamp ?? 0);
        return ts >= todayStart.getTime() && ts <= todayEnd.getTime();
      });
      setSubs(today);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [stationId, todayStart, todayEnd]);

  // ── filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (category === "all") return subs;
    return subs.filter(s => s.category === category);
  }, [subs, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = useMemo(() => filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE), [filtered, page]);
  const totalFuel  = useMemo(() => filtered.reduce((s,r)=>s+getAmount(r),0), [filtered]);

  function switchCat(cat: Category | "all") {
    startTransition(() => { setCategory(cat); setPage(1); });
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  const handlePdf = useCallback(() => {
    if (!filtered.length) return;
    setPdfLoading(true);
    setTimeout(() => {
      try {
        if (category === "korxona") {
          const now = new Date(); now.setHours(0,0,0,0);
          exportCategoryDetailPdf(filtered, {
            category: "korxona",
            fileSlug: toIsoDateLocal(now),
            titleLine: buildCategoryDetailPdfTitle("korxona", now),
            staffMap,
          });
        } else if (category === "qurulish") {
          const now = new Date(); now.setHours(0,0,0,0);
          exportCategoryDetailPdf(filtered, {
            category: "qurulish",
            fileSlug: toIsoDateLocal(now),
            titleLine: buildCategoryDetailPdfTitle("qurulish", now),
            staffMap,
          });
        } else if (category === "tamirlash") {
          const now = new Date(); now.setHours(0,0,0,0);
          exportCategoryDetailPdf(filtered, {
            category: "tamirlash",
            fileSlug: toIsoDateLocal(now),
            titleLine: buildCategoryDetailPdfTitle("tamirlash", now),
            staffMap,
          });
        } else if (category === "lokomotiv") {
          const now = new Date(); now.setHours(0,0,0,0);
          exportLokomotivDetailPdf(filtered, {
            fileSlug: toIsoDateLocal(now),
            titleLine: buildLokomotivDetailPdfTitle(now),
            staffMap,
          });
        } else {
          const now = new Date(); now.setHours(0,0,0,0);
          exportPDF(filtered, toIsoDateLocal(now), buildPdfTitle(now), staffMap);
        }
      } finally { setPdfLoading(false); }
    }, 50);
  }, [filtered, category, staffMap]);

  const handleYpdf = useCallback(async () => {
    setYpdfLoading(true);
    try {
      const now = new Date(); now.setHours(0,0,0,0);
      const iso = toIsoDateLocal(now);
      // Compound index talab qilmasin: faqat locCode bo'yicha filtr, sanani JS da tekshiramiz
      const fuelSnap = await getDocs(query(
        collection(db,"fuelRecords"),
        where("locCode","==",stationId),
        limit(4000),
      ));
      const sourceRows = fuelSnap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter((r:any) => r.date === iso) as FuelRecord[];
      downloadErjuYpdf(sourceRows, buildErjuTitle(now), [], []);
    } catch(e){ console.error("Y.PDF:",e); }
    finally { setYpdfLoading(false); }
  }, [stationId]);

  const handleSaved = useCallback((updated: Submission) => {
    setSubs(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  // ── loading / empty ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-9 h-9 animate-spin text-primary" />
      <p className="text-muted-foreground font-bold animate-pulse text-sm">Yuklanmoqda...</p>
    </div>
  );

  if (!subs.length) return (
    <div className="text-center py-20 rounded-3xl border-2 border-dashed border-primary/20">
      <History className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
      <p className="text-lg text-muted-foreground font-bold uppercase">Bugun yozuv yo'q</p>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Filter bar — admin panelidagi kabi ── */}
      <div className="rounded-2xl bg-black px-4 py-3 flex flex-wrap gap-3 items-center shadow-[0_14px_32px_rgba(15,23,42,0.22)]">

        {/* Kategoriya pills */}
        <div className="flex gap-2.5 flex-wrap">
          {(["all", "lokomotiv", "korxona", "qurulish", "tamirlash"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => switchCat(cat)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] sm:text-sm font-black uppercase tracking-wide text-white whitespace-nowrap min-w-[132px] border-2 transition-none shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_8px_18px_rgba(0,0,0,0.22)]"
              style={{
                background: RECENT_FILTER_BG[cat],
                borderColor: category === cat ? "#ffffff" : "rgba(255,255,255,0.18)",
                boxShadow: category === cat
                  ? "inset 0 0 0 3px rgba(255,255,255,0.92), 0 10px 22px rgba(47,128,237,0.35)"
                  : "inset 0 1px 0 rgba(255,255,255,0.24), 0 8px 18px rgba(0,0,0,0.22)",
              }}
            >
              {category === cat && (
                <span className="h-3 w-3 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)]" />
              )}
              {RECENT_FILTER_LABEL[cat]}
            </button>
          ))}
        </div>

      </div>

      {/* ── Qorong'i jadval ── */}
      <div className="rounded-2xl overflow-hidden shadow-2xl border border-[#2a3a2a]" style={{ background: "#111c11" }}>

        {/* Top bar */}
        <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3" style={{ background: "#0d160d" }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-white font-black text-sm">
              Jami yozuvlar: <span className="text-yellow-400">{filtered.length}</span>
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              Bugun · {ZAPRAVKALAR.find(z=>z.id===stationId)?.name ?? stationId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePdf} disabled={!filtered.length || pdfLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 text-white"
              style={{ background: "#059669" }}>
              {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {RECENT_PDF_LABEL[category] ?? "PDF"}
            </button>
            {category === "all" && (
              <button onClick={handleYpdf} disabled={ypdfLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 text-white"
                style={{ background: "#9333ea" }}>
                {ypdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Y.PDF
              </button>
            )}
          </div>
        </div>

        {/* Empty filtered */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <History className="w-8 h-8 text-gray-600" />
            <p className="text-gray-400 font-black uppercase text-sm">Ma'lumot topilmadi</p>
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="w-full overflow-x-auto">

            {/* ── KORXONA ── */}
            {category === "korxona" && (
              <table className="w-full table-fixed border-collapse" style={{ minWidth: 940 }}>
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#eab308" }}>
                    {["№","VAQT","KORXONA NOMI","P.RAQ","INDEX","QANCHA","SUTKA","MASHINA","MAS'UL","AMAL"].map((lbl, i) => (
                      <th key={lbl}
                        className="px-1.5 py-2 text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-tight select-none overflow-hidden"
                        style={{ color:"#b91c1c", borderLeft: i>0?"1px solid rgba(255,255,255,0.35)":undefined }}>
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sub, i) => {
                    const s = sub as any;
                    const rowNum = (page-1)*PAGE_SIZE + i + 1;
                    const rowBg = i%2===0 ? "#111c11" : "#0f190f";
                    const amount = parsePdfNumber(s.qancha ?? 0);
                    const td = (content: React.ReactNode, align:"left"|"right"|"center"="left", idx=0) => (
                      <td className="px-1.5 py-2 align-middle overflow-hidden"
                        style={{ borderLeft:idx>0?"1px solid rgba(255,255,255,0.07)":undefined, textAlign:align }}>
                        {content}
                      </td>
                    );
                    return (
                      <tr key={sub.id} style={{ background:rowBg }} className="hover:brightness-125 transition-all">
                        {td(<span className="text-gray-500 font-bold text-[10px]">{rowNum}</span>,"center")}
                        {td(<span className="text-yellow-400 font-black text-[10px] tabular-nums">{fmtTime(s.timestamp)}</span>,"left",1)}
                        {td(<span className="text-cyan-400 font-black text-[10px] block truncate">{s.korxonaNomi ?? "—"}</span>,"left",2)}
                        {td(<span className="text-gray-300 font-bold text-[10px] block truncate">{s.poyezdNumber ?? "—"}</span>,"left",3)}
                        {td(<span className="text-purple-300 font-bold text-[10px] block truncate">{s.ruxsatIndeksi ?? "—"}</span>,"left",4)}
                        {td(<span className="font-black text-[11px] tabular-nums text-lime-300">{amount.toLocaleString("uz-UZ")}</span>,"right",5)}
                        {td(<span className="text-gray-300 font-bold text-[10px]">{s.nechaSutkalik ?? "—"}</span>,"center",6)}
                        {td(renderMashinaCell(s), "center", 7)}
                        {td(
                          <span className="text-emerald-300 font-black text-[10px] block truncate">
                            {staffMap.get(String(s.staffCode ?? "").trim()) ?? s.staffName ?? "—"}
                          </span>,"left",8
                        )}
                        {td(
                          <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                            className="w-7 h-7 grid place-items-center rounded-lg transition-colors"
                            style={{ background:"rgba(99,102,241,0.12)" }} aria-label="Tahrirlash">
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </button>,"center",9
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── QURULISH ── */}
            {category === "qurulish" && (
              <table className="w-full table-fixed border-collapse" style={{ minWidth: 980 }}>
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#eab308" }}>
                    {["№","VAQT","SERIYA","RAQAMI","P.RAQ","INDEX","P.VAZNI","QOLDIQ","YOQILG'I","HISOB","AMAL"].map((lbl, i) => (
                      <th key={lbl}
                        className="px-1.5 py-2 text-[8px] font-black uppercase tracking-tight leading-tight select-none whitespace-nowrap"
                        style={{ color:"#b91c1c", borderLeft: i>0?"1px solid rgba(255,255,255,0.35)":undefined }}>
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sub, i) => {
                    const s = sub as any;
                    const rowNum = (page-1)*PAGE_SIZE + i + 1;
                    const rowBg = i%2===0 ? "#111c11" : "#0f190f";
                    const amount = getAmount(s);
                    const qoldiq = parsePdfNumber(s.qoldiq ?? 0);
                    const hisob = qoldiq + amount;
                    const poyezdDisplay = s.harakatTuri === "manyovr"
                      ? (s.stansiya ?? "—")
                      : s.harakatTuri === "xojalik"
                        ? (s.tashkilot ?? "—")
                        : (s.poyezdNumber ?? "—");
                    const td = (content: React.ReactNode, align:"left"|"right"|"center"="left", idx=0) => (
                      <td className="px-1.5 py-2 align-middle overflow-hidden"
                        style={{ borderLeft:idx>0?"1px solid rgba(255,255,255,0.07)":undefined, textAlign:align }}>
                        {content}
                      </td>
                    );
                    return (
                      <tr key={sub.id} style={{ background:rowBg }} className="hover:brightness-125 transition-all">
                        {td(<span className="text-gray-500 font-bold text-[10px]">{rowNum}</span>,"center")}
                        {td(<span className="text-yellow-400 font-black text-[10px] tabular-nums">{fmtTime(s.timestamp)}</span>,"left",1)}
                        {td(<span className="text-cyan-400 font-black text-[10px] block truncate">{cellVal(s.seriya ?? s.korxonaNomi)}</span>,"left",2)}
                        {td(<span className="text-white font-bold text-[10px] block truncate">{cellVal(s.raqami)}</span>,"left",3)}
                        {td(<span className="text-gray-300 font-bold text-[10px] tabular-nums block truncate">{cellVal(poyezdDisplay)}</span>,"left",4)}
                        {td(<span className="text-purple-300 font-bold text-[10px] block truncate">{cellVal(s.ruxsatIndeksi)}</span>,"left",5)}
                        {td(<span className="text-gray-300 font-bold text-[10px] tabular-nums">{cellVal(s.poyezdVazni)}</span>,"right",6)}
                        {td(<span className="text-amber-200 font-black text-[10px] tabular-nums">{qoldiq ? qoldiq.toLocaleString("uz-UZ") : "—"}</span>,"right",7)}
                        {td(<span className="font-black text-[11px] tabular-nums text-lime-300">{amount ? amount.toLocaleString("uz-UZ") : "—"}</span>,"right",8)}
                        {td(<span className="text-cyan-200 font-black text-[11px] tabular-nums">{hisob.toLocaleString("uz-UZ")}</span>,"right",9)}
                        {td(
                          <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                            className="w-7 h-7 grid place-items-center rounded-lg transition-colors"
                            style={{ background:"rgba(99,102,241,0.12)" }} aria-label="Tahrirlash">
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </button>,"center",10
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── TAMIRLASH ── */}
            {category === "tamirlash" && (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "8%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#eab308" }}>
                    {["№","VAQT","SERIYA","RAQAMI","TA'MIR TURI","QANCHA","DIZ.MASLA","MAS'UL","MASHINA","AMAL"].map((lbl, i) => (
                      <th key={lbl}
                        className="px-1.5 py-2 text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-tight select-none overflow-hidden"
                        style={{ color:"#b91c1c", borderLeft: i>0?"1px solid rgba(255,255,255,0.35)":undefined }}>
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sub, i) => {
                    const s = sub as any;
                    const rowNum = (page-1)*PAGE_SIZE + i + 1;
                    const rowBg = i%2===0 ? "#111c11" : "#0f190f";
                    const amount = parsePdfNumber(s.qanchaBerildi ?? 0);
                    const masla = parsePdfNumber(s.dizMasla ?? 0);
                    const td = (content: React.ReactNode, align:"left"|"right"|"center"="left", idx=0) => (
                      <td className="px-1.5 py-2 align-middle overflow-hidden"
                        style={{ borderLeft:idx>0?"1px solid rgba(255,255,255,0.07)":undefined, textAlign:align }}>
                        {content}
                      </td>
                    );
                    return (
                      <tr key={sub.id} style={{ background:rowBg }} className="hover:brightness-125 transition-all">
                        {td(<span className="text-gray-500 font-bold text-[10px]">{rowNum}</span>,"center")}
                        {td(<span className="text-yellow-400 font-black text-[10px] tabular-nums">{fmtTime(s.timestamp)}</span>,"left",1)}
                        {td(<span className="text-cyan-400 font-black text-[10px] block truncate">{s.seriya ?? "—"}</span>,"left",2)}
                        {td(<span className="text-white font-bold text-[10px] block truncate">{s.raqami ?? "—"}</span>,"left",3)}
                        {td(<span className="text-purple-300 font-bold text-[10px] block truncate">{TAMIR_LABEL[s.tamirlashTuri] ?? s.tamirlashTuri ?? "—"}</span>,"left",4)}
                        {td(<span className="text-lime-300 font-black text-[11px] tabular-nums">{amount ? amount.toLocaleString("uz-UZ") : "—"}</span>,"right",5)}
                        {td(masla>0?<span className="text-orange-400 font-black text-[10px] tabular-nums">{masla}</span>:<span className="text-gray-600 text-[10px]">—</span>,"right",6)}
                        {td(<span className="text-emerald-300 font-black text-[10px] block truncate">{s.masulShaxs ?? "—"}</span>,"left",7)}
                        {td(renderMashinaCell(s), "center", 8)}
                        {td(
                          <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                            className="w-7 h-7 grid place-items-center rounded-lg transition-colors"
                            style={{ background:"rgba(99,102,241,0.12)" }} aria-label="Tahrirlash">
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </button>,"center",9
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── BARCHASI / LOKOMOTIV ── */}
            {(category === "all" || category === "lokomotiv") && (
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: "3%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "5%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "6%" }} />
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "4%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#eab308" }}>
                    {["№","VAQT","HARAKAT TURI","TEPLOVOZ","RAQAMI","HARAKAT","P.RAQ","INDEKS","XODIM","MASHINA","B.MASLA","QOLDIQ","YOQILG'I","HISOB","HOLAT","AMAL"]
                      .map((lbl, i) => (
                      <th key={lbl}
                        className="px-1.5 py-2 text-[8px] sm:text-[9px] font-black uppercase tracking-tight leading-tight select-none overflow-hidden"
                        style={{ color:"#b91c1c", borderLeft: i>0?"1px solid rgba(255,255,255,0.35)":undefined }}>
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((sub, i) => {
                    const s      = sub as any;
                    const time   = fmtTime(s.timestamp);
                    const amount = getAmount(s);
                    const qoldiq = parsePdfNumber(s.qoldiq ?? 0);
                    const masla  = parsePdfNumber(s.dizMasla ?? 0);
                    const hisob  = qoldiq + amount;
                    const rowNum = (page-1)*PAGE_SIZE + i + 1;
                    const rowBg  = i%2===0 ? "#111c11" : "#0f190f";
                    const tafsilot =
                      s.category==="lokomotiv" ? (s.rusumi ?? "—") :
                      s.category==="korxona"   ? (s.korxonaNomi ?? "—") :
                      s.category==="qurulish"  ? (s.seriya ?? s.korxonaNomi ?? "—") :
                      (s.seriya ?? "—");
                    const raqami  = s.lokomotivNumber ?? s.raqami ?? "—";
                    const harakat = HARAKAT_LABEL[s.harakatTuri] ?? s.harakatTuri ?? s.tamirlashTuri ?? s.category ?? "—";
                    const poyezdN = s.harakatTuri === "manyovr"
                      ? (s.stansiya ?? "—")
                      : s.harakatTuri === "xojalik"
                        ? (s.tashkilot ?? "—")
                        : (s.poyezdNumber ?? "—");
                    const indexVal = s.ruxsatIndeksi ?? "—";

                    const td = (content: React.ReactNode, align:"left"|"right"|"center"="left", idx=0) => (
                      <td className="px-1.5 py-2 align-middle overflow-hidden"
                        style={{ borderLeft:idx>0?"1px solid rgba(255,255,255,0.07)":undefined, textAlign:align }}>
                        {content}
                      </td>
                    );

                    return (
                      <tr key={sub.id} style={{ background:rowBg }} className="hover:brightness-125 transition-all">
                        {td(<span className="text-gray-500 font-bold text-[10px]">{rowNum}</span>,"center")}
                        {td(<span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span>,"left",1)}
                        {td(
                          <span className={`inline-block text-[8px] font-black uppercase px-1 py-0.5 rounded-full truncate max-w-full ${CAT_COLOR[s.category] ?? ""}`}>
                            {CAT_LABEL[s.category] ?? s.category}
                          </span>,"left",2
                        )}
                        {td(<span className="text-cyan-400 font-black text-[10px] block truncate">{tafsilot}</span>,"left",3)}
                        {td(<span className="text-white font-bold text-[10px] block truncate">{raqami}</span>,"left",4)}
                        {td(<span className="text-gray-300 font-bold text-[10px] capitalize block truncate">{harakat}</span>,"left",5)}
                        {td(<span className="text-gray-400 font-bold text-[10px] tabular-nums block truncate">{poyezdN}</span>,"left",6)}
                        {td(<span className="text-purple-300 font-bold text-[10px] block truncate">{indexVal}</span>,"left",7)}
                        {td(
                          <div className="min-w-0">
                            <p className="text-emerald-300 font-black text-[10px] leading-tight truncate">
                              {staffMap.get(String(s.staffCode ?? "").trim()) ?? s.staffName ?? "—"}
                            </p>
                            <p className="text-gray-600 text-[9px] tabular-nums truncate">{s.staffCode ?? ""}</p>
                          </div>,"left",8
                        )}
                        {td(renderMashinaCell(s), "center", 9)}
                        {td(masla>0?<span className="text-orange-400 font-black text-[10px] tabular-nums">{masla}</span>:<span className="text-gray-600 text-[10px]">—</span>,"right",10)}
                        {td(
                          qoldiq>0
                            ? <span className="text-amber-200 font-black text-[10px] tabular-nums" style={{textShadow:"0 0 8px rgba(251,191,36,0.25)"}}>{qoldiq.toLocaleString("uz-UZ")}</span>
                            : <span className="text-gray-600 text-[10px]">—</span>,
                          "right",11
                        )}
                        {td(
                          <span className="font-black text-[11px] tabular-nums text-lime-300">{amount.toLocaleString("uz-UZ")}</span>,
                          "right",12
                        )}
                        {td(
                          <span className="text-cyan-200 font-black text-[11px] tabular-nums" style={{textShadow:"0 0 10px rgba(34,211,238,0.28)"}}>{hisob.toLocaleString("uz-UZ")}</span>,
                          "right",13
                        )}
                        {td(
                          s.isEdited
                            ? <span className="text-amber-400 text-[9px] font-black uppercase">Tahrirlangan</span>
                            : <span className="text-emerald-400 text-[9px] font-black uppercase">Saqlangan</span>,
                          "left",14
                        )}
                        {td(
                          <button type="button"
                            onClick={() => { setEditSub(sub); setEditOpen(true); }}
                            className="w-7 h-7 grid place-items-center rounded-lg transition-colors"
                            style={{ background:"rgba(99,102,241,0.12)" }}
                            aria-label="Tahrirlash">
                            <Pencil className="w-3.5 h-3.5 text-primary" />
                          </button>,
                          "center",15
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

          </div>
        )}

        {/* Bottom bar */}
        {filtered.length > 0 && (
          <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3" style={{ background:"#0a1a0a" }}>
            <span className="text-gray-400 font-bold text-sm">
              Jami yoqilg'i:{" "}
              <span className="text-white font-black text-base">{totalFuel.toLocaleString()}</span> kg
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button onClick={()=>startTransition(()=>setPage(p=>Math.max(1,p-1)))} disabled={page===1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30"
                  style={{ background:"#1a2a1a", color:"#d1d5db" }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({length:Math.min(5,totalPages)},(_,idx)=>{
                  const p=Math.max(1,Math.min(totalPages-4,page-2))+idx;
                  return (
                    <button key={p} onClick={()=>startTransition(()=>setPage(p))}
                      className="w-8 h-8 rounded-lg text-xs font-black"
                      style={{ background:page===p?"#eab308":"#1a2a1a", color:page===p?"#000":"#d1d5db" }}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={()=>startTransition(()=>setPage(p=>Math.min(totalPages,p+1)))} disabled={page===totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30"
                  style={{ background:"#1a2a1a", color:"#d1d5db" }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit drawer */}
      <SubmissionEditDrawer
        open={editOpen}
        submission={editSub}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
