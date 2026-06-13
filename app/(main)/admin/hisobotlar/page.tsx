"use client";

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMidnightReset } from '@/lib/hooks/use-midnight-reset';
import { useStaffMap } from '@/lib/hooks/use-staff-map';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  ChevronUp, ChevronDown,
  Loader2, FileText, Calendar,
  X, AlertTriangle, Download, Car, Pencil, Trash2,
  ArrowLeft, Home, LogOut, User
} from 'lucide-react';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';
import { Submission, Category, Session } from '@/lib/types';
import { collection, query, where, orderBy, getDocs, onSnapshot, limit, startAfter, Timestamp } from 'firebase/firestore';
import { downloadErjuYpdf } from '@/lib/pdf/erju-malumotnoma-html';
import {
  buildCategoryDetailPdfTitle,
  buildLokomotivDetailPdfTitle,
  buildLokomotivInputPdfTitle,
  buildRemontInputPdfTitle,
  buildStroitelstvoInputPdfTitle,
  exportCategoryDetailPdf,
  exportLokomotivInputPdf,
  exportLokomotivDetailPdf,
  exportRemontInputPdf,
  exportStroitelstvoInputPdf,
} from '@/lib/pdf/lokomotiv-detail-pdf';
import type { FuelRecord } from '@/lib/pdf/erju-html-pdf';
import { db } from '@/lib/firebase/config';
import { deleteSubmissionWithSummary } from '@/lib/firebase/submission-mutations';
import RentCalendar from '@/app/calendar';
import { SubmissionEditDrawer } from '@/components/admin/submission-edit-drawer';
import { clearSession, getSession } from '@/lib/utils/session';
import { pdfText } from '@/lib/utils/pdf-text';
import { formatPdfNonZeroNumber, formatPdfNumber, parsePdfNumber } from '@/lib/utils/pdf-number';
import { PDF_CYRILLIC_FONT, useCyrillicPdfFont } from '@/lib/pdf/cyrillic-font';
import { savePdfDocument } from '@/lib/pdf/save-pdf';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function HisobotlarNavbar() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [time, setTime] = useState('');

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleTimeString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleHome = () => {
    if (!session) return;
    if (session.role === 'worker' && session.stationId) {
      router.push(`/zapravka/${session.stationId}/lokomotiv`);
    } else if (session.role === 'admin') {
      router.push('/admin');
    }
  };

  const handleLogout = () => {
    void clearSession();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/70 bg-white/82 backdrop-blur-2xl shadow-sm dark:border-white/10 dark:bg-slate-950/78">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-fuchsia-600 px-6 text-white shadow-lg shadow-violet-500/25 transition-transform active:scale-95"
            title="Орқага"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span className="text-sm font-black uppercase tracking-wide">Орқага</span>
          </button>
          <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/10 bg-primary/10 text-primary shadow-sm sm:grid">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="relative inline-flex max-w-full items-center">
              <span className="truncate bg-gradient-to-r from-emerald-600 via-blue-600 to-violet-600 bg-clip-text text-sm font-black uppercase tracking-[0.16em] text-transparent drop-shadow-sm sm:text-base">
                6-Ta ERJU ma&apos;lumotlari
              </span>
              <span className="pointer-events-none absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-violet-500" />
            </h1>
          </div>
        </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-2xl border border-primary/10 bg-white/70 px-3 py-2 text-xs font-bold text-muted-foreground shadow-sm dark:bg-white/5 sm:flex">
              <User className="h-4 w-4 text-primary" />
              <span className="whitespace-nowrap">{session?.displayName || 'Admin'}</span>
            </div>
            {time ? (
              <div className="hidden md:flex rounded-2xl border border-primary/10 bg-white/70 px-3 py-2 text-xs font-black tabular-nums tracking-widest text-primary shadow-sm dark:bg-white/5">
                {time}
              </div>
            ) : null}
            <ThemeToggle />
            <button
              type="button"
              onClick={handleHome}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/10 bg-white/70 text-muted-foreground shadow-sm transition-colors hover:bg-primary/10 hover:text-primary dark:bg-white/5"
              title="Bosh sahifa"
            >
              <Home className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-danger/10 bg-white/70 text-muted-foreground shadow-sm transition-colors hover:bg-danger/10 hover:text-danger dark:bg-white/5"
              title="Chiqish"
            >
              <LogOut className="h-5 w-5" />
            </button>
        </div>
      </div>
    </header>
  );
}

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
  arenda:   'Ijara',
};

const CAT_COLOR: Record<string, string> = {
  lokomotiv: 'text-cyan-300',
  korxona:   'text-emerald-300',
  qurulish:  'text-amber-300',
  tamirlash: 'text-rose-300',
};

/** Hisobotlar navbar — kirill (o‘zbekcha) */
const CAT_TAB_LABEL: Record<string, string> = {
  all: 'ВСЕ',
  lokomotiv: 'ЛОКОМОТИВ',
  korxona: 'ПРЕДПРИЯТИЕ',
  qurulish: 'СТРОИТЕЛЬСТВО',
  tamirlash: 'РЕМОНТ',
};

const CATEGORY_PDF_LABEL: Record<string, string> = {
  all: 'PDF',
  lokomotiv: 'LOK PDF',
  korxona: 'PRED PDF',
  qurulish: 'STROY PDF',
  tamirlash: 'REM PDF',
};

const CAT_TAB_STYLE: Record<string, { base: string; active: string }> = {
  all: {
    base: 'bg-blue-500 border-blue-400/90 hover:bg-blue-400',
    active: 'ring-2 ring-white border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]',
  },
  lokomotiv: {
    base: 'bg-violet-500 border-violet-400/90 hover:bg-violet-400',
    active: 'ring-2 ring-white border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]',
  },
  korxona: {
    base: 'bg-emerald-500 border-emerald-400/90 hover:bg-emerald-400',
    active: 'ring-2 ring-white border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]',
  },
  qurulish: {
    base: 'bg-amber-500 border-amber-400/90 hover:bg-amber-400',
    active: 'ring-2 ring-white border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]',
  },
  tamirlash: {
    base: 'bg-rose-500 border-rose-400/90 hover:bg-rose-400',
    active: 'ring-2 ring-white border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]',
  },
};

/** Jadval qatorlari uchun foizlar (yig’indi 100) — 16-ustun: AMAL tugmalari */
const HISOBOTLAR_COL_PCT = [3, 5, 6, 8, 6, 7, 7, 7, 5, 7, 7, 5, 7, 6, 7, 7];
const HISOBOTLAR_EDIT_BTN =
  'grid place-items-center h-8 w-8 shrink-0 rounded-lg border-2 border-emerald-300 bg-emerald-500 text-white shadow-[0_0_14px_rgba(34,197,94,0.75)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_18px_rgba(34,197,94,0.9)]';
const HISOBOTLAR_DELETE_BTN =
  'grid place-items-center h-8 w-8 shrink-0 rounded-lg border-2 border-red-300 bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.7)] transition-all hover:bg-red-400 hover:shadow-[0_0_18px_rgba(239,68,68,0.9)] disabled:opacity-40';
