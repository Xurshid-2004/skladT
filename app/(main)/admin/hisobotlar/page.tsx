"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { useMidnightReset } from '@/lib/hooks/use-midnight-reset';
import { useStaffMap } from '@/lib/hooks/use-staff-map';
import {
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Loader2, FileText, Calendar,
  X, AlertTriangle, Download, Car, Pencil, Trash2
} from 'lucide-react';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';
import { Submission, Category } from '@/lib/types';
import { collection, query, where, orderBy, getDocs, onSnapshot, limit, startAfter, deleteDoc, doc as firestoreDoc, Timestamp } from 'firebase/firestore';
import { downloadErjuYpdf } from '@/lib/pdf/erju-malumotnoma-html';
import type { FuelRecord } from '@/lib/pdf/erju-html-pdf';
import { db } from '@/lib/firebase/config';
import RentCalendar from '@/app/calendar';
import { SubmissionEditDrawer } from '@/components/admin/submission-edit-drawer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── constants ────────────────────────────────────────────────────────────────

const CAT_LABEL: Record<string, string> = {
  lokomotiv: 'Lokomotiv',
  korxona: 'Korxona',
  qurulish: 'Qurulish',
  tamirlash: "Ta'mirlash",
};

const HARAKAT_LABEL: Record<string, string> = {
  yuk:      'Yuk',
  manyovr:  'Manyovr',
  yolovchi: "Yo'lovchi",
  xojalik:  "Xo'jalik",
  ijara:    'Ijara',
};

const CAT_COLOR: Record<string, string> = {
  lokomotiv: 'text-primary bg-primary/10',
  korxona:   'text-accent bg-accent/10',
  qurulish:  'text-warning bg-warning/10',
  tamirlash: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
};

const PAGE_SIZE = 20;

/** Jadval qatorlari uchun foizlar (yig’indi 100) — 16-ustun: AMAL tugmalari */
const HISOBOTLAR_COL_PCT = [3, 5, 6, 8, 6, 7, 7, 7, 5, 8, 7, 5, 7, 7, 8, 4];

/** Ingichka vertikal ajratuvchi — chap chegara shu indeksdagi ustunda (0-based) */
const HISOBOTLAR_COL_DIVIDER_LEFT = new Set([3, 4, 6, 7, 8, 10, 11, 12, 13, 14, 15]);

function hisobotlarDividerLeftClass(colIdx: number, zone: 'head' | 'body'): string {
  if (!HISOBOTLAR_COL_DIVIDER_LEFT.has(colIdx)) return '';
  return zone === 'head'
    ? 'border-l-[1.5px] border-white/70'
    : 'border-l-[1.5px] border-white/45';
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: any): { date: string; time: string } {
  if (!ts) return { date: '—', time: '—' };
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(Number(ts));
  return {
    date: d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
  };
}

function getAmount(sub: any): number {
  return Number(sub.qanchaBerildi ?? sub.qancha ?? sub.qanchaOlindi ?? 0);
}

function shortDateLabel(start: Date, end: Date): string {
  const s = start.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
  const e = end.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return s === e.slice(0, 5) ? e : `${s} — ${e}`;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Oddiy PDF (operativ hisobot) sarlavhasi — jadval va taqvim eksportlari */
function buildOperationalPdfTitle(start: Date, end: Date): string {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(end);
  b.setHours(0, 0, 0, 0);
  const same = a.getTime() === b.getTime();
  if (same) {
    return `${pad2(a.getDate())}.${pad2(a.getMonth() + 1)}.${a.getFullYear()} sutkasi mobaynida tarqatilgan dizel yoqilg'isi tarqatilishi haqida ma'lumot`;
  }
  const startUz = start.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endUz = end.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${startUz} dan ${endUz} gacha tarqatilgan dizel yoqilg'isi tarqatilishi haqida ma'lumot`;
}

/** Y.PDF / ERJU MAʼLUMOTNOMA sarlavhasi */
function buildErjuReportTitle(start: Date, end: Date): string {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(end);
  b.setHours(0, 0, 0, 0);
  const same = a.getTime() === b.getTime();
  if (same) {
    return `${pad2(a.getDate())}.${pad2(a.getMonth() + 1)}.${a.getFullYear()} sutkasi mobaynida dizel yoqilg'isi tarqatilishi haqida MA'LUMOTNOMA`;
  }
  const startUz = start.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endUz = end.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${startUz} dan ${endUz} gacha dizel yoqilg'isi tarqatilishi haqida MA'LUMOTNOMA`;
}

// ─── Barcha yozuvlarni cursor-pagination bilan olish ─────────────────────────

async function fetchAllSubmissionsInRange(start: Date, end: Date): Promise<Submission[]> {
  const all: Submission[] = [];
  let lastDoc: any = null;
  const batchSize = 1000;
  while (true) {
    const constraints: any[] = [
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc'),
      limit(batchSize),
    ];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(collection(db, 'submissions'), ...constraints));
    if (snap.empty) break;
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission)));
    if (snap.docs.length < batchSize) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return all;
}

async function fetchAllFuelRecordsInRange(isoStart: string, isoEnd: string): Promise<any[]> {
  const all: any[] = [];
  let lastDoc: any = null;
  const batchSize = 1000;
  while (true) {
    const constraints: any[] = [
      where('date', '>=', isoStart),
      where('date', '<=', isoEnd),
      limit(batchSize),
    ];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    const snap = await getDocs(query(collection(db, 'fuelRecords'), ...constraints));
    if (snap.empty) break;
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    if (snap.docs.length < batchSize) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return all;
}

// ─── Jadval filtrlari (PDF eksport = jadvaldagi kabi) ─────────────────────────

function filterSubmissionsForExport(
  subs: Submission[],
  globalCategory: Category | 'all',
): Submission[] {
  const data = subs.filter((s) => globalCategory === 'all' || s.category === globalCategory);
  return [...data].sort((a, b) => ((b as any).timestamp ?? 0) - ((a as any).timestamp ?? 0));
}

// ─── PDF export ───────────────────────────────────────────────────────────────

const TAMIR_LABEL: Record<string, string> = {
  katta: "Katta ta'mirlash",
  kichik: "Kichik ta'mirlash",
  profilaktika: "Profilaktika",
};

function exportTamirlashPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const W   = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(reportTitleLine, W - 28);
  let yTitle = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, yTitle, { align: 'center' }); yTitle += 5; });
  doc.setFont('helvetica', 'normal');

  const tableStartY = yTitle + 4;

  const getRowDateKey = (row: any): string => {
    const ts = row.timestamp;
    if (!ts) return '0000-00-00';
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(Number(ts));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const dateGroups = new Map<string, any[]>();
  for (const row of rows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  const sortedDates = [...dateGroups.keys()].sort();

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

  const body: any[] = [];
  const dateBg: [number, number, number] = [30, 50, 30];
  const dateFg: [number, number, number] = [255, 220, 50];
  const zapBg:  [number, number, number] = [210, 220, 210];
  const zapFg:  [number, number, number] = [30, 60, 30];
  const hdrPad = { top: 1.4, bottom: 1.4, left: 3, right: 2.5 };

  for (const dateKey of sortedDates) {
    const dateRows = dateGroups.get(dateKey)!;
    if (showDateGroups) {
      const [y, m, dd] = dateKey.split('-');
      body.push([{
        content: `${dd}.${m}.${y}`,
        colSpan: 8,
        styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: dateBg, textColor: dateFg, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
      }]);
    }

    const zapGroups = new Map<string, any[]>();
    for (const row of dateRows) {
      const sid = row.stationId ?? 'other';
      if (!zapGroups.has(sid)) zapGroups.set(sid, []);
      zapGroups.get(sid)!.push(row);
    }

    for (const [stationId, stRows] of zapGroups) {
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      let stName = stBase;
      if (staffMap) {
        const uniqueNames = [...new Set(
          stRows.map((r: any) => r.staffCode?.trim()).filter(Boolean)
            .map((code: string) => staffMap.get(code)).filter(Boolean),
        )] as string[];
        if (uniqueNames.length > 0) stName = `${stBase}  —  ${uniqueNames.join(', ')}`;
      }
      const zapTotal = stRows.reduce((acc, r) => acc + Number(r.qanchaBerildi ?? 0), 0);
      body.push([
        { content: stName, colSpan: 5, styles: { halign: 'left' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad } },
        { content: `jami: ${zapTotal.toLocaleString('uz-UZ')} kg`, colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'italic' as const, fontSize: 7, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad } },
      ]);

      for (const s of stRows) {
        const { time } = fmtDate(s.timestamp);
        const mashinaStr = s.mashinadaYetkazildi
          ? (s.mashinaRaqami ? `Ha · ${s.mashinaRaqami}` : 'Ha')
          : "Yo'q";
        body.push([
          time,
          String(s.seriya ?? '—'),
          String(s.raqami ?? '—'),
          TAMIR_LABEL[s.tamirlashTuri] ?? String(s.tamirlashTuri ?? '—'),
          s.qanchaBerildi ? String(s.qanchaBerildi) : '—',
          s.dizMasla ? String(s.dizMasla) : '—',
          String(s.masulShaxs ?? '—'),
          mashinaStr,
        ]);
      }
    }
  }

  autoTable(doc, {
    head, body,
    startY: tableStartY,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [80, 60, 20], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [252, 250, 242] },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 38 },
      4: { cellWidth: 32, halign: 'right' as const },
      5: { cellWidth: 28, halign: 'right' as const },
      6: { cellWidth: 60 },
      7: { cellWidth: 32 },
    },
  });

  const totalFuel = rows.reduce((s, r) => s + Number(r.qanchaBerildi ?? 0), 0);
  const totalMasla = rows.reduce((s, r) => s + Number(r.dizMasla ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Jami yoqilg'i: ${totalFuel.toLocaleString('uz-UZ')} kg`, 14, fY + 8);
  if (totalMasla > 0) doc.text(`Jami diz masla: ${totalMasla.toLocaleString('uz-UZ')} kg`, 14, fY + 14);
  doc.save(`tamirlash_${fileSlug}.pdf`);
}

function exportKorxonaPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const W   = doc.internal.pageSize.width;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(reportTitleLine, W - 28);
  let yTitle = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, yTitle, { align: 'center' }); yTitle += 5; });
  doc.setFont('helvetica', 'normal');

  const getRowDateKey = (row: any): string => {
    const ts = row.timestamp;
    if (!ts) return '0000-00-00';
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(Number(ts));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const dateGroups = new Map<string, any[]>();
  for (const row of rows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  const sortedDates = [...dateGroups.keys()].sort();

  const head = [["Vaqt", "Korxona nomi", "Qancha (kg)", "Necha sutkalik", "Limit (kg)", "Mashinada", "Mas'ul"]];
  const body: any[] = [];
  const dateBg: [number,number,number] = [10,40,10];
  const dateFg: [number,number,number] = [255,220,50];
  const zapBg:  [number,number,number] = [210,230,210];
  const zapFg:  [number,number,number] = [20,70,20];
  const hdrPad = { top: 1.4, bottom: 1.4, left: 3, right: 2.5 };

  for (const dateKey of sortedDates) {
    const dateRows = dateGroups.get(dateKey)!;
    if (showDateGroups) {
      const [y, m, dd] = dateKey.split('-');
      body.push([{ content: `${dd}.${m}.${y}`, colSpan: 7, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: dateBg, textColor: dateFg, cellPadding: { top:2,bottom:2,left:3,right:3 } } }]);
    }
    const zapGroups = new Map<string, any[]>();
    for (const row of dateRows) {
      const sid = row.stationId ?? 'other';
      if (!zapGroups.has(sid)) zapGroups.set(sid, []);
      zapGroups.get(sid)!.push(row);
    }
    for (const [stationId, stRows] of zapGroups) {
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      let stName = stBase;
      if (staffMap) {
        const uniqueNames = [...new Set(stRows.map((r:any)=>r.staffCode?.trim()).filter(Boolean).map((c:string)=>staffMap.get(c)).filter(Boolean))] as string[];
        if (uniqueNames.length > 0) stName = `${stBase}  —  ${uniqueNames.join(', ')}`;
      }
      const zapTotal = stRows.reduce((acc,r) => acc + Number(r.qancha ?? 0), 0);
      body.push([
        { content: stName,          colSpan: 4, styles: { halign:'left'  as const, fontStyle:'bold'   as const, fontSize:8, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
        { content: `jami: ${zapTotal.toLocaleString('uz-UZ')} kg`, colSpan: 3, styles: { halign:'right' as const, fontStyle:'italic' as const, fontSize:7, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
      ]);
      for (const s of stRows) {
        const { time } = fmtDate(s.timestamp);
        const mashinaStr = s.mashinadaYetkazildi ? (s.mashinaRaqami ? `Ha · ${s.mashinaRaqami}` : 'Ha') : "Yo'q";
        body.push([time, String(s.korxonaNomi ?? '—'), String(s.qancha ?? 0), String(s.nechaSutkalik ?? '—'), s.limit ? String(s.limit) : '—', mashinaStr, s.staffName ?? '—']);
      }
    }
  }

  autoTable(doc, {
    head, body, startY: yTitle + 4, theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [0,0,0], lineWidth: 0.2 },
    headStyles: { fillColor: [20,80,20], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8, lineColor: [0,0,0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [245,252,245] },
    columnStyles: { 0:{cellWidth:20}, 1:{cellWidth:72}, 2:{cellWidth:32,halign:'right'as const}, 3:{cellWidth:32}, 4:{cellWidth:30,halign:'right'as const}, 5:{cellWidth:38}, 6:{cellWidth:52} },
  });
  const total = rows.reduce((s,r) => s + Number(r.qancha ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(`Jami berildi: ${total.toLocaleString('uz-UZ')} kg`, 14, fY + 8);
  doc.save(`korxona_${fileSlug}.pdf`);
}

function exportQurulishPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const W   = doc.internal.pageSize.width;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(reportTitleLine, W - 28);
  let yTitle = 10;
  lines.forEach((ln: string) => { doc.text(ln, W / 2, yTitle, { align: 'center' }); yTitle += 5; });
  doc.setFont('helvetica', 'normal');

  const getRowDateKey = (row: any): string => {
    const ts = row.timestamp;
    if (!ts) return '0000-00-00';
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(Number(ts));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };
  const dateGroups = new Map<string, any[]>();
  for (const row of rows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  const sortedDates = [...dateGroups.keys()].sort();

  const head = [["Vaqt", "Korxona nomi", "Obyekt", "Texnika soni", "Lavozimi", "Qancha (kg)", "Limit (kg)", "Dop limit (kg)", "Holat", "Mashinada", "Mas'ul shaxs"]];
  const body: any[] = [];
  const dateBg: [number,number,number] = [50,20,10];
  const dateFg: [number,number,number] = [255,220,50];
  const zapBg:  [number,number,number] = [240,220,200];
  const zapFg:  [number,number,number] = [80,40,10];
  const hdrPad = { top: 1.4, bottom: 1.4, left: 3, right: 2.5 };

  for (const dateKey of sortedDates) {
    const dateRows = dateGroups.get(dateKey)!;
    if (showDateGroups) {
      const [y, m, dd] = dateKey.split('-');
      body.push([{ content: `${dd}.${m}.${y}`, colSpan: 11, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: dateBg, textColor: dateFg, cellPadding: { top:2,bottom:2,left:3,right:3 } } }]);
    }
    const zapGroups = new Map<string, any[]>();
    for (const row of dateRows) {
      const sid = row.stationId ?? 'other';
      if (!zapGroups.has(sid)) zapGroups.set(sid, []);
      zapGroups.get(sid)!.push(row);
    }
    for (const [stationId, stRows] of zapGroups) {
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      let stName = stBase;
      if (staffMap) {
        const uniqueNames = [...new Set(stRows.map((r:any)=>r.staffCode?.trim()).filter(Boolean).map((c:string)=>staffMap.get(c)).filter(Boolean))] as string[];
        if (uniqueNames.length > 0) stName = `${stBase}  —  ${uniqueNames.join(', ')}`;
      }
      const zapTotal = stRows.reduce((acc,r) => acc + Number(r.qanchaOlindi ?? 0), 0);
      body.push([
        { content: stName,          colSpan: 6, styles: { halign:'left'  as const, fontStyle:'bold'   as const, fontSize:8, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
        { content: `jami: ${zapTotal.toLocaleString('uz-UZ')} kg`, colSpan: 5, styles: { halign:'right' as const, fontStyle:'italic' as const, fontSize:7, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
      ]);
      for (const s of stRows) {
        const { time } = fmtDate(s.timestamp);
        const mashinaStr = s.mashinadaYetkazildi ? (s.mashinaRaqami ? `Ha · ${s.mashinaRaqami}` : 'Ha') : "Yo'q";
        body.push([time, String(s.korxonaNomi??'—'), String(s.obyekt??'—'), String(s.texnikaSoni??'—'), String(s.lavozim??'—'), String(s.qanchaOlindi??0), s.limit?String(s.limit):'—', s.dopLimit!=null?String(s.dopLimit):'—', s.isOverLimit?`Oshgan (+${s.oshiqMiqdor??0} kg)`:'Norma', mashinaStr, String(s.masulShaxs??'—')]);
      }
    }
  }

  autoTable(doc, {
    head, body, startY: yTitle + 4, theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.8, valign: 'middle', lineColor: [0,0,0], lineWidth: 0.2 },
    headStyles: { fillColor: [180,80,20], textColor: [255,255,255], fontStyle: 'bold', fontSize: 7.5, lineColor: [0,0,0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [252,248,244] },
    columnStyles: { 0:{cellWidth:15}, 1:{cellWidth:38}, 2:{cellWidth:34}, 3:{cellWidth:18}, 4:{cellWidth:24}, 5:{cellWidth:22,halign:'right'as const}, 6:{cellWidth:20,halign:'right'as const}, 7:{cellWidth:22,halign:'right'as const}, 8:{cellWidth:24}, 9:{cellWidth:22}, 10:{cellWidth:34} },
  });
  const total = rows.reduce((s,r) => s + Number(r.qanchaOlindi ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(`Jami berildi: ${total.toLocaleString('uz-UZ')} kg`, 14, fY + 8);
  doc.save(`qurulish_${fileSlug}.pdf`);
}

function exportPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const doc  = new jsPDF('landscape', 'mm', 'a4');
  const W    = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(reportTitleLine, W - 28);
  let yTitle = 10;
  lines.forEach((ln: string) => {
    doc.text(ln, W / 2, yTitle, { align: 'center' });
    yTitle += 5;
  });
  doc.setFont('helvetica', 'normal');

  const tableStartY = yTitle + 4;

  // ── Avval sanalar bo'yicha guruhlash, keyin har bir sana ichida zapravka ──────
  const getRowDateKey = (row: any): string => {
    const ts = (row as any).timestamp;
    if (!ts) return '0000-00-00';
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(Number(ts));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const dateGroups = new Map<string, any[]>();
  for (const row of rows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  // Sanalarni o'sish tartibida saralash
  const sortedDates = [...dateGroups.keys()].sort();

  const head = [
    [
      { content: 'Vaqt\n1',                                            rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Teplovozlar bo'yicha ma'lumot",                       colSpan: 2, styles: { halign: 'center' as const } },
      { content: "Poyezdlar va tashkilotlar bo'yicha ma'lumot",         colSpan: 4, styles: { halign: 'center' as const } },
      { content: "Diz.Yoqilg'i berishdan\noldingi bakdagi\nqoldiq\n8", rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Berilgan diz\nyoqilg'i miqdori\n9",                   rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Umumiy miqdor, kg\n10",                              rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
    ],
    [
      { content: 'Seriya\n2',        styles: { halign: 'center' as const } },
      { content: 'Raqami\n3',        styles: { halign: 'center' as const } },
      { content: "Yo'nalish\n4",     styles: { halign: 'center' as const } },
      { content: 'Poyezd raqami\n5', styles: { halign: 'center' as const } },
      { content: 'Indeksi\n6',       styles: { halign: 'center' as const } },
      { content: 'Poyezd vazni\n7',  styles: { halign: 'center' as const } },
    ],
  ];

  const body: any[] = [];
  const dateBg: [number, number, number] = [30, 50, 30];
  const dateFg: [number, number, number] = [255, 220, 50];
  const zapBg:  [number, number, number] = [210, 220, 210];
  const zapFg:  [number, number, number] = [30, 60, 30];
  const hdrPad = { top: 1.4, bottom: 1.4, left: 3, right: 2.5 };

  for (const dateKey of sortedDates) {
    const dateRows = dateGroups.get(dateKey)!;
    if (showDateGroups) {
      const [y, m, dd] = dateKey.split('-');
      const dateLabel = `${dd}.${m}.${y}`;
      body.push([{
        content: dateLabel,
        colSpan: 10,
        styles: {
          halign: 'center' as const,
          fontStyle: 'bold' as const,
          fontSize: 8,
          fillColor: dateBg,
          textColor: dateFg,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
      }]);
    }

    // Sana ichida zapravka bo'yicha guruhlash
    const zapGroups = new Map<string, any[]>();
    for (const row of dateRows) {
      const sid = (row as any).stationId ?? 'other';
      if (!zapGroups.has(sid)) zapGroups.set(sid, []);
      zapGroups.get(sid)!.push(row);
    }

    for (const [stationId, stRows] of zapGroups) {
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      let stName = stBase;
      if (staffMap) {
        const uniqueNames = [...new Set(
          stRows
            .map((r: any) => r.staffCode?.trim())
            .filter(Boolean)
            .map((code: string) => staffMap.get(code))
            .filter(Boolean),
        )] as string[];
        if (uniqueNames.length > 0) stName = `${stBase}  —  ${uniqueNames.join(', ')}`;
      }
      const zapTotal = stRows.reduce((acc, r) => acc + getAmount(r), 0);

      body.push([
        {
          content: stName,
          colSpan: 5,
          styles: { halign: 'left' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad },
        },
        {
          content: `jami: ${zapTotal.toLocaleString('uz-UZ')} kg`,
          colSpan: 5,
          styles: { halign: 'right' as const, fontStyle: 'italic' as const, fontSize: 7, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad },
        },
      ]);

      for (const s of stRows) {
        const { time } = fmtDate((s as any).timestamp);
        const amount   = getAmount(s);
        const qoldiq   = Number((s as any).qoldiq ?? 0);
        const hisob    = qoldiq + amount;
        const poyezdNum = String((s as any).poyezdNumber ?? '—');
        const indexVal = (s as any).harakatTuri === 'manyovr'
          ? String((s as any).stansiya ?? '—')
          : String((s as any).ruxsatIndeksi ?? '—');
        body.push([
          time,
          String((s as any).rusumi ?? (s as any).seriya ?? '—'),
          String((s as any).lokomotivNumber ?? (s as any).raqami ?? '—'),
          String(
            HARAKAT_LABEL[(s as any).harakatTuri]
              ?? (s as any).harakatTuri
              ?? (s as any).tamirlashTuri
              ?? (s as any).category
              ?? '—',
          ),
          poyezdNum,
          indexVal,
          (s as any).poyezdVazni != null && String((s as any).poyezdVazni) !== ''
            ? String((s as any).poyezdVazni)
            : '—',
          qoldiq ? qoldiq.toLocaleString('uz-UZ') : '—',
          amount ? amount.toLocaleString('uz-UZ') : '—',
          hisob.toLocaleString('uz-UZ'),
        ]);
      }
    }
  }

  autoTable(doc, {
    head, body,
    startY: tableStartY,
    theme:             'grid',
    styles:            { fontSize: 7, cellPadding: 1.15, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles:        { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', fontSize: 7, lineColor: [0,0,0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [250,250,250] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 20 },
      2: { cellWidth: 18 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
      5: { cellWidth: 28 },
      6: { cellWidth: 20 },
      7: { cellWidth: 26, halign: 'right' as const },
      8: { cellWidth: 22, halign: 'right' as const },
      9: { cellWidth: 22, halign: 'right' as const },
    },
  });

  // Umumiy jami — jadvaldan keyin, oxirgi sahifada, chapdan
  const grandTotal = rows.reduce((s: number, r: any) => s + getAmount(r), 0);
  const margin = 14;
  const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
  const pageH = doc.internal.pageSize.height;
  const blockH = 10;
  let grandY = finalY + blockH;
  if (grandY > pageH - margin) {
    doc.addPage();
    grandY = margin;
  }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Umumiy jami yoqilg'i: ${grandTotal.toLocaleString()} kg`, margin, grandY, { align: 'left' });

  doc.save(`hisobot_${fileSlug.replace(/[^\w.—]+/g, '_')}.pdf`);
}

// ─── SortArrow ────────────────────────────────────────────────────────────────

function SortArrow({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: 'asc' | 'desc' }) {
  if (sortField !== field) return null;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
    : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function HisobotlarPage() {
  const [globalSubs,       setGlobalSubs]       = useState<Submission[]>([]);
  const [globalLoading,    setGlobalLoading]    = useState(false);
  const [globalCategory,   setGlobalCategory]   = useState<Category | 'all'>('all');
  const [globalDateRange,  setGlobalDateRange]  = useState<{ start: Date; end: Date } | null>(null);
  const [globalSortField,  setGlobalSortField]  = useState('timestamp');
  const [globalSortDir,    setGlobalSortDir]    = useState<'asc' | 'desc'>('desc');
  const [globalPage,       setGlobalPage]       = useState(1);
  const [showGlobalCal,    setShowGlobalCal]    = useState(false);
  const [globalPdfLoading, setGlobalPdfLoading] = useState(false);
  const [globalErjuPdfLoading, setGlobalErjuPdfLoading] = useState(false);
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const dateKey  = useMidnightReset();
  const staffMap = useStaffMap();

  const getTimestampMs = (timestamp: unknown): number => {
    if (timestamp == null) return 0;
    if (typeof timestamp === 'number') return timestamp;
    if (typeof timestamp === 'object' && timestamp !== null && typeof (timestamp as any).toDate === 'function') {
      return (timestamp as any).toDate().getTime();
    }
    const parsed = new Date(timestamp as any).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const isInDateRange = (submission: Submission, start: Date, end: Date) => {
    const ts = getTimestampMs((submission as any).timestamp);
    return ts >= start.getTime() && ts <= end.getTime();
  };

  // ── fetch ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setGlobalLoading(true);
    setGlobalSubs([]);

    const start = globalDateRange?.start ?? (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const end   = globalDateRange?.end   ?? (() => { const d = new Date(); d.setHours(23,59,59,999); return d; })();

    if (globalDateRange) {
      let cancelled = false;
      fetchAllSubmissionsInRange(start, end)
        .then((submissions) => { if (!cancelled) { setGlobalSubs(submissions); setGlobalLoading(false); } })
        .catch((err) => { console.error(err); if (!cancelled) setGlobalLoading(false); });
      return () => { cancelled = true; };
    }

    const q = query(
      collection(db, 'submissions'),
      orderBy('timestamp', 'desc'),
      limit(1000)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const submissions = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Submission[];
      setGlobalSubs(submissions.filter((sub) => isInDateRange(sub, start, end)));
      setGlobalLoading(false);
    }, (error) => {
      console.error(error);
      setGlobalLoading(false);
    });

    return () => unsubscribe();
  }, [globalDateRange, dateKey]);

  // ── filter + sort ─────────────────────────────────────────────────────────────
  const globalFiltered = useMemo(() => {
    const data = globalSubs.filter(s => globalCategory === 'all' || s.category === globalCategory);
    return [...data].sort((a, b) => {
      const av = (a as any)[globalSortField] ?? 0;
      const bv = (b as any)[globalSortField] ?? 0;
      return globalSortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [globalSubs, globalCategory, globalSortField, globalSortDir]);

  const globalTotalPages = Math.max(1, Math.ceil(globalFiltered.length / PAGE_SIZE));
  const globalPaginated  = useMemo(
    () => globalFiltered.slice((globalPage - 1) * PAGE_SIZE, globalPage * PAGE_SIZE),
    [globalFiltered, globalPage]
  );
  const globalTotalFuel = useMemo(
    () => globalFiltered.reduce((s, r) => s + getAmount(r), 0),
    [globalFiltered]
  );
  const globalDateLabel = globalDateRange
    ? shortDateLabel(globalDateRange.start, globalDateRange.end)
    : 'Bugun';

  // ── handlers ──────────────────────────────────────────────────────────────────
  const handleGlobalSort = useCallback((field: string) => {
    startTransition(() => {
      if (globalSortField === field) setGlobalSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setGlobalSortField(field); setGlobalSortDir('desc'); }
      setGlobalPage(1);
    });
  }, [globalSortField]);

  const handleDelete = useCallback(async (sub: Submission) => {
    if (!window.confirm(`Ushbu yozuvni o'chirmoqchimisiz?\n#${sub.id.slice(-6)} — ${(sub as any).stationId ?? ''}`)) return;
    setDeletingId(sub.id);
    try {
      await deleteDoc(firestoreDoc(db, 'submissions', sub.id));
      setGlobalSubs((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (e) {
      console.error(e);
      window.alert("O'chirishda xato yuz berdi.");
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleSaved = useCallback((updated: Submission) => {
    setGlobalSubs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  const handleGlobalExportPdf = useCallback(() => {
    if (globalFiltered.length === 0) return;
    setGlobalPdfLoading(true);
    setTimeout(() => {
      try {
        const rawS = globalDateRange?.start ?? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
        const rawE = globalDateRange?.end ?? (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();
        const s = new Date(rawS);
        s.setHours(0, 0, 0, 0);
        const eDay = new Date(rawE);
        eDay.setHours(0, 0, 0, 0);
        const titleLine = buildOperationalPdfTitle(s, eDay);
        const fileSlug = globalDateRange
          ? `${toIsoDateLocal(s)}_${toIsoDateLocal(eDay)}`
          : `bugun_${toIsoDateLocal(s)}`;
        if (globalCategory === 'tamirlash') {
          exportTamirlashPDF(globalFiltered, fileSlug, titleLine, staffMap);
        } else if (globalCategory === 'korxona') {
          exportKorxonaPDF(globalFiltered, fileSlug, titleLine, staffMap);
        } else if (globalCategory === 'qurulish') {
          exportQurulishPDF(globalFiltered, fileSlug, titleLine, staffMap);
        } else {
          exportPDF(globalFiltered, fileSlug, titleLine, staffMap);
        }
      } finally {
        setGlobalPdfLoading(false);
      }
    }, 50);
  }, [globalFiltered, globalDateRange, staffMap]);

  /** Taqvimdan: tanlangan davr bo'yicha submissions + xuddi jadvaldagi filtrlarga mos PDF */
  const exportPdfForDateRange = useCallback(async (start: Date, endDay: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(23, 59, 59, 999);
    setGlobalDateRange({ start: s, end: e });
    setGlobalPage(1);
    setGlobalPdfLoading(true);
    try {
      let rows = await fetchAllSubmissionsInRange(s, e);
      rows = filterSubmissionsForExport(rows, globalCategory);
      if (!rows.length) {
        window.alert("Tanlangan davr uchun jadval filtrlari bo'yicha yozuv yo'q.");
        return;
      }
      const endForTitle = new Date(endDay);
      endForTitle.setHours(0, 0, 0, 0);
      const titleLine = buildOperationalPdfTitle(s, endForTitle);
      const fileSlug = `${toIsoDateLocal(s)}_${toIsoDateLocal(endDay)}`;
      if (globalCategory === 'tamirlash') {
        exportTamirlashPDF(rows, fileSlug, titleLine, staffMap, true);
      } else if (globalCategory === 'korxona') {
        exportKorxonaPDF(rows, fileSlug, titleLine, staffMap, true);
      } else if (globalCategory === 'qurulish') {
        exportQurulishPDF(rows, fileSlug, titleLine, staffMap, true);
      } else {
        exportPDF(rows, fileSlug, titleLine, staffMap, true);
      }
    } catch (err) {
      console.error(err);
      window.alert("PDF tayyorlashda xato. Firestore indeksini tekshiring.");
    } finally {
      setGlobalPdfLoading(false);
    }
  }, [globalCategory, staffMap]);

  const runErjuYpdfExport = useCallback(async (rangeStart: Date, rangeEnd: Date) => {
    setGlobalErjuPdfLoading(true);
    try {
      const s = new Date(rangeStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(rangeEnd);
      e.setHours(0, 0, 0, 0);
      const isoS = toIsoDateLocal(s);
      const isoE = toIsoDateLocal(e);
      const sourceRows = (await fetchAllFuelRecordsInRange(isoS, isoE)) as FuelRecord[];
      const title = buildErjuReportTitle(s, e);
      downloadErjuYpdf(sourceRows, title, [], []);
    } catch (err) {
      console.error('Y.PDF:', err);
    } finally {
      setGlobalErjuPdfLoading(false);
    }
  }, []);

  // ── render ────────────────────────────────────────────────────────────────────
  return (
      <div className="w-full min-w-0 max-w-[100vw] box-border space-y-5 xl:max-w-[min(100vw-1.5rem,92rem)]">

        {/* Page title */}
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-primary/30 shrink-0">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-black text-primary tracking-tight">6 ta ERJ</span>
              <span className="text-2xl font-black text-foreground/80 tracking-tight">bo'yicha</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-none">
              barcha hisobotlar
            </h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1.5">
              Real vaqt · Bugungi kun
            </p>
          </div>
        </div>

        {/* Filter row */}
        <div className="bg-background rounded-[20px] border-2 border-primary/5 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-muted p-1 rounded-xl flex-wrap">
            {(['all', 'lokomotiv', 'korxona', 'qurulish', 'tamirlash'] as const).map(cat => (
              <button key={cat}
                onClick={() => { startTransition(() => { setGlobalCategory(cat); setGlobalPage(1); }); }}
                className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${globalCategory === cat ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
              >
                {cat === 'all' ? 'Barchasi' : CAT_LABEL[cat]}
              </button>
            ))}
          </div>
          <button onClick={() => setShowGlobalCal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </button>
          {globalDateRange && (
            <button onClick={() => { setGlobalDateRange(null); setGlobalPage(1); }}
              className="p-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl transition-all shadow-md shadow-red-900/30"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dark table — chap tomonda bo‘sh joyda kengashmaslik uchun min-w-0 */}
        <div className="rounded-[20px] overflow-hidden shadow-2xl border border-[#2a3a2a] min-w-0 max-w-full" style={{ background: '#111c11' }}>

          {/* Topbar */}
          <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#0d160d' }}>
            <div className="flex items-center gap-3">
              <span className="text-white font-black text-sm">
                Jami yozuvlar: <span className="text-yellow-400">{globalFiltered.length}</span>
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">
                {globalDateLabel} · Barcha ERJlar
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleGlobalExportPdf} disabled={globalFiltered.length === 0 || globalPdfLoading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 shadow-lg shadow-emerald-900/40"
              >
                {globalPdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {globalPdfLoading ? 'Tayyorlanmoqda...' : 'PDF'}
              </button>
              {globalCategory === 'korxona' || globalCategory === 'qurulish' || globalCategory === 'tamirlash' ? null : (
                <button
                  onClick={() => {
                    const start = globalDateRange?.start ?? (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
                    const end = globalDateRange?.end ?? (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();
                    void runErjuYpdfExport(start, end);
                  }}
                  disabled={globalErjuPdfLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase transition-all disabled:opacity-40 shadow-lg shadow-fuchsia-900/30"
                >
                  {globalErjuPdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {globalErjuPdfLoading ? 'Y.PDF…' : 'Y.PDF'}
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {globalLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-400 opacity-70" />
            </div>
          )}

          {/* Empty */}
          {!globalLoading && globalFiltered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <FileText className="w-8 h-8 text-gray-500" />
              <p className="text-gray-400 font-black uppercase text-sm">Ma'lumot topilmadi</p>
              <p className="text-gray-600 text-xs">Boshqa sana yoki kategoriya tanlang</p>
            </div>
          )}

          {/* Tables — category-specific rendering */}
          {!globalLoading && globalFiltered.length > 0 && (
            <div className="w-full min-w-0 px-2 sm:px-4 pb-3 overflow-x-auto">

              {/* All / Lokomotiv: original 16-column table */}
              {(globalCategory === 'all' || globalCategory === 'lokomotiv') && (
                <table className="w-full mx-auto table-fixed border-collapse text-left">
                  <colgroup>
                    {HISOBOTLAR_COL_PCT.map((pct, idx) => (
                      <col key={idx} style={{ width: `${pct}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {[
                        { label: '№' },
                        { label: 'VAQT' },
                        { label: 'ZAPRAVKA' },
                        { label: 'KATEGORIYA' },
                        { label: 'TEPLOVOZ' },
                        { label: 'RAQAMI' },
                        { label: 'HARAKAT' },
                        { label: 'P.RAQAMI' },
                        { label: 'INDEKS' },
                        { label: 'XODIM' },
                        { label: 'OLIB BORISH' },
                        { label: 'B.MASLA' },
                        { label: 'QOLDIQ' },
                        { label: "YOQILG'I" },
                        { label: 'HISOB' },
                        { label: 'AMAL' },
                      ].map(({ label }, colIdx) => (
                        <th key={label}
                          className={`align-top px-1.5 sm:px-2 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-normal select-none hyphens-none border-solid ${hisobotlarDividerLeftClass(colIdx, 'head')}`}
                          style={{ color: '#b91c1c' }}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalPaginated.map((sub, i) => {
                      const s      = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const amount = getAmount(s);
                      const qoldiq = Number(s.qoldiq ?? 0);
                      const masla  = Number(s.dizMasla ?? 0);
                      const hisob  = qoldiq + amount;
                      const rowNum = (globalPage - 1) * PAGE_SIZE + i + 1;
                      const zap    = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowBg  = i % 2 === 0 ? '#111c11' : '#0f190f';
                      const tafsilot = s.category === 'lokomotiv' ? (s.rusumi ?? '—') :
                                       s.category === 'korxona'   ? (s.korxonaNomi ?? '—') :
                                       s.category === 'qurulish'  ? (s.obyekt ?? '—') :
                                       (s.seriya ?? '—');
                      const raqami  = s.lokomotivNumber ?? s.raqami ?? '—';
                      const harakat = HARAKAT_LABEL[s.harakatTuri] ?? s.harakatTuri ?? s.tamirlashTuri ?? s.category ?? '—';
                      const poyezdNumber = s.poyezdNumber ?? '—';
                      const rowIndexVal = s.harakatTuri === 'manyovr'
                        ? (s.stansiya ?? '—')
                        : (s.ruxsatIndeksi ?? '—');
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className={`px-1.5 sm:px-2 py-2 align-top text-center border-solid ${hisobotlarDividerLeftClass(0, 'body')}`}>
                            <span className="text-gray-400 font-bold text-[10px]">{rowNum}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(1, 'body')}`}>
                            <span className="text-yellow-400 font-black text-[9px] sm:text-[10px] leading-tight tabular-nums">{time}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(2, 'body')}`}>
                            <span className="text-gray-300 font-bold text-[10px] sm:text-[10px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full block">{zap?.name ?? s.stationId ?? '—'}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(3, 'body')}`}>
                            <span className={`inline-block max-w-full text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full leading-tight break-words ${CAT_COLOR[s.category]}`}>
                              {CAT_LABEL[s.category] ?? s.category}
                            </span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(4, 'body')}`}>
                            <span className="text-cyan-400 font-black text-[11px] sm:text-xs leading-tight break-words">{tafsilot}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(5, 'body')}`}>
                            <span className="text-white font-bold text-[11px] sm:text-xs leading-tight break-all [overflow-wrap:anywhere]">{raqami}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(6, 'body')}`}>
                            <span className="text-gray-300 font-bold text-[10px] capitalize leading-tight break-words">{harakat}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(7, 'body')}`}>
                            <span className="text-gray-400 text-[10px] sm:text-xs font-bold leading-tight break-all [overflow-wrap:anywhere]">{poyezdNumber}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(8, 'body')}`}>
                            <span className="text-purple-300 text-[10px] sm:text-xs font-bold leading-tight break-all [overflow-wrap:anywhere]">{rowIndexVal}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(9, 'body')}`}>
                            <p className="text-emerald-400 font-black text-[10px] sm:text-xs leading-tight break-all">
                              {s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}
                            </p>
                            {s.staffCode && <p className="text-gray-500 text-[9px] leading-tight break-words">{s.staffCode}</p>}
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(10, 'body')}`}>
                            {s.mashinadaYetkazildi
                              ? <span className="flex flex-wrap items-start gap-0.5 text-blue-400 font-black text-[9px] sm:text-[10px]"><Car className="w-3 h-3 shrink-0 mt-0.5" /><span className="min-w-0 break-all leading-tight">{s.mashinaRaqami ?? 'Mashina'}</span></span>
                              : <span className="text-gray-500 font-bold text-[10px]">Yuq</span>}
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top text-right border-solid ${hisobotlarDividerLeftClass(11, 'body')}`}>
                            {masla > 0 ? <span className="text-orange-400 font-black text-[11px] sm:text-sm tabular-nums">{masla}</span> : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top text-right border-solid ${hisobotlarDividerLeftClass(12, 'body')}`}>
                            {qoldiq > 0 ? <span className="text-amber-200 font-black text-[11px] sm:text-sm tabular-nums leading-tight break-all drop-shadow-[0_0_8px_rgba(251,191,36,0.25)]">{qoldiq.toLocaleString('uz-UZ')}</span> : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top text-right border-solid ${hisobotlarDividerLeftClass(13, 'body')}`}>
                            <span className={`font-black text-[11px] sm:text-sm tabular-nums leading-tight break-all ${s.isOverLimit ? 'text-red-400' : 'text-lime-300'}`}>{amount.toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top text-right border-solid ${hisobotlarDividerLeftClass(14, 'body')}`}>
                            <span className="text-cyan-200 font-black text-[11px] sm:text-sm tabular-nums leading-tight break-all [text-shadow:0_0_10px_rgba(34,211,238,0.28)]">{hisob.toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top border-solid ${hisobotlarDividerLeftClass(15, 'body')}`}>
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                                className="grid place-items-center w-10 h-10 rounded-lg bg-primary/10 hover:bg-primary/25 text-primary transition-colors" title="Tahrirlash">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button type="button" onClick={() => handleDelete(sub)} disabled={deletingId === sub.id}
                                className="grid place-items-center w-10 h-10 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 transition-colors disabled:opacity-40" title="O'chirish">
                                {deletingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Korxona table: 9 columns */}
              {globalCategory === 'korxona' && (
                <table className="w-full border-collapse text-left" style={{ minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {['№', 'VAQT', 'ZAPRAVKA', 'XODIM', 'KORXONA NOMI', 'QANCHA (kg)', 'SUTKALIK', 'MASHINA', 'AMAL'].map((label) => (
                        <th key={label} className="px-2 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-nowrap" style={{ color: '#b91c1c' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalPaginated.map((sub, i) => {
                      const s = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const zap = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowNum = (globalPage - 1) * PAGE_SIZE + i + 1;
                      const rowBg = i % 2 === 0 ? '#111c11' : '#0f190f';
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className="px-2 py-2 text-center align-top"><span className="text-gray-400 font-bold text-[10px]">{rowNum}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 font-bold text-[10px] block max-w-[110px] truncate">{zap?.name ?? s.stationId ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <p className="text-emerald-400 font-black text-[10px] break-all">{s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}</p>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-cyan-400 font-black text-xs break-words">{s.korxonaNomi ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top text-right">
                            <span className={`font-black text-sm tabular-nums ${s.isOverLimit ? 'text-red-400' : 'text-lime-300'}`}>{Number(s.qancha ?? 0).toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold">{s.nechaSutkalik ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            {s.mashinadaYetkazildi
                              ? <span className="text-blue-400 font-bold text-[10px]">{s.mashinaRaqami ?? 'Ha'}</span>
                              : <span className="text-gray-500 text-[10px]">Yo'q</span>}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                                className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/25 text-primary transition-colors" title="Tahrirlash">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDelete(sub)} disabled={deletingId === sub.id}
                                className="grid place-items-center w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 transition-colors disabled:opacity-40" title="O'chirish">
                                {deletingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Qurulish table: 13 columns */}
              {globalCategory === 'qurulish' && (
                <table className="w-full border-collapse text-left" style={{ minWidth: 980 }}>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {['№', 'VAQT', 'ZAPRAVKA', 'XODIM', 'KORXONA', 'OBYEKT', 'TEXNIKA', 'LAVOZIM', 'QANCHA (kg)', 'DOP LIMIT', 'MASHINA', "MAS'UL", 'AMAL'].map((label) => (
                        <th key={label} className="px-2 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-nowrap" style={{ color: '#b91c1c' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalPaginated.map((sub, i) => {
                      const s = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const zap = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowNum = (globalPage - 1) * PAGE_SIZE + i + 1;
                      const rowBg = i % 2 === 0 ? '#111c11' : '#0f190f';
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className="px-2 py-2 text-center align-top"><span className="text-gray-400 font-bold text-[10px]">{rowNum}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 font-bold text-[10px] block max-w-[90px] truncate">{zap?.name ?? s.stationId ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <p className="text-emerald-400 font-black text-[10px] break-all">{s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}</p>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-cyan-400 font-black text-[10px] break-words">{s.korxonaNomi ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-200 text-[10px] font-bold break-words">{s.obyekt ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top text-center"><span className="text-gray-300 text-[10px] font-bold">{s.texnikaSoni ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold break-words">{s.lavozim ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top text-right">
                            <span className={`font-black text-sm tabular-nums ${s.isOverLimit ? 'text-red-400' : 'text-lime-300'}`}>{Number(s.qanchaOlindi ?? 0).toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className="px-2 py-2 align-top text-right">
                            {s.dopLimit ? <span className="text-orange-400 font-bold text-[10px]">{Number(s.dopLimit).toLocaleString('uz-UZ')}</span> : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="px-2 py-2 align-top">
                            {s.mashinadaYetkazildi
                              ? <span className="text-blue-400 font-bold text-[10px]">{s.mashinaRaqami ?? 'Ha'}</span>
                              : <span className="text-gray-500 text-[10px]">Yo'q</span>}
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold break-words">{s.masulShaxs ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                                className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/25 text-primary transition-colors" title="Tahrirlash">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDelete(sub)} disabled={deletingId === sub.id}
                                className="grid place-items-center w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 transition-colors disabled:opacity-40" title="O'chirish">
                                {deletingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Tamirlash table: 11 columns */}
              {globalCategory === 'tamirlash' && (
                <table className="w-full border-collapse text-left" style={{ minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {['№', 'VAQT', 'ZAPRAVKA', 'XODIM', 'SERIYA/RAQAM', "TA'MIR TURI", 'QANCHA (kg)', 'DIZ MASLA', 'MASHINA', "MAS'UL", 'AMAL'].map((label) => (
                        <th key={label} className="px-2 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-nowrap" style={{ color: '#b91c1c' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalPaginated.map((sub, i) => {
                      const s = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const zap = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowNum = (globalPage - 1) * PAGE_SIZE + i + 1;
                      const rowBg = i % 2 === 0 ? '#111c11' : '#0f190f';
                      const tamirLabelMap: Record<string, string> = { katta: "Katta ta'mirlash", kichik: "Kichik ta'mirlash", profilaktika: 'Profilaktika' };
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className="px-2 py-2 text-center align-top"><span className="text-gray-400 font-bold text-[10px]">{rowNum}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 font-bold text-[10px] block max-w-[100px] truncate">{zap?.name ?? s.stationId ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <p className="text-emerald-400 font-black text-[10px] break-all">{s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}</p>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-cyan-400 font-black text-xs">{s.seriya ?? '—'}-{s.raqami ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold">{tamirLabelMap[s.tamirlashTuri] ?? s.tamirlashTuri ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top text-right">
                            <span className="text-lime-300 font-black text-sm tabular-nums">{Number(s.qanchaBerildi ?? 0).toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className="px-2 py-2 align-top text-right">
                            {Number(s.dizMasla) > 0 ? <span className="text-orange-400 font-black text-sm tabular-nums">{Number(s.dizMasla).toLocaleString('uz-UZ')}</span> : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="px-2 py-2 align-top">
                            {s.mashinadaYetkazildi
                              ? <span className="text-blue-400 font-bold text-[10px]">{s.mashinaRaqami ?? 'Ha'}</span>
                              : <span className="text-gray-500 text-[10px]">Yo'q</span>}
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold break-words">{s.masulShaxs ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => { setEditSub(sub); setEditOpen(true); }}
                                className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10 hover:bg-primary/25 text-primary transition-colors" title="Tahrirlash">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleDelete(sub)} disabled={deletingId === sub.id}
                                className="grid place-items-center w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 transition-colors disabled:opacity-40" title="O'chirish">
                                {deletingId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

            </div>
          )}

          {/* Bottom bar */}
          {!globalLoading && globalFiltered.length > 0 && (
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4" style={{ background: '#0a1a0a' }}>
              <span className="text-gray-400 font-bold text-sm">
                Jami yoqilg'i:{' '}
                <span className="text-white font-black text-base">{globalTotalFuel.toLocaleString()}</span> kg
              </span>
              {globalTotalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setGlobalPage(p => Math.max(1, p - 1))} disabled={globalPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2a1a] text-gray-300 disabled:opacity-30 hover:bg-[#2a3a2a] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, globalTotalPages) }, (_, idx) => {
                    const p = Math.max(1, Math.min(globalTotalPages - 4, globalPage - 2)) + idx;
                    return (
                      <button key={p} onClick={() => setGlobalPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${globalPage === p ? 'bg-yellow-500 text-black' : 'bg-[#1a2a1a] text-gray-300 hover:bg-[#2a3a2a]'}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button onClick={() => setGlobalPage(p => Math.min(globalTotalPages, p + 1))} disabled={globalPage === globalTotalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a2a1a] text-gray-300 disabled:opacity-30 hover:bg-[#2a3a2a] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      <SubmissionEditDrawer
        open={editOpen}
        submission={editSub}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      <RentCalendar
        isOpen={showGlobalCal}
        onClose={() => setShowGlobalCal(false)}
        onExportPdf={async (start, endDay) => {
          if (!start || !endDay) return;
          await exportPdfForDateRange(start, endDay);
        }}
        onExportErjuPdf={async (start, endDay) => {
          if (!start || !endDay) return;
          const s = new Date(start);
          s.setHours(0, 0, 0, 0);
          const last = new Date(endDay);
          last.setHours(0, 0, 0, 0);
          const endFull = new Date(last);
          endFull.setHours(23, 59, 59, 999);
          setGlobalDateRange({ start: s, end: endFull });
          setGlobalPage(1);
          await runErjuYpdfExport(s, last);
        }}
      />
    </div>
  );
}