const KORXONA_COL_PCT = [4, 5, 8, 11, 15, 8, 8, 10, 8, 9, 14];
const QURULISH_COL_PCT = [3, 5, 7, 9, 8, 8, 9, 11, 7, 9, 9, 9, 7];
const TAMIRLASH_COL_PCT = [4, 6, 8, 12, 12, 12, 12, 10, 8, 8, 8];

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
  return parsePdfNumber(sub.qanchaBerildi ?? sub.qancha ?? sub.qanchaOlindi ?? 0);
}

function cellVal(raw: unknown, fallback = '—'): string {
  if (raw == null || String(raw) === '') return fallback;
  return String(raw);
}

function rowCreatedMs(row: any): number {
  const ts = row?.timestamp ?? row?.createdAt;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();

  const numeric = Number(ts);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const date = String(row?.dateISO ?? row?.date ?? '').trim();
  const time = String(row?.time ?? '').trim();
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

/** Y.PDF uchun submissions yozuvlarini ERJU fuel row formatiga moslash */
function timeFromSubmission(row: any): string {
  const ms = rowCreatedMs(row);
  if (!ms) return '';
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function submissionDateIso(row: any): string {
  const date = String(row?.dateISO ?? row?.date ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const ms = rowCreatedMs(row);
  return ms ? toIsoDateLocal(new Date(ms)) : toIsoDateLocal(new Date());
}

function submissionToErjuFuelRecord(row: Submission): FuelRecord | null {
  const anyRow = row as any;
  const stationId = String(anyRow.stationId ?? '').trim();
  if (!stationId) return null;

  const dateISO = submissionDateIso(anyRow);
  const zap = ZAPRAVKALAR.find((z) => z.id === stationId);
  const common = {
    id: String(anyRow.id ?? ''),
    date: dateISO,
    dateISO,
    locCode: stationId,
    supplyPoint: zap?.name ?? stationId,
    time: timeFromSubmission(anyRow),
    route: '',
    trainCode: '',
    trainNumber: '',
    staffName: String(anyRow.staffName ?? ''),
    staffCode: String(anyRow.staffCode ?? ''),
    category: String(anyRow.category ?? ''),
  } as FuelRecord & { category?: string; dateISO?: string };

  if (anyRow.category === 'lokomotiv') {
    const harakat = String(anyRow.harakatTuri ?? '');
    const locoNumber =
      harakat === 'manyovr'
        ? String(anyRow.stansiya ?? '')
        : harakat === 'xojalik'
          ? String(anyRow.tashkilot ?? '')
          : String(anyRow.poyezdNumber ?? '');
    return {
      ...common,
      moveType: harakat,
      locoSeries: String(anyRow.rusumi ?? ''),
      locoCode: String(anyRow.lokomotivNumber ?? ''),
      locoNumber,
      trainIndex: String(anyRow.ruxsatIndeksi ?? ''),
      weight: anyRow.poyezdVazni == null ? '' : String(anyRow.poyezdVazni),
      balanceBefore: anyRow.qoldiq == null ? '' : String(anyRow.qoldiq),
      fuelAmount: anyRow.qanchaBerildi == null ? '' : String(anyRow.qanchaBerildi),
      zagranitsa: anyRow.zagranitsa == null ? '' : String(anyRow.zagranitsa),
      zagranitsaAmount: anyRow.zagranitsa == null ? '' : String(anyRow.zagranitsa),
      maslaAmount: anyRow.dizMasla == null ? '' : String(anyRow.dizMasla),
      stansiya: String(anyRow.stansiya ?? ''),
      tashkilot: String(anyRow.tashkilot ?? ''),
      ijarachi: String(anyRow.ijarachi ?? ''),
    };
  }

  if (anyRow.category === 'korxona') {
    return {
      ...common,
      moveType: 'korxona',
      locoSeries: '',
      locoCode: '',
      locoNumber: String(anyRow.poyezdNumber ?? anyRow.korxonaNomi ?? ''),
      trainIndex: String(anyRow.ruxsatIndeksi ?? anyRow.korxonaNomi ?? ''),
      weight: '',
      balanceBefore: '',
      fuelAmount: anyRow.qancha == null ? '' : String(anyRow.qancha),
      maslaAmount: '',
    };
  }

  if (anyRow.category === 'qurulish') {
    return {
      ...common,
      moveType: 'qurulish',
      locoSeries: String(anyRow.seriya ?? anyRow.korxonaNomi ?? ''),
      locoCode: String(anyRow.raqami ?? ''),
      locoNumber: String(anyRow.poyezdNumber ?? ''),
      trainIndex: String(anyRow.ruxsatIndeksi ?? ''),
      weight: anyRow.poyezdVazni == null ? '' : String(anyRow.poyezdVazni),
      balanceBefore: anyRow.qoldiq == null ? '' : String(anyRow.qoldiq),
      fuelAmount: String(anyRow.qanchaBerildi ?? anyRow.qanchaOlindi ?? ''),
      maslaAmount: '',
    };
  }

  if (anyRow.category === 'tamirlash') {
    return {
      ...common,
      moveType: 'tamirlash',
      locoSeries: String(anyRow.seriya ?? ''),
      locoCode: String(anyRow.raqami ?? ''),
      locoNumber: '',
      trainIndex: String(anyRow.tamirlashTuri ?? ''),
      weight: '',
      balanceBefore: '',
      fuelAmount: anyRow.qanchaBerildi == null ? '' : String(anyRow.qanchaBerildi),
      maslaAmount: anyRow.dizMasla == null ? '' : String(anyRow.dizMasla),
    };
  }

  return null;
}

function submissionsToErjuFuelRecords(rows: Submission[]): FuelRecord[] {
  return rows
    .map(submissionToErjuFuelRecord)
    .filter((row): row is FuelRecord => !!row && parsePdfNumber(row.fuelAmount) > 0);
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
  return `${startUz} - ${endUz} oralig'ida tarqatilgan dizel yoqilg'isi tarqatilishi haqida ma'lumot`;
}

/** Y.PDF / ERJU MAʼLUMOTNOMA sarlavhasi */
function buildErjuReportTitle(start: Date, end: Date): string {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(end);
  b.setHours(0, 0, 0, 0);
  const same = a.getTime() === b.getTime();
  if (same) {
    return `${pad2(a.getDate())}.${pad2(a.getMonth() + 1)}.${a.getFullYear()} сведения о распределении дизельного топлива за сутки`;
  }
  const startUz = start.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endUz = end.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${startUz} - ${endUz} сведения о распределении дизельного топлива`;
}

// ─── Barcha yozuvlarni cursor-pagination bilan olish ─────────────────────────

async function fetchSubmissionsInRangeByBounds(
  startBound: Timestamp | number,
  endBound: Timestamp | number,
): Promise<Submission[]> {
  const all: Submission[] = [];
  let lastDoc: any = null;
  const batchSize = 1000;
  while (true) {
    const constraints: any[] = [
      where('timestamp', '>=', startBound),
      where('timestamp', '<=', endBound),
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

async function fetchAllSubmissionsInRange(start: Date, end: Date): Promise<Submission[]> {
  const byId = new Map<string, Submission>();
  const timestampRows = await fetchSubmissionsInRangeByBounds(
    Timestamp.fromDate(start),
    Timestamp.fromDate(end),
  );
  for (const row of timestampRows) byId.set(row.id, row);

  // Eski yozuvlarda timestamp number bo'lib qolgan bo'lsa ham hisobotdan tushib qolmasin.
  const numericRows = await fetchSubmissionsInRangeByBounds(start.getTime(), end.getTime());
  for (const row of numericRows) byId.set(row.id, row);

  return [...byId.values()];
}

async function fetchAllFuelRecordsInRange(isoStart: string, isoEnd: string): Promise<any[]> {
  const all: any[] = [];
  let lastDoc: any = null;
  const batchSize = 1000;
  while (true) {
    const constraints: any[] = [
      where('date', '>=', isoStart),
      where('date', '<=', isoEnd),
      orderBy('date', 'asc'),
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

type PdfStaffGroup = {
  stationId: string;
  staffName: string;
  rows: any[];
};

function getStaffNameForPdfGroup(row: any, staffMap?: Map<string, string>): string {
  const code = String(row?.staffCode ?? '').trim();
  const byCode = code && staffMap ? staffMap.get(code) : undefined;
  return String(byCode ?? row?.staffName ?? code ?? '').trim();
}

function getStaffKeyForPdfGroup(row: any): string {
  const code = String(row?.staffCode ?? '').trim();
  if (code) return `code:${code}`;

  const name = String(row?.staffName ?? '').trim();
  if (name) return `name:${name.toLowerCase()}`;

  return 'unknown';
}

function groupRowsByStationAndStaff(rows: any[], staffMap?: Map<string, string>): PdfStaffGroup[] {
  const groups = new Map<string, PdfStaffGroup>();

  for (const row of rows) {
    const stationId = String(row?.stationId ?? 'other');
    const staffName = getStaffNameForPdfGroup(row, staffMap);
    const groupKey = `${stationId}__${getStaffKeyForPdfGroup(row)}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { stationId, staffName, rows: [] });
    }
    groups.get(groupKey)!.rows.push(row);
  }

  return [...groups.values()]
    .map((group, index) => ({ group, index }))
    .sort((a, b) => {
      const stationA = ZAPRAVKALAR.findIndex((z) => z.id === a.group.stationId);
      const stationB = ZAPRAVKALAR.findIndex((z) => z.id === b.group.stationId);
      const orderA = stationA >= 0 ? stationA : Number.MAX_SAFE_INTEGER;
      const orderB = stationB >= 0 ? stationB : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;

      const firstA = Math.min(...a.group.rows.map((row) => rowCreatedMs(row)));
      const firstB = Math.min(...b.group.rows.map((row) => rowCreatedMs(row)));
      if (firstA !== firstB) return firstA - firstB;

      const staffDiff = a.group.staffName.localeCompare(b.group.staffName, 'uz');
      return staffDiff || a.index - b.index;
    })
    .map(({ group }) => group);
}

function exportTamirlashPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const sortedRows = sortRowsOldestFirst(rows);
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const W   = doc.internal.pageSize.width;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const lines = doc.splitTextToSize(pdfText(reportTitleLine), W - 28);
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
  for (const row of sortedRows) {
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

    for (const group of groupRowsByStationAndStaff(dateRows, staffMap)) {
      const stationId = group.stationId;
      const stRows = group.rows;
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      const stName = group.staffName ? `${stBase} - ${group.staffName}` : stBase;
      const zapTotal = stRows.reduce((acc, r) => acc + parsePdfNumber(r.qanchaBerildi ?? 0), 0);
      body.push([
        { content: stName, colSpan: 5, styles: { halign: 'left' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad } },
        { content: `jami: ${formatPdfNumber(zapTotal)} kg`, colSpan: 3, styles: { halign: 'right' as const, fontStyle: 'italic' as const, fontSize: 7, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad } },
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
          formatPdfNonZeroNumber(s.qanchaBerildi, '—'),
          formatPdfNonZeroNumber(s.dizMasla, '—'),
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

  const totalFuel = sortedRows.reduce((s, r) => s + parsePdfNumber(r.qanchaBerildi ?? 0), 0);
  const totalMasla = sortedRows.reduce((s, r) => s + parsePdfNumber(r.dizMasla ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Jami yoqilg'i: ${formatPdfNumber(totalFuel)} kg`, 14, fY + 8);
  if (totalMasla > 0) doc.text(`Jami diz masla: ${formatPdfNumber(totalMasla)} kg`, 14, fY + 14);
  savePdfDocument(doc, `tamirlash_${fileSlug}.pdf`);
}

function exportKorxonaPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const sortedRows = sortRowsOldestFirst(rows);
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
  for (const row of sortedRows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  const sortedDates = [...dateGroups.keys()].sort();

  const head = [["Vaqt", "Korxona nomi", "Poyezd raqami", "Index", "Qancha (kg)", "Necha sutkalik", "Mashinada", "Mas'ul"]];
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
      body.push([{ content: `${dd}.${m}.${y}`, colSpan: 9, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: dateBg, textColor: dateFg, cellPadding: { top:2,bottom:2,left:3,right:3 } } }]);
    }
    for (const group of groupRowsByStationAndStaff(dateRows, staffMap)) {
      const stationId = group.stationId;
      const stRows = group.rows;
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      const stName = group.staffName ? `${stBase} - ${group.staffName}` : stBase;
      const zapTotal = stRows.reduce((acc,r) => acc + parsePdfNumber(r.qancha ?? 0), 0);
      body.push([
        { content: stName,          colSpan: 4, styles: { halign:'left'  as const, fontStyle:'bold'   as const, fontSize:8, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
        { content: `jami: ${formatPdfNumber(zapTotal)} kg`, colSpan: 5, styles: { halign:'right' as const, fontStyle:'italic' as const, fontSize:7, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
      ]);
      for (const s of stRows) {
        const { time } = fmtDate(s.timestamp);
        const mashinaStr = s.mashinadaYetkazildi ? (s.mashinaRaqami ? `Ha · ${s.mashinaRaqami}` : 'Ha') : "Yo'q";
        body.push([time, String(s.korxonaNomi ?? '—'), String(s.poyezdNumber ?? '—'), String(s.ruxsatIndeksi ?? '—'), formatPdfNumber(s.qancha ?? 0), String(s.nechaSutkalik ?? '—'), mashinaStr, s.staffName ?? '—']);
      }
    }
  }

  autoTable(doc, {
    head, body, startY: yTitle + 4, theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [0,0,0], lineWidth: 0.2 },
    headStyles: { fillColor: [20,80,20], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8, lineColor: [0,0,0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [245,252,245] },
    columnStyles: {
      0:{cellWidth:20}, 1:{cellWidth:50}, 2:{cellWidth:24}, 3:{cellWidth:24},
      4:{cellWidth:30,halign:'right'as const}, 5:{cellWidth:24},
      6:{cellWidth:28}, 7:{cellWidth:40},
    },
  });
  const total = sortedRows.reduce((s,r) => s + parsePdfNumber(r.qancha ?? 0), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(`Jami berildi: ${formatPdfNumber(total)} kg`, 14, fY + 8);
  savePdfDocument(doc, `korxona_${fileSlug}.pdf`);
}

function exportQurulishPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const sortedRows = sortRowsOldestFirst(rows);
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
  for (const row of sortedRows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  const sortedDates = [...dateGroups.keys()].sort();

  const head = [
    [
      { content: 'Vaqt\n1', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Teplovozlar bo'yicha ma'lumot", colSpan: 2, styles: { halign: 'center' as const } },
      { content: "Poyezdlar va tashkilotlar bo'yicha ma'lumot", colSpan: 4, styles: { halign: 'center' as const } },
      { content: "Diz.Yoqilg'i berishdan\noldingi bakdagi\nqoldiq\n8", rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Berilgan diz\nyoqilg'i miqdori\n9", rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: 'Umumiy miqdor, kg\n10', rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
    ],
    [
      { content: 'Seriya\n2', styles: { halign: 'center' as const } },
      { content: 'Raqami\n3', styles: { halign: 'center' as const } },
      { content: "Yo'nalish\n4", styles: { halign: 'center' as const } },
      { content: 'Poyezd raqami\n5', styles: { halign: 'center' as const } },
      { content: 'Indeksi\n6', styles: { halign: 'center' as const } },
      { content: 'Poyezd vazni\n7', styles: { halign: 'center' as const } },
    ],
  ];
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
      body.push([{ content: `${dd}.${m}.${y}`, colSpan: 10, styles: { halign: 'center' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: dateBg, textColor: dateFg, cellPadding: { top:2,bottom:2,left:3,right:3 } } }]);
    }
    for (const group of groupRowsByStationAndStaff(dateRows, staffMap)) {
      const stationId = group.stationId;
      const stRows = group.rows;
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      const stName = group.staffName ? `${stBase} - ${group.staffName}` : stBase;
      const zapTotal = stRows.reduce((acc,r) => acc + getAmount(r), 0);
      body.push([
        { content: stName,          colSpan: 5, styles: { halign:'left'  as const, fontStyle:'bold'   as const, fontSize:8, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
        { content: `jami: ${formatPdfNumber(zapTotal)} kg`, colSpan: 5, styles: { halign:'right' as const, fontStyle:'italic' as const, fontSize:7, fillColor:zapBg, textColor:zapFg, cellPadding:hdrPad } },
      ]);
      for (const s of stRows) {
        const { time } = fmtDate(s.timestamp);
        const amount = getAmount(s);
        const qoldiq = parsePdfNumber(s.qoldiq ?? 0);
        const hisob = qoldiq + amount;
        body.push([
          time,
          cellVal(s.seriya ?? s.korxonaNomi),
          cellVal(s.raqami),
          'Qurilish',
          cellVal(s.poyezdNumber),
          cellVal(s.ruxsatIndeksi),
          cellVal(s.poyezdVazni),
          formatPdfNonZeroNumber(qoldiq, '—'),
          formatPdfNonZeroNumber(amount, '—'),
          formatPdfNumber(hisob),
        ]);
      }
    }
  }

  autoTable(doc, {
    head, body, startY: yTitle + 4, theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.15, valign: 'middle', lineColor: [0,0,0], lineWidth: 0.2 },
    headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', fontSize: 7, lineColor: [0,0,0], lineWidth: 0.3, cellPadding: 1 },
    alternateRowStyles: { fillColor: [250,250,250] },
    columnStyles: { 0:{cellWidth:14}, 1:{cellWidth:20}, 2:{cellWidth:18}, 3:{cellWidth:22}, 4:{cellWidth:22}, 5:{cellWidth:28}, 6:{cellWidth:20}, 7:{cellWidth:26,halign:'right'as const}, 8:{cellWidth:22,halign:'right'as const}, 9:{cellWidth:22,halign:'right'as const} },
  });
  const total = sortedRows.reduce((s,r) => s + getAmount(r), 0);
  const fY = (doc as any).lastAutoTable?.finalY ?? 100;
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text(`Jami berildi: ${formatPdfNumber(total)} kg`, 14, fY + 8);
  savePdfDocument(doc, `qurulish_${fileSlug}.pdf`);
}

function exportPDF(rows: any[], fileSlug: string, reportTitleLine: string, staffMap?: Map<string, string>, showDateGroups = false) {
  const sortedRows = sortRowsOldestFirst(rows);
  const doc  = new jsPDF('landscape', 'mm', 'a4');
  useCyrillicPdfFont(doc);
  const W    = doc.internal.pageSize.width;
  const tableWidth = 214;
  const tableMarginX = (W - tableWidth) / 2;

  doc.setFontSize(9);
  doc.setFont(PDF_CYRILLIC_FONT, 'bold');
  const lines = doc.splitTextToSize(reportTitleLine, tableWidth);
  let yTitle = 8.5;
  lines.forEach((ln: string) => {
    doc.text(ln, W / 2, yTitle, { align: 'center' });
    yTitle += 4.2;
  });
  doc.setFont(PDF_CYRILLIC_FONT, 'normal');

  const tableStartY = yTitle + 1;

  // ── Avval sanalar bo'yicha guruhlash, keyin har bir sana ichida zapravka ──────
  const getRowDateKey = (row: any): string => {
    const ts = (row as any).timestamp;
    if (!ts) return '0000-00-00';
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(Number(ts));
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  };

  const dateGroups = new Map<string, any[]>();
  for (const row of sortedRows) {
    const dk = getRowDateKey(row);
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(row);
  }
  // Sanalarni o'sish tartibida saralash
  const sortedDates = [...dateGroups.keys()].sort();

  const head = [
    [
      { content: 'Vaqt\n1',                                           rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Teplovozlar bo'yicha ma'lumot",                     colSpan: 2, styles: { halign: 'center' as const } },
      { content: "Poyezdlar va tashkilotlar bo'yicha ma'lumot",       colSpan: 4, styles: { halign: 'center' as const } },
      { content: "Diz.Yoqilg'i berishdan\noldingi bakdagi\nqoldiq\n8", rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Berilgan diz\nyoqilg'i miqdori\n9",                 rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
      { content: "Umumiy miqdor,\nkg\n10",                            rowSpan: 2, styles: { halign: 'center' as const, valign: 'middle' as const } },
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
  const hdrPad = { top: 0.8, bottom: 0.8, left: 2.2, right: 2 };

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
          fontSize: 7,
          fillColor: dateBg,
          textColor: dateFg,
          cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
        },
      }]);
    }

    for (const group of groupRowsByStationAndStaff(dateRows, staffMap)) {
      const stationId = group.stationId;
      const stRows = group.rows;
      const stBase = ZAPRAVKALAR.find(z => z.id === stationId)?.name ?? stationId;
      const stName = group.staffName ? `${stBase} - ${group.staffName}` : stBase;
      const zapTotal = stRows.reduce((acc, r) => acc + getAmount(r), 0);

      body.push([
        {
          content: pdfText(stName),
          colSpan: 5,
          styles: { halign: 'left' as const, fontStyle: 'bold' as const, fontSize: 8, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad },
        },
        {
          content: `итого: ${formatPdfNumber(zapTotal)} кг`,
          colSpan: 5,
          styles: { halign: 'right' as const, fontStyle: 'italic' as const, fontSize: 7, fillColor: zapBg, textColor: zapFg, cellPadding: hdrPad },
        },
      ]);

      for (const s of stRows) {
        const { time } = fmtDate((s as any).timestamp);
        const amount   = getAmount(s);
        const qoldiq   = parsePdfNumber((s as any).qoldiq ?? 0);
        const hisob    = qoldiq + amount;
        const poyezdNum = (s as any).harakatTuri === 'manyovr'
          ? String((s as any).stansiya ?? '—')
          : (s as any).harakatTuri === 'xojalik'
            ? String((s as any).tashkilot ?? '—')
            : String((s as any).poyezdNumber ?? '—');
        const indexVal = String((s as any).ruxsatIndeksi ?? '—');
        body.push([
          time,
          pdfText((s as any).rusumi ?? (s as any).seriya),
          pdfText((s as any).lokomotivNumber ?? (s as any).raqami),
          pdfText(
            HARAKAT_LABEL[(s as any).harakatTuri]
              ?? (s as any).harakatTuri
              ?? (s as any).tamirlashTuri
              ?? (s as any).category
          ),
          pdfText(poyezdNum),
          pdfText(indexVal),
          (s as any).poyezdVazni != null && String((s as any).poyezdVazni) !== ''
            ? String((s as any).poyezdVazni)
            : '—',
          formatPdfNonZeroNumber(qoldiq, '—'),
          formatPdfNonZeroNumber(amount, '—'),
          formatPdfNumber(hisob),
        ]);
      }
    }
  }

  autoTable(doc, {
    head, body,
    startY: tableStartY,
    theme:             'grid',
    styles:            { font: PDF_CYRILLIC_FONT, fontSize: 6.1, cellPadding: 0.55, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.18 },
    headStyles:        { font: PDF_CYRILLIC_FONT, fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', fontSize: 6.1, lineColor: [0,0,0], lineWidth: 0.25, cellPadding: 0.55 },
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
    tableWidth,
    margin: { left: tableMarginX, right: tableMarginX },
  });

  // Umumiy jami — jadvaldan keyin, oxirgi sahifada, chapdan
  const grandTotal = sortedRows.reduce((s: number, r: any) => s + getAmount(r), 0);
  const margin = tableMarginX;
  const finalY = (doc as any).lastAutoTable?.finalY ?? 100;
  const pageH = doc.internal.pageSize.height;
  const blockH = 10;
  let grandY = finalY + blockH;
  if (grandY > pageH - margin) {
    doc.addPage();
    grandY = margin;
  }
  doc.setFontSize(8);
  doc.setFont(PDF_CYRILLIC_FONT, 'bold');
  doc.text(`Общий итог топлива: ${formatPdfNumber(grandTotal)} кг`, margin, grandY, { align: 'left' });

  savePdfDocument(doc, `hisobot_${fileSlug.replace(/[^\w.—]+/g, '_')}.pdf`);
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
    });
  }, [globalSortField]);

  const handleDelete = useCallback(async (sub: Submission) => {
    if (!window.confirm(`Ushbu yozuvni o'chirmoqchimisiz?\n#${sub.id.slice(-6)} — ${(sub as any).stationId ?? ''}`)) return;
    setDeletingId(sub.id);
    try {
      await deleteSubmissionWithSummary(sub);
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
        const titleLine = globalCategory === 'lokomotiv'
          ? buildLokomotivDetailPdfTitle(s, eDay)
          : globalCategory === 'korxona' || globalCategory === 'qurulish' || globalCategory === 'tamirlash'
            ? buildCategoryDetailPdfTitle(globalCategory, s, eDay)
            : buildOperationalPdfTitle(s, eDay);
        const fileSlug = globalDateRange
          ? `${toIsoDateLocal(s)}_${toIsoDateLocal(eDay)}`
          : `bugun_${toIsoDateLocal(s)}`;
        if (globalCategory === 'tamirlash') {
          exportCategoryDetailPdf(globalFiltered, {
            category: 'tamirlash',
            fileSlug,
            titleLine,
            staffMap,
          });
        } else if (globalCategory === 'korxona') {
          exportCategoryDetailPdf(globalFiltered, {
            category: 'korxona',
            fileSlug,
            titleLine,
            staffMap,
          });
        } else if (globalCategory === 'qurulish') {
          exportCategoryDetailPdf(globalFiltered, {
            category: 'qurulish',
            fileSlug,
            titleLine,
            staffMap,
          });
        } else if (globalCategory === 'lokomotiv') {
          exportLokomotivDetailPdf(globalFiltered, {
            fileSlug,
            titleLine,
            staffMap,
          });
        } else {
          exportPDF(globalFiltered, fileSlug, titleLine, staffMap);
        }
      } finally {
        setGlobalPdfLoading(false);
      }
    }, 50);
  }, [globalFiltered, globalDateRange, globalCategory, staffMap]);

  /** Taqvimdan: tanlangan davr bo'yicha submissions + xuddi jadvaldagi filtrlarga mos PDF */
  const exportPdfForDateRange = useCallback(async (start: Date, endDay: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(23, 59, 59, 999);
    setGlobalDateRange({ start: s, end: e });
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
      const titleLine = globalCategory === 'lokomotiv'
        ? buildLokomotivDetailPdfTitle(s, endForTitle)
        : globalCategory === 'korxona' || globalCategory === 'qurulish' || globalCategory === 'tamirlash'
          ? buildCategoryDetailPdfTitle(globalCategory, s, endForTitle)
          : buildOperationalPdfTitle(s, endForTitle);
      const fileSlug = `${toIsoDateLocal(s)}_${toIsoDateLocal(endDay)}`;
      if (globalCategory === 'tamirlash') {
        exportCategoryDetailPdf(rows, {
          category: 'tamirlash',
          fileSlug,
          titleLine,
          staffMap,
          showDateGroups: true,
        });
      } else if (globalCategory === 'korxona') {
        exportCategoryDetailPdf(rows, {
          category: 'korxona',
          fileSlug,
          titleLine,
          staffMap,
          showDateGroups: true,
        });
      } else if (globalCategory === 'qurulish') {
        exportCategoryDetailPdf(rows, {
          category: 'qurulish',
          fileSlug,
          titleLine,
          staffMap,
          showDateGroups: true,
        });
      } else if (globalCategory === 'lokomotiv') {
        exportLokomotivDetailPdf(rows, {
          fileSlug,
          titleLine,
          staffMap,
          showDateGroups: true,
        });
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

  /** Taqvimdagi L.PDF: tanlangan davr bo'yicha faqat lokomotiv yozuvlari */
  const exportLokomotivPdfForDateRange = useCallback(async (start: Date, endDay: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(23, 59, 59, 999);
    setGlobalDateRange({ start: s, end: e });
    setGlobalPdfLoading(true);
    try {
      const allRows = await fetchAllSubmissionsInRange(s, e);
      const rows = allRows.filter((row) => row.category === 'lokomotiv');
      if (!rows.length) {
        window.alert("Tanlangan davr uchun lokomotiv ma'lumoti yo'q.");
        return;
      }
      const endForTitle = new Date(endDay);
      endForTitle.setHours(0, 0, 0, 0);
      const titleLine = buildLokomotivInputPdfTitle(s, endForTitle);
      const fileSlug = `${toIsoDateLocal(s)}_${toIsoDateLocal(endDay)}`;
      exportLokomotivInputPdf(rows, {
        fileSlug,
        titleLine,
        staffMap,
        showDateGroups: false,
      });
    } catch (err) {
      console.error(err);
      window.alert("L.PDF tayyorlashda xato. Firestore indeksini tekshiring.");
    } finally {
      setGlobalPdfLoading(false);
    }
  }, [staffMap]);

  /** Taqvimdagi Predpriyatie PDF: tanlangan davr bo'yicha faqat korxona yozuvlari */
  const exportPredpriyatiePdfForDateRange = useCallback(async (start: Date, endDay: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(23, 59, 59, 999);
    setGlobalDateRange({ start: s, end: e });
    setGlobalPdfLoading(true);
    try {
      const allRows = await fetchAllSubmissionsInRange(s, e);
      const rows = allRows.filter((row) => row.category === 'korxona');
      if (!rows.length) {
        window.alert("Tanlangan davr uchun predpriyatie ma'lumoti yo'q.");
        return;
      }
      const endForTitle = new Date(endDay);
      endForTitle.setHours(0, 0, 0, 0);
      const titleLine = buildCategoryDetailPdfTitle('korxona', s, endForTitle);
      const fileSlug = `${toIsoDateLocal(s)}_${toIsoDateLocal(endDay)}`;
      exportCategoryDetailPdf(rows, {
        category: 'korxona',
        fileSlug,
        titleLine,
        staffMap,
        showDateGroups: true,
      });
    } catch (err) {
      console.error(err);
      window.alert("Predpriyatie PDF tayyorlashda xato. Firestore indeksini tekshiring.");
    } finally {
      setGlobalPdfLoading(false);
    }
  }, [staffMap]);

  /** Taqvimdagi Stroitelstvo PDF: tanlangan davr bo'yicha faqat qurilish yozuvlari */
  const exportStroitelstvoPdfForDateRange = useCallback(async (start: Date, endDay: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(23, 59, 59, 999);
    setGlobalDateRange({ start: s, end: e });
    setGlobalPdfLoading(true);
    try {
      const allRows = await fetchAllSubmissionsInRange(s, e);
      const rows = allRows.filter((row) => row.category === 'qurulish');
      if (!rows.length) {
        window.alert("Tanlangan davr uchun stroitelstvo ma'lumoti yo'q.");
        return;
      }
      const endForTitle = new Date(endDay);
      endForTitle.setHours(0, 0, 0, 0);
      const titleLine = buildStroitelstvoInputPdfTitle(s, endForTitle);
      const fileSlug = `${toIsoDateLocal(s)}_${toIsoDateLocal(endDay)}`;
      exportStroitelstvoInputPdf(rows, {
        fileSlug,
        titleLine,
        staffMap,
        showDateGroups: true,
      });
    } catch (err) {
      console.error(err);
      window.alert("Stroitelstvo PDF tayyorlashda xato. Firestore indeksini tekshiring.");
    } finally {
      setGlobalPdfLoading(false);
    }
  }, [staffMap]);

  /** Taqvimdagi Remont PDF: tanlangan davr bo'yicha faqat ta'mirlash yozuvlari */
  const exportRemontPdfForDateRange = useCallback(async (start: Date, endDay: Date) => {
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(23, 59, 59, 999);
    setGlobalDateRange({ start: s, end: e });
    setGlobalPdfLoading(true);
    try {
      const allRows = await fetchAllSubmissionsInRange(s, e);
      const rows = allRows.filter((row) => row.category === 'tamirlash');
      if (!rows.length) {
        window.alert("Tanlangan davr uchun remont ma'lumoti yo'q.");
        return;
      }
      const endForTitle = new Date(endDay);
      endForTitle.setHours(0, 0, 0, 0);
      const titleLine = buildRemontInputPdfTitle(s, endForTitle);
      const fileSlug = `${toIsoDateLocal(s)}_${toIsoDateLocal(endDay)}`;
      exportRemontInputPdf(rows, {
        fileSlug,
        titleLine,
        staffMap,
        showDateGroups: true,
      });
    } catch (err) {
      console.error(err);
      window.alert("Remont PDF tayyorlashda xato. Firestore indeksini tekshiring.");
    } finally {
      setGlobalPdfLoading(false);
    }
  }, [staffMap]);

  const runErjuYpdfExport = useCallback(async (rangeStart: Date, rangeEnd: Date) => {
    setGlobalErjuPdfLoading(true);
    try {
      const s = new Date(rangeStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(rangeEnd);
      e.setHours(0, 0, 0, 0);
      const endBound = new Date(e);
      endBound.setHours(23, 59, 59, 999);
      const submissions = await fetchAllSubmissionsInRange(s, endBound);
      const sourceRows = submissionsToErjuFuelRecords(submissions);
      if (!sourceRows.length) {
        window.alert("Tanlangan davr uchun Y.PDF ma'lumoti yo'q.");
        return;
      }
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
    <div className="min-h-screen bg-muted/20 pb-24">
      <HisobotlarNavbar />
      <main className="w-full min-w-0 max-w-[100vw] box-border px-3 sm:px-4 md:px-5 pt-3 pb-10 sm:pt-4 space-y-5 xl:max-w-[min(100vw-1.5rem,92rem)] xl:mx-auto">
        {/* Filter row — qora fon, rangli kategoriyalar */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-white/10 bg-black px-3 py-2.5 shadow-lg shadow-black/40">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {(['all', 'lokomotiv', 'korxona', 'qurulish', 'tamirlash'] as const).map(cat => {
              const tab = CAT_TAB_STYLE[cat];
              const isActive = globalCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    startTransition(() => {
                      setGlobalCategory(cat);
                    });
                  }}
                  className={[
                    'inline-flex h-10 items-center justify-center gap-2 rounded-xl border-2 px-4 transition-all whitespace-nowrap',
                    tab.base,
                    isActive ? tab.active : 'opacity-90',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-2.5 w-2.5 shrink-0 rounded-full',
                      isActive
                        ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]'
                        : 'bg-transparent',
                    ].join(' ')}
                    aria-hidden
                  />
                  <span className="text-xs font-black uppercase tracking-wide text-white drop-shadow-sm">
                    {CAT_TAB_LABEL[cat]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {globalDateRange && (
              <button
                type="button"
                onClick={() => {
                  setGlobalDateRange(null);
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/50 bg-red-500 text-white shadow-md shadow-red-500/30 transition-all hover:bg-red-600 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowGlobalCal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-sky-300/80 bg-sky-500 px-4 text-xs font-black uppercase tracking-wide text-white drop-shadow-sm shadow-md shadow-sky-500/30 transition-all hover:bg-sky-400 active:scale-95 whitespace-nowrap"
            >
              <Calendar className="h-[1.125rem] w-[1.125rem] shrink-0" />
              КАЛЕНДАР
            </button>
          </div>
        </div>

        {/* Dark table — chap tomonda bo‘sh joyda kengashmaslik uchun min-w-0 */}
        <div className="mt-2 w-full rounded-[20px] overflow-hidden shadow-2xl border border-[#2a3a2a] min-w-0 max-w-full sm:mt-3" style={{ background: '#111c11' }}>

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
                {globalPdfLoading ? 'Tayyorlanmoqda...' : CATEGORY_PDF_LABEL[globalCategory] ?? 'PDF'}
              </button>
              {globalCategory === 'all' ? (
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
              ) : null}
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
            <div className="w-full max-w-full min-w-0 overflow-x-hidden overflow-y-visible px-1 pb-3 sm:px-2">

              {/* All / Lokomotiv: original 16-column table */}
              {(globalCategory === 'all' || globalCategory === 'lokomotiv') && (
                <table className="hisobotlar-data-table w-full table-fixed border-collapse text-left">
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
                    {globalFiltered.map((sub, i) => {
                      const s      = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const amount = getAmount(s);
                      const qoldiq = parsePdfNumber(s.qoldiq ?? 0);
                      const masla  = parsePdfNumber(s.dizMasla ?? 0);
                      const hisob  = qoldiq + amount;
                      const rowNum = i + 1;
                      const zap    = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowBg  = i % 2 === 0 ? '#111c11' : '#0f190f';
                      const tafsilot = s.category === 'lokomotiv' ? (s.rusumi ?? '—') :
                                       s.category === 'korxona'   ? (s.korxonaNomi ?? '—') :
                                       s.category === 'qurulish'  ? (s.seriya ?? s.korxonaNomi ?? '—') :
                                       (s.seriya ?? '—');
                      const raqami  = s.lokomotivNumber ?? s.raqami ?? '—';
                      const harakat = HARAKAT_LABEL[s.harakatTuri] ?? s.harakatTuri ?? s.tamirlashTuri ?? s.category ?? '—';
                      const poyezdNumber = s.harakatTuri === 'manyovr'
                        ? (s.stansiya ?? '—')
                        : s.harakatTuri === 'xojalik'
                          ? (s.tashkilot ?? '—')
                          : (s.poyezdNumber ?? '—');
                      const rowIndexVal = s.ruxsatIndeksi ?? '—';
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
                            <span className={`inline-block max-w-full text-[9px] sm:text-[10px] font-black uppercase leading-tight break-words ${CAT_COLOR[s.category] ?? 'text-gray-300'}`}>
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
                            <span className="font-black text-[11px] sm:text-sm tabular-nums leading-tight break-all text-lime-300">{amount.toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className={`px-1.5 sm:px-2 py-2 align-top text-right border-solid ${hisobotlarDividerLeftClass(14, 'body')}`}>
                            <span className="text-cyan-200 font-black text-[11px] sm:text-sm tabular-nums leading-tight break-all [text-shadow:0_0_10px_rgba(34,211,238,0.28)]">{hisob.toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className={`overflow-visible px-1 py-2 align-top border-solid ${hisobotlarDividerLeftClass(15, 'body')}`}>
                            <div className="flex flex-nowrap items-center justify-center gap-1 leading-none">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSub(sub);
                                  setEditOpen(true);
                                }}
                                className={HISOBOTLAR_EDIT_BTN}
                                title="Tahrirlash"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(sub)}
                                disabled={deletingId === sub.id}
                                className={HISOBOTLAR_DELETE_BTN}
                                title="O'chirish"
                              >
                                {deletingId === sub.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Korxona table */}
              {globalCategory === 'korxona' && (
                <table className="hisobotlar-data-table w-full table-fixed border-collapse text-left">
                  <colgroup>
                    {KORXONA_COL_PCT.map((pct, idx) => (
                      <col key={idx} style={{ width: `${pct}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {['№', 'VAQT', 'ZAPRAVKA', 'XODIM', 'KORXONA NOMI', 'P.RAQ', 'INDEX', 'QANCHA (kg)', 'SUTKALIK', 'MASHINA', 'AMAL'].map((label) => (
                        <th key={label} className="px-1.5 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-normal" style={{ color: '#b91c1c' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalFiltered.map((sub, i) => {
                      const s = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const zap = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowNum = i + 1;
                      const rowBg = i % 2 === 0 ? '#111c11' : '#0f190f';
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className="px-2 py-2 text-center align-top"><span className="text-gray-400 font-bold text-[10px]">{rowNum}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span></td>
                          <td className="px-1.5 py-2 align-top"><span className="text-gray-300 font-bold text-[10px] block max-w-full truncate">{zap?.name ?? s.stationId ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <p className="text-emerald-400 font-black text-[10px] break-all">{s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}</p>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-cyan-400 font-black text-xs break-words">{s.korxonaNomi ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold break-words">{s.poyezdNumber ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-purple-300 text-[10px] font-bold break-words">{s.ruxsatIndeksi ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top text-right">
                            <span className="font-black text-sm tabular-nums text-lime-300">{parsePdfNumber(s.qancha ?? 0).toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold">{s.nechaSutkalik ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            {s.mashinadaYetkazildi
                              ? <span className="text-blue-400 font-bold text-[10px]">{s.mashinaRaqami ?? 'Ha'}</span>
                              : <span className="text-gray-500 text-[10px]">Yo'q</span>}
                          </td>
                          <td className="overflow-visible px-1 py-2 align-top">
                            <div className="flex flex-nowrap items-center justify-center gap-1 leading-none">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSub(sub);
                                  setEditOpen(true);
                                }}
                                className={HISOBOTLAR_EDIT_BTN}
                                title="Tahrirlash"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(sub)}
                                disabled={deletingId === sub.id}
                                className={HISOBOTLAR_DELETE_BTN}
                                title="O'chirish"
                              >
                                {deletingId === sub.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
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
                <table className="hisobotlar-data-table w-full table-fixed border-collapse text-left">
                  <colgroup>
                    {QURULISH_COL_PCT.map((pct, idx) => (
                      <col key={idx} style={{ width: `${pct}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {['№', 'VAQT', 'ZAPRAVKA', 'XODIM', 'SERIYA', 'RAQAMI', 'P.RAQ', 'INDEX', 'P.VAZNI', 'QOLDIQ', "YOQILG'I", 'HISOB', 'AMAL'].map((label) => (
                        <th key={label} className="px-1.5 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-normal" style={{ color: '#b91c1c' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalFiltered.map((sub, i) => {
                      const s = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const zap = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowNum = i + 1;
                      const rowBg = i % 2 === 0 ? '#111c11' : '#0f190f';
                      const amount = getAmount(s);
                      const qoldiq = parsePdfNumber(s.qoldiq ?? 0);
                      const hisob = qoldiq + amount;
                      const poyezdDisplay = s.harakatTuri === 'manyovr'
                        ? (s.stansiya ?? '—')
                        : s.harakatTuri === 'xojalik'
                          ? (s.tashkilot ?? '—')
                          : (s.poyezdNumber ?? '—');
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className="px-2 py-2 text-center align-top"><span className="text-gray-400 font-bold text-[10px]">{rowNum}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span></td>
                          <td className="px-1.5 py-2 align-top"><span className="text-gray-300 font-bold text-[10px] block max-w-full truncate">{zap?.name ?? s.stationId ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <p className="text-emerald-400 font-black text-[10px] break-all">{s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}</p>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-cyan-400 font-black text-[10px] break-words">{cellVal(s.seriya ?? s.korxonaNomi)}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-200 text-[10px] font-bold break-words">{cellVal(s.raqami)}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold break-words">{cellVal(poyezdDisplay)}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-purple-300 text-[10px] font-bold break-words">{cellVal(s.ruxsatIndeksi)}</span></td>
                          <td className="px-2 py-2 align-top text-right"><span className="text-gray-300 text-[10px] font-bold tabular-nums">{cellVal(s.poyezdVazni)}</span></td>
                          <td className="px-2 py-2 align-top text-right">
                            {qoldiq > 0 ? <span className="text-amber-200 font-black text-sm tabular-nums">{qoldiq.toLocaleString('uz-UZ')}</span> : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="px-2 py-2 align-top text-right">
                            <span className="font-black text-sm tabular-nums text-lime-300">{amount ? amount.toLocaleString('uz-UZ') : '—'}</span>
                          </td>
                          <td className="px-2 py-2 align-top text-right"><span className="text-cyan-200 font-black text-sm tabular-nums">{hisob.toLocaleString('uz-UZ')}</span></td>
                          <td className="overflow-visible px-1 py-2 align-top">
                            <div className="flex flex-nowrap items-center justify-center gap-1 leading-none">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSub(sub);
                                  setEditOpen(true);
                                }}
                                className={HISOBOTLAR_EDIT_BTN}
                                title="Tahrirlash"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(sub)}
                                disabled={deletingId === sub.id}
                                className={HISOBOTLAR_DELETE_BTN}
                                title="O'chirish"
                              >
                                {deletingId === sub.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
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
                <table className="hisobotlar-data-table w-full table-fixed border-collapse text-left">
                  <colgroup>
                    {TAMIRLASH_COL_PCT.map((pct, idx) => (
                      <col key={idx} style={{ width: `${pct}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ background: '#eab308' }}>
                      {['№', 'VAQT', 'ZAPRAVKA', 'XODIM', 'SERIYA/RAQAM', "TA'MIR TURI", 'QANCHA (kg)', 'DIZ MASLA', 'MASHINA', "MAS'UL", 'AMAL'].map((label) => (
                        <th key={label} className="px-1.5 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-tight whitespace-normal" style={{ color: '#b91c1c' }}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {globalFiltered.map((sub, i) => {
                      const s = sub as any;
                      const { time } = fmtDate(s.timestamp);
                      const zap = ZAPRAVKALAR.find(z => z.id === s.stationId);
                      const rowNum = i + 1;
                      const rowBg = i % 2 === 0 ? '#111c11' : '#0f190f';
                      const tamirLabelMap: Record<string, string> = { katta: "Katta ta'mirlash", kichik: "Kichik ta'mirlash", profilaktika: 'Profilaktika' };
                      return (
                        <tr key={sub.id} style={{ background: rowBg }} className="hover:brightness-125 transition-all">
                          <td className="px-2 py-2 text-center align-top"><span className="text-gray-400 font-bold text-[10px]">{rowNum}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-yellow-400 font-black text-[10px] tabular-nums">{time}</span></td>
                          <td className="px-1.5 py-2 align-top"><span className="text-gray-300 font-bold text-[10px] block max-w-full truncate">{zap?.name ?? s.stationId ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top">
                            <p className="text-emerald-400 font-black text-[10px] break-all">{s.staffCode ? (staffMap.get(s.staffCode.trim()) ?? s.staffName ?? s.staffCode) : '—'}</p>
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-cyan-400 font-black text-xs">{s.seriya ?? '—'}-{s.raqami ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold">{tamirLabelMap[s.tamirlashTuri] ?? s.tamirlashTuri ?? '—'}</span></td>
                          <td className="px-2 py-2 align-top text-right">
                            <span className="text-lime-300 font-black text-sm tabular-nums">{parsePdfNumber(s.qanchaBerildi ?? 0).toLocaleString('uz-UZ')}</span>
                          </td>
                          <td className="px-2 py-2 align-top text-right">
                            {parsePdfNumber(s.dizMasla) > 0 ? <span className="text-orange-400 font-black text-sm tabular-nums">{parsePdfNumber(s.dizMasla).toLocaleString('uz-UZ')}</span> : <span className="text-gray-600 text-[10px]">—</span>}
                          </td>
                          <td className="px-2 py-2 align-top">
                            {s.mashinadaYetkazildi
                              ? <span className="text-blue-400 font-bold text-[10px]">{s.mashinaRaqami ?? 'Ha'}</span>
                              : <span className="text-gray-500 text-[10px]">Yo'q</span>}
                          </td>
                          <td className="px-2 py-2 align-top"><span className="text-gray-300 text-[10px] font-bold break-words">{s.masulShaxs ?? '—'}</span></td>
                          <td className="overflow-visible px-1 py-2 align-top">
                            <div className="flex flex-nowrap items-center justify-center gap-1 leading-none">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditSub(sub);
                                  setEditOpen(true);
                                }}
                                className={HISOBOTLAR_EDIT_BTN}
                                title="Tahrirlash"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(sub)}
                                disabled={deletingId === sub.id}
                                className={HISOBOTLAR_DELETE_BTN}
                                title="O'chirish"
                              >
                                {deletingId === sub.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
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
              <span className="text-red-500 font-black text-sm">
                Жами ёқилғи:{' '}
                <span className="text-base">
                  {globalTotalFuel.toLocaleString('uz-UZ')}
                </span>{' '}
                кг қуйилган
              </span>
            </div>
          )}
        </div>

      </main>

      <SubmissionEditDrawer
        open={editOpen}
        submission={editSub}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />

      <RentCalendar
        isOpen={showGlobalCal}
        onClose={() => setShowGlobalCal(false)}
        pdfLabel={CATEGORY_PDF_LABEL[globalCategory] ?? 'PDF'}
        showErjuPdf={globalCategory === 'all'}
        onExportPdf={async (start, endDay) => {
          if (!start || !endDay) return;
          await exportPdfForDateRange(start, endDay);
        }}
        onExportLokomotivPdf={async (start, endDay) => {
          if (!start || !endDay) return;
          await exportLokomotivPdfForDateRange(start, endDay);
        }}
        onExportPredpriyatiePdf={async (start, endDay) => {
          if (!start || !endDay) return;
          await exportPredpriyatiePdfForDateRange(start, endDay);
        }}
        onExportStroitelstvoPdf={async (start, endDay) => {
          if (!start || !endDay) return;
          await exportStroitelstvoPdfForDateRange(start, endDay);
        }}
        onExportRemontPdf={async (start, endDay) => {
          if (!start || !endDay) return;
          await exportRemontPdfForDateRange(start, endDay);
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
          await runErjuYpdfExport(s, last);
        }}
      />
    </div>
  );
}
