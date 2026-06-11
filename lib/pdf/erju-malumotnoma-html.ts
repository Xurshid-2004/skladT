/**
 * ERJU «MAʼLUMOTNOMA»: harakat tur bo'yicha yig'inmalar ASOSIY jadval + pivot.
 * FAQAT yoqilg'i (fuelAmount) — balanceBefore yoqilmaydi.
 */

import type { FuelRecord } from '@/lib/pdf/erju-html-pdf';
import { ERJU_DATA } from '@/lib/data/erju-data';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';
import { PDF_CYRILLIC_FONT, useCyrillicPdfFont } from '@/lib/pdf/cyrillic-font';
import { formatPdfNonZeroNumber, parsePdfNumber } from '@/lib/utils/pdf-number';
import { pdfText } from '@/lib/utils/pdf-text';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface IndexedOption {
  /** Jadval ustunidagi tartib (kichikdan katta) */
  index: number;
  /** Ichki kalit — harakat ustuni */
  id: string;
  /** Jadval sarlavhasi */
  label: string;
  /** moveType qiymati bilan moslashtirish (lotin/kirill, registr) */
  aliases?: readonly string[];
}

export interface Staff {
  /** users/{docId} uchun kod */
  code: string;
  displayName?: string;
  stationId?: string;
}

const NOMA_KEY = '__noma__';

/** Jadvalda 0 qiymatlarni boʻsh chiqaradi */
export function fmt(val: unknown): string {
  return formatPdfNonZeroNumber(val);
}

function toNum(v: unknown): number {
  return parsePdfNumber(v);
}

const TEPLOVOZ_TOTAL_KEYS = new Set(['yuk', 'yolovchi', 'manyovr', 'xojalik']);
const YPDF_STATION_NUMBERS: Record<string, number> = {
  toshkent: 1,
  angren: 3,
  sirdaryo: 4,
  hovos: 5,
  jizzax: 6,
  qoqon: 7,
  marglon: 8,
  andijon: 10,
  samarqand: 11,
  ziyovuddin: 13,
  buxoro: 14,
  tinchlik: 15,
  uchquduq: 16,
  qarshi: 17,
  termez: 18,
  darband: 19,
  qongirot: 20,
  urganch: 23,
  miskin: 24,
  qumqurgon: 26,
};
const YPDF_PIVOT_BUCKET_ORDER = [
  'rju-toshkent',
  'rju-qoqon',
  'rju-buxoro',
  'rju-qarshi',
  'rju-termiz',
  'rju-qongirot',
];
const YPDF_COUNT_ROWS = [
  { id: 'yuk', label: 'gr' },
  { id: 'yolovchi', label: 'pas' },
  { id: 'manyovr', label: 'man' },
  { id: 'xojalik', label: 'x/r' },
  { id: 'ijara', label: 'ar' },
] as const;

function roundKgToYpdfTons(kg: unknown): number {
  return Math.round((toNum(kg) / 1000) * 100) / 100;
}

function formatYpdfTons(tons: unknown): string {
  return toNum(tons)
    .toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    })
    .replace('.', ',');
}

function ypdfTons(kg: unknown): string {
  return formatYpdfTons(roundKgToYpdfTons(kg));
}

function addYpdfTons(a: number, b: number): number {
  return Math.round((a + b) * 100) / 100;
}

function sumMoveValues(map: Map<string, number>, keys: ReadonlySet<string>): number {
  let total = 0;
  for (const key of keys) total += map.get(key) ?? 0;
  return total;
}

const YPDF_WEEKDAYS_UZ = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];

function formatYpdfDayLabel(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return dateKey;

  const [, year, month, day] = m;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = Number.isNaN(d.getTime()) ? '' : YPDF_WEEKDAYS_UZ[d.getDay()];
  return weekday ? `${day}.${month}.${year} (${weekday})` : `${day}.${month}.${year}`;
}

const ZAGRANITSA_KEY = 'zagranitsa';

function getZagranitsaAmount(r: FuelRecord): number {
  return toNum((r as any).zagranitsaAmount ?? (r as any).zagranitsa ?? 0);
}

function normalizeSupplyKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/\bzapravka\b/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const CYR_LAT_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ч: 'ch',
  ш: 'sh',
};

function latinizeForMatch(s: string): string {
  let o = normalizeSupplyKey(s);
  let out = '';
  for (const ch of o) out += CYR_LAT_MAP[ch] ?? ch;
  return out.replace(/[^a-z0-9\s]/gi, '').replace(/\s+/g, ' ').trim();
}

function zapBySupplyOrLoc(r: FuelRecord, staffByCode: Map<string, Staff>): (typeof ZAPRAVKALAR)[0] | null {
  const spRaw = String(r.supplyPoint ?? '').trim();
  const spNorm = normalizeSupplyKey(spRaw);
  const lat = latinizeForMatch(spRaw);

  let z =
    ZAPRAVKALAR.find((x) => normalizeSupplyKey(x.name) === spNorm) ??
    ZAPRAVKALAR.find((x) => latinizeForMatch(x.name) === lat) ??
    ZAPRAVKALAR.find((x) => latinizeForMatch(spRaw).includes(latinizeForMatch(x.name)) || latinizeForMatch(x.name).includes(lat));

  if (z) return z;

  if (r.locCode && ZAPRAVKALAR.some((x) => x.id === String(r.locCode))) {
    return ZAPRAVKALAR.find((x) => x.id === String(r.locCode)) ?? null;
  }

  const st = staffByCode.get(String(r.staffCode ?? '').trim());
  if (st?.stationId && ZAPRAVKALAR.some((x) => x.id === st.stationId)) {
    return ZAPRAVKALAR.find((x) => x.id === st.stationId) ?? null;
  }

  return null;
}

/** ERJU blok ID yoki yoʻq boʻlsa skip */
function erjuBucketForStation(zId: string): (typeof ERJU_DATA)[number] | null {
  return ERJU_DATA.find((b) => b.zapravkalar.includes(zId)) ?? null;
}

/** Qisqa ustun nomi — «РЖУ-Тошкент» → «Тошкент» */
function erjuPivotColTitle(fullName: string): string {
  return fullName.replace(/^(РЖУ|РКУ|РЮ)[\s\-—]+/iu, '').trim() || fullName;
}

const MISC_AGG = '__misc_agg__';

const MISC_OPTION: IndexedOption = {
  index: 998,
  id: MISC_AGG,
  label: 'Boshqa',
};

/** Tanlangan harakat ustunlari (NOMA ustunisiz moslash) — bo‘sh harakat uchun NOMA_KEY */
function moveColumnKey(raw: unknown, cols: IndexedOption[]): string {
  const s = String(raw ?? '').trim();
  const sn = s.toLowerCase();
  if (!s) return NOMA_KEY;

  const sorted = [...cols]
    .filter((x) => x.id !== NOMA_KEY && x.id !== MISC_AGG)
    .sort((a, b) => a.index - b.index);

  for (const c of sorted) {
    if (sn === String(c.id).toLowerCase()) return c.id;
    for (const a of c.aliases ?? []) {
      if (sn === String(a).toLowerCase()) return c.id;
      const ln = latinizeForMatch(sn);
      const la = latinizeForMatch(String(a));
      if (ln && la && ln === la) return c.id;
    }
  }
  return MISC_AGG;
}

function rowNeedsMiscRow(r: FuelRecord, staffByCode: Map<string, Staff>, matchCols: IndexedOption[]): boolean {
  const fuel = toNum(r.fuelAmount);
  if (fuel <= 0) return false;
  const z = zapBySupplyOrLoc(r, staffByCode);
  if (!z) return false;
  const ej = erjuBucketForStation(z.id);
  if (!ej) return false;
  const mt = String(r.moveType ?? '').trim();
  if (!mt) return false;
  return moveColumnKey(mt, matchCols) === MISC_AGG;
}

const DEFAULT_MOVES: readonly IndexedOption[] = Object.freeze([
  { index: 0, id: 'yuk', label: 'Yuk poyezdlari uchun', aliases: ['yuk', 'грузовой', 'gruz'] },
  { index: 1, id: 'yolovchi', label: "Yo'lovchi poyezdlari uchun", aliases: ['yolovchi', "yo'lovchi", 'yoʻlovchi', 'пасс', 'pass'] },
  { index: 2, id: 'manyovr', label: 'Manyovr ishlari uchun', aliases: ['manyovr', 'manevr', 'маневр', 'manyevr'] },
  { index: 3, id: 'xojalik', label: "Xo'jalik ishlari uchun", aliases: ['xojalik', "xo'jalik", 'хоз', 'hojalik'] },
  { index: 4, id: 'ijara', label: 'Ijara', aliases: ['ijara', 'ижара', 'arena', 'arenda', 'аренда'] },
  {
    index: 5,
    id: 'tamirlash',
    label: "Teplovoz ta'miri uchun",
    aliases: ['tamirlash', 'tamir', 'tamlash', 'repair'],
  },
  {
    index: 6,
    id: ZAGRANITSA_KEY,
    label: 'Zagranitsa',
    aliases: ['zagranitsa', 'zagranisa', 'zagranintsa', 'ref', 'refrigerat', 'seksiya'],
  },
  {
    index: 7,
    id: 'korxona',
    label: 'Korxonalarga',
    aliases: ['korxona', 'kompensatsiya', 'компенс', 'компенсация', 'organisation'],
  },
  {
    index: 8,
    id: 'qurulish',
    label: 'Qurilish ishlariga',
    aliases: ['qurulish', 'ombor', 'ombor ehtiyoji', 'склад', 'warehouse', 'qurilish ishlari'],
  },
]);

/** Y.PDF uchun namuna tartibidagi qat'iy ustunlar */
const YPDF_COLUMNS: readonly IndexedOption[] = Object.freeze([
  { index: 0, id: 'yuk', label: 'Yuk poyezd. tashish uchun', aliases: ['yuk', 'gruz'] },
  { index: 1, id: 'yolovchi', label: "Yo'lovchi poyezd. tashish uchun", aliases: ['yolovchi', "yo'lovchi", 'pass', 'pas', 'prigor'] },
  { index: 2, id: 'manyovr', label: 'Manyovr ishlarida', aliases: ['manyovr', 'manevr', 'manyevr'] },
  { index: 3, id: 'xojalik', label: "Xo'jalik ishlarida", aliases: ['xojalik', "xo'jalik", 'hojalik'] },
  { index: 4, id: 'ijara', label: 'Ijara', aliases: ['ijara', 'arena', 'arenda'] },
  { index: 5, id: 'tamirlash', label: "Teplovozlar ta'miri uchun", aliases: ['tamirlash', 'tamir', 'tamlash', 'repair'] },
  { index: 6, id: ZAGRANITSA_KEY, label: 'Zagranitsa', aliases: ['zagranitsa', 'zagranisa', 'zagranintsa', 'ref', 'refrigerat', 'seksiya'] },
  { index: 7, id: 'korxona', label: 'Korxonalarga', aliases: ['korxona', 'kompensatsiya', 'organisation'] },
  { index: 8, id: 'qurulish', label: 'Qurilish ishlariga', aliases: ['qurulish', 'qurilish', 'ombor', 'ombor ehtiyoji', 'warehouse', 'qurilish ishlari'] },
]);

/** Jadval uchun Noma ustuni (faqat zarur boʻlganida) */
const NOMA_OPTION: IndexedOption = {
  index: 999,
  id: NOMA_KEY,
  label: "Turi yo'q",
};

function ypdfMoveColumnKey(r: FuelRecord, cols: IndexedOption[]): string {
  const category = String((r as any).category ?? '').trim().toLowerCase();
  if (category === 'korxona' || category === 'qurulish' || category === 'qurilish' || category === 'tamirlash') {
    return category === 'qurilish' ? 'qurulish' : category;
  }

  const mk = moveColumnKey(r.moveType, cols);
  if (mk !== NOMA_KEY && mk !== MISC_AGG) return mk;

  const raw = [r.moveType, r.route, r.trainIndex, (r as any).ruxsatIndeksi]
    .map((v) => latinizeForMatch(String(v ?? '')))
    .join(' ');
  if (/\b(gruz|yuk)\b/.test(raw)) return 'yuk';
  if (/\b(pass|pas|prigor|yolovchi)\b/.test(raw)) return 'yolovchi';
  if (/\b(manevr|manyovr|manyevr)\b/.test(raw)) return 'manyovr';
  if (/\b(arenda|arena|ijara)\b/.test(raw)) return 'ijara';
  if (/\b(pred|korxona)\b/.test(raw)) return 'korxona';
  if (/\b(stroit|quril|sklad|ombor)\b/.test(raw)) return 'qurulish';
  if (/\b(ref|seksiya|zagran)\b/.test(raw)) return ZAGRANITSA_KEY;

  return MISC_AGG;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * ERJU MAʼLUMOTNOMA chop etish oynasi
 */
export function handleExportErjuPdf(
  sourceRows: FuelRecord[],
  reportTitle: string,
  moveOptions: IndexedOption[],
  staffList: Staff[],
): void {
  const staffByCode = new Map<string, Staff>();
  for (const s of staffList) staffByCode.set(String(s.code).trim(), s);

  let cols =
    [...(moveOptions?.length ? moveOptions : [...DEFAULT_MOVES])].sort((a, b) => a.index - b.index) ?? [...DEFAULT_MOVES];

  /** Hech boʻlmasa bir harakat ustuni */
  if (cols.length === 0) cols = [...DEFAULT_MOVES];

  const usedNoma = sourceRows.some((r) => {
    if (toNum(r.fuelAmount) <= 0) return false;
    return !String(r.moveType ?? '').trim();
  });

  /** Noma uchun maxsus ustun */
  let activeCols = cols.filter((c) => c.id !== NOMA_KEY);
  if (usedNoma && !activeCols.some((c) => c.id === NOMA_KEY))
    activeCols = [...activeCols, NOMA_OPTION].sort((a, b) => a.index - b.index);

  const matchColsSansNoma = activeCols.filter((c) => c.id !== NOMA_KEY && c.id !== MISC_AGG);
  const miscNeeded = sourceRows.some((row) =>
    rowNeedsMiscRow(row as FuelRecord, staffByCode, matchColsSansNoma),
  );
  if (miscNeeded && !activeCols.some((c) => c.id === MISC_AGG))
    activeCols = [...activeCols, MISC_OPTION].sort((a, b) => a.index - b.index);

  type ZapAgg = { stationId: string; label: string; byMove: Map<string, number>; totalFuel: number };
  type BucketAgg = {
    bucketId: string;
    bucketTitle: string;
    pivotShort: string;
    zaps: Map<string, ZapAgg>;
  };

  const bucketMap = new Map<string, BucketAgg>();

  for (const er of ERJU_DATA) {
    bucketMap.set(er.id, {
      bucketId: er.id,
      bucketTitle: er.name,
      pivotShort: erjuPivotColTitle(er.name),
      zaps: new Map(),
    });
  }

  for (const r of sourceRows) {
    const z = zapBySupplyOrLoc(r, staffByCode);
    if (!z) continue;
    const ej = erjuBucketForStation(z.id);
    if (!ej) continue;

    const fuel = toNum(r.fuelAmount);
    const zagranitsaFuel = getZagranitsaAmount(r);
    /** balanceBefore yoqiladi emas — nol yozuv hammaga ta'sirsiz */
    if (fuel <= 0 && zagranitsaFuel <= 0) continue;

    const bucket = bucketMap.get(ej.id);
    if (!bucket) continue;

    if (!bucket.zaps.has(z.id)) {
      bucket.zaps.set(z.id, {
        stationId: z.id,
        label: z.name,
        byMove: new Map(),
        totalFuel: 0,
      });
    }

    const za = bucket.zaps.get(z.id)!;
    if (fuel > 0) {
      const mk = moveColumnKey(r.moveType, activeCols);
      za.byMove.set(mk, (za.byMove.get(mk) ?? 0) + fuel);
      za.totalFuel += fuel;
    }
    if (zagranitsaFuel > 0) {
      const zk = moveColumnKey(ZAGRANITSA_KEY, activeCols);
      if (zk !== NOMA_KEY && zk !== MISC_AGG) {
        za.byMove.set(zk, (za.byMove.get(zk) ?? 0) + zagranitsaFuel);
        za.totalFuel += zagranitsaFuel;
      }
    }
  }

  const orderedBuckets = ERJU_DATA.map((ej) => bucketMap.get(ej.id)!)
    .filter((b): b is BucketAgg => !!b && b.zaps.size > 0);

  const colSpanMain = 4 + activeCols.length;

  /** Asosiy jadval tbody */
  let mainTbody = '';
  let globalRowNum = 0;

  const grandByMoveGlobal = new Map<string, number>();
  let grandTotalFuel = 0;

  const pivotErjuTotals = new Map<string, Map<string, number>>();
  for (const b of orderedBuckets) pivotErjuTotals.set(b.bucketId, new Map());

  for (const b of orderedBuckets) {
    const zapOrder = [...b.zaps.keys()].sort((aId, bId) => {
      const order = ERJU_DATA.find((e) => e.id === b.bucketId)?.zapravkalar ?? [];
      const ia = order.indexOf(aId);
      const ib = order.indexOf(bId);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return aId.localeCompare(bId, 'uz');
    });

    mainTbody += `<tr><td class="rj" colspan="${colSpanMain}">${esc(b.bucketTitle)}</td></tr>`;

    const bucketSumMove = new Map<string, number>();
    let bucketTotalFuel = 0;

    for (const zapId of zapOrder) {
      const za = b.zaps.get(zapId)!;
      globalRowNum += 1;

      bucketTotalFuel += za.totalFuel;

      const cellsMoves = activeCols.map((c) => {
        const v = za.byMove.get(c.id) ?? 0;
        return `<td class="r">${fmt(v)}</td>`;
      }).join('');

      const pivotMap = pivotErjuTotals.get(b.bucketId)!;
      for (const c of activeCols) {
        const v = za.byMove.get(c.id) ?? 0;
        if (v <= 0) continue;
        pivotMap.set(c.id, (pivotMap.get(c.id) ?? 0) + v);
        grandByMoveGlobal.set(c.id, (grandByMoveGlobal.get(c.id) ?? 0) + v);
      }

      mainTbody += `<tr class="zr">
<td class="c">${globalRowNum}</td>
<td class="zp">${esc(za.label)}</td>
<td class="r">${fmt(za.totalFuel)}</td>
<td class="r">${fmt(za.totalFuel)}</td>
${cellsMoves}
</tr>`;

      for (const [k, vv] of za.byMove)
        bucketSumMove.set(k, (bucketSumMove.get(k) ?? 0) + vv);

      grandTotalFuel += za.totalFuel;
    }

    /** Jami satr — birinchi 2 katakbirlashtirilgan */
    const jcells = activeCols
      .map((c) => `<td class="r jsum">${fmt(bucketSumMove.get(c.id) ?? 0)}</td>`)
      .join('');
    mainTbody += `<tr class="sum">
<td colspan="2" class="rjami">${esc(`Jami ${b.bucketTitle}`)}</td>
<td class="r jsum">${fmt(bucketTotalFuel)}</td>
<td class="r jsum">${fmt(bucketTotalFuel)}</td>
${jcells}
</tr>`;
  }

  /** UMUMIY JAMI satri */
  const ucells = activeCols
    .map((c) => `<td class="r jsum">${fmt(grandByMoveGlobal.get(c.id) ?? 0)}</td>`)
    .join('');
  if (orderedBuckets.length > 0) {
    mainTbody += `<tr class="sum grand">
<td colspan="2" class="rjami">${esc(`UMUMIY JAMI`)}</td>
<td class="r jsum">${fmt(grandTotalFuel)}</td>
<td class="r jsum">${fmt(grandTotalFuel)}</td>
${ucells}
</tr>`;
  }

  /** Pivot ikkinchi jadval */
  let pivotTHEAD = `<th></th>${orderedBuckets
    .map((b) => `<th>${esc(b.pivotShort)}</th>`)
    .join('')}<th>Jami</th>`;

  let pivotBODY = '';

  /** Pastki jadval: faqat barcha hududlar bo'yicha yig'indisi 0 dan katta harakat qatorlari */
  for (const mv of activeCols) {
    const rowTot = orderedBuckets.reduce(
      (s, bb) => s + (pivotErjuTotals.get(bb.bucketId)!.get(mv.id) ?? 0),
      0,
    );
    if (rowTot <= 0) continue;

    const rowCells = orderedBuckets
      .map((b) => {
        const vv = pivotErjuTotals.get(b.bucketId)!.get(mv.id) ?? 0;
        return `<td class="r">${fmt(vv)}</td>`;
      })
      .join('');
    pivotBODY += `<tr><td>${esc(mv.label)}</td>${rowCells}<td class="r">${fmt(rowTot)}</td></tr>`;
  }

  /** Jami satr pivotda */
  const pivotFooterErju = orderedBuckets
    .map((b) => {
      const sub = [...(pivotErjuTotals.get(b.bucketId)?.values() ?? [])].reduce((s, x) => s + x, 0);
      return `<td class="r">${fmt(sub)}</td>`;
    })
    .join('');
  pivotBODY += `<tr class="psum"><td class="jf">Jami</td>${pivotFooterErju}<td class="r">${fmt(grandTotalFuel)}</td></tr>`;

  const titleEsc = esc(reportTitle);

  const html = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8"/>
<title>${titleEsc}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: auto; min-height: auto; overflow: visible; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8px;
    padding: 12px 18px 24px;
    background: #fafafa;
  }
  .sheet {
    max-width: 1080px;
    margin: 0 auto;
    padding: 14px 18px 18px;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,.08);
  }

  table { border-collapse: collapse; width: 100%; margin-bottom: 12px; height: auto; }
  th, td { border: 0.55px solid #000; padding: 2px 4px; vertical-align: middle; }
  thead th { text-align: center; font-weight: 700; font-size: 7.8px; }
  .r { text-align: right; }
  .c { text-align: center; }
  .rj, .rjami { font-weight: 700; background: #e8ebe8; }
  .zr td { font-size: 8px; }
  .rjami { font-style: italic; }
  .jsum { font-weight: 600; background: #f2f6f2; }
  .sum.grand td { background: #dc2626; color: #fff; font-weight: 700; }
  table.pivot thead th { background: #e8ebe8; }
  .jf { font-weight: 700; }
  table.pivot .psum td { font-weight: 700; background: #e8ebe8; }
  @media print {
    .nop { display: none !important; }
    body { background: #fff; padding: 0; }
    .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; border-radius: 0; }
  }
</style>
</head>
<body>
<div class="sheet">

<h2 style="text-align:center;margin:6px 0 10px;font-size:11px;">${titleEsc}</h2>

<table class="main">
<thead>
<tr>
<th rowspan="2">№</th>
<th rowspan="2">Yoqilg'i quyish shoxobchalari</th>
<th rowspan="2">1 sutkada tarqatilgan</th>
<th rowspan="2">Jami teplovozlarga topshirilgan</th>
<th colspan="${activeCols.length}">shu jumladan</th>
</tr>
<tr>
${activeCols.map((c) => `<th>${esc(c.label)}</th>`).join('')}
</tr>
</thead>
<tbody>
${mainTbody || `<tr><td colspan="${colSpanMain}" style="text-align:center">Maʼlumot yoʻq</td></tr>`}
</tbody>
</table>

${orderedBuckets.length
    ? `<table class="pivot">
<thead><tr>${pivotTHEAD}</tr></thead>
<tbody>${pivotBODY}</tbody>
</table>`
    : ''}

</div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1100,height=800');
  if (!w) {
    alert('Oyna ochilmadi. Brauzer popup ruxsatini tekshiring.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  window.setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  }, 500);
}

// ─── Kirill → Lotin (PDF uchun) ───────────────────────────────────────────────

const CYR_LATIN_FULL: Record<string, string> = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g',
  Д: 'D', д: 'd', Е: 'E', е: 'e', Ё: 'Yo', ё: 'yo', Ж: 'J', ж: 'j',
  З: 'Z', з: 'z', И: 'I', и: 'i', Й: 'Y', й: 'y', К: 'K', к: 'k',
  Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o',
  П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't',
  У: 'U', у: 'u', Ф: 'F', ф: 'f', Х: 'X', х: 'x', Ц: 'Ts', ц: 'ts',
  Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch',
  Ъ: "'", ъ: "'", Ы: 'I', ы: 'i', Ь: '', ь: '',
  Э: 'E', э: 'e', Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya',
  Қ: 'Q', қ: 'q', Ғ: "G'", ғ: "g'", Ҳ: 'H', ҳ: 'h',
  Ў: "O'", ў: "o'", Ӯ: "O'", ӯ: "o'", Ң: 'Ng', ң: 'ng',
};

function cyrToLat(s: string): string {
  let out = '';
  for (const ch of s) out += CYR_LATIN_FULL[ch] ?? ch;
  return out;
}

// ─── Y.PDF — to'g'ridan-to'g'ri yuklab olish, har kun alohida sahifa ──────────

export function downloadErjuYpdf(
  sourceRows: FuelRecord[],
  reportTitle: string,
  moveOptions: IndexedOption[],
  staffList: Staff[],
): void {
  // ── Umumiy sozlamalar (bir marta) ─────────────────────────────────────────
  const staffByCode = new Map<string, Staff>();
  for (const s of staffList) staffByCode.set(String(s.code).trim(), s);

  const activeCols = [...(moveOptions?.length ? moveOptions : YPDF_COLUMNS)].sort((a, b) => a.index - b.index);

  // ── Sanalar bo'yicha guruhlash ────────────────────────────────────────────
  const dateGroups = new Map<string, FuelRecord[]>();
  for (const r of sourceRows) {
    const dk = String(r.date ?? '').trim() || String((r as any).dateISO ?? '').trim();
    if (!dk) continue;
    if (!dateGroups.has(dk)) dateGroups.set(dk, []);
    dateGroups.get(dk)!.push(r);
  }
  const sortedDates = [...dateGroups.keys()].sort();
  if (sortedDates.length === 0) return;

  // ── PDF hujjat ────────────────────────────────────────────────────────────
  type ZapAgg = {
    stationId: string; label: string;
    byMove: Map<string, number>; byMoveCount: Map<string, number>;
    totalFuel: number; totalCount: number;
  };
  type BucketAgg = { bucketId: string; bucketTitle: string; pivotShort: string; zaps: Map<string, ZapAgg> };

  const totalCols = 4 + activeCols.length;
  const GREEN:   [number, number, number] = [210, 225, 210];
  const GREENFG: [number, number, number] = [30, 60, 30];
  const SUM:     [number, number, number] = [235, 245, 235];
  const GRAND:   [number, number, number] = [200, 220, 200];
  const GRAND_ROW:    [number, number, number] = [220, 38, 38];
  const GRAND_ROW_FG: [number, number, number] = [255, 255, 255];

  // Jadval sarlavhasi — barcha kunlar uchun bir xil
  const head: any[][] = [[
    { content: '№',                                  rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    { content: "Yoqilg'i quyish shoxobchalari",      rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    { content: 'Sutka davomida tarqatilgan',         rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    { content: 'Jami teplovozlarga topshirilgan',    rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    ...(activeCols.length > 0
      ? [{ content: 'shu jumladan', colSpan: activeCols.length, styles: { halign: 'center' } }]
      : []),
  ]];
  if (activeCols.length > 0) {
    head.push(activeCols.map((c) => ({ content: pdfText(c.label), styles: { halign: 'center', fontSize: 6.5 } })));
  }

  const doc = new jsPDF('landscape', 'mm', 'a4');
  useCyrillicPdfFont(doc);
  const W      = doc.internal.pageSize.width;
  const MARGIN = 14;
  const CONTINUATION_TOP = 18;

  const drawDayHeader = (dayLabel: string, y: number) => {
    doc.setFontSize(8);
    doc.setFont(PDF_CYRILLIC_FONT, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(pdfText(`Sana: ${dayLabel}`), W / 2, y, { align: 'center' });
    doc.setFont(PDF_CYRILLIC_FONT, 'normal');
  };

  const currentPageNumber = (): number => {
    const direct = (doc as any).getCurrentPageInfo?.();
    const internal = (doc as any).internal?.getCurrentPageInfo?.();
    return Number(direct?.pageNumber ?? internal?.pageNumber ?? doc.getNumberOfPages());
  };

  // 1-sahifaga umumiy sarlavha
  doc.setFontSize(8.5);
  doc.setFont(PDF_CYRILLIC_FONT, 'bold');
  const mainTitleLines = doc.splitTextToSize(pdfText(reportTitle), W - MARGIN * 2);
  let titleEndY = 9;
  for (const ln of mainTitleLines) {
    doc.text(ln, W / 2, titleEndY, { align: 'center' });
    titleEndY += 4.5;
  }
  doc.setFont(PDF_CYRILLIC_FONT, 'normal');

  // ── Har bir sana uchun tsikl ──────────────────────────────────────────────
  let isFirstDate = true;

  for (const dateKey of sortedDates) {
    const dayRows = dateGroups.get(dateKey)!;

    // Aggregatsiya — faqat shu kunning yozuvlari
    const bucketMap = new Map<string, BucketAgg>();
    for (const er of ERJU_DATA) {
      bucketMap.set(er.id, {
        bucketId:    er.id,
        bucketTitle: pdfText(er.name),
        pivotShort:  pdfText(erjuPivotColTitle(er.name)),
        zaps:        new Map(),
      });
    }
    for (const z of ZAPRAVKALAR) {
      const bucket = bucketMap.get(z.uzelId);
      if (!bucket) continue;
      bucket.zaps.set(z.id, {
        stationId: z.id,
        label: z.name,
        byMove: new Map(),
        byMoveCount: new Map(),
        totalFuel: 0,
        totalCount: 0,
      });
    }

    for (const r of dayRows) {
      const z = zapBySupplyOrLoc(r, staffByCode);
      if (!z) continue;
      const ej = erjuBucketForStation(z.id);
      if (!ej) continue;
      const fuel = toNum(r.fuelAmount);
      const zagranitsaFuel = getZagranitsaAmount(r);
      if (fuel <= 0) continue;
      const bucket = bucketMap.get(ej.id);
      if (!bucket) continue;
      const za = bucket.zaps.get(z.id)!;

      const refFuel = Math.max(0, Math.min(fuel, zagranitsaFuel));
      const normalFuel = Math.max(0, fuel - refFuel);
      const mk = ypdfMoveColumnKey(r, activeCols);

      if (normalFuel > 0 && mk !== NOMA_KEY && mk !== MISC_AGG) {
        za.byMove.set(mk, (za.byMove.get(mk) ?? 0) + normalFuel);
        za.byMoveCount.set(mk, (za.byMoveCount.get(mk) ?? 0) + 1);
      }
      if (refFuel > 0) {
        za.byMove.set(ZAGRANITSA_KEY, (za.byMove.get(ZAGRANITSA_KEY) ?? 0) + refFuel);
      }
      za.totalFuel += fuel;
      za.totalCount += 1;
    }

    const orderedBuckets = ERJU_DATA
      .map((ej) => bucketMap.get(ej.id)!)
      .filter((b): b is BucketAgg => !!b && [...b.zaps.values()].some((z) => z.totalFuel > 0));

    if (orderedBuckets.length === 0) continue; // bu kunda ma'lumot yo'q

    const grandByMove  = new Map<string, number>();
    let   grandTotal   = 0;
    let   grandTeplovozTotal = 0;
    const pivotTotals  = new Map<string, Map<string, number>>();
    const pivotCounts  = new Map<string, Map<string, number>>();
    for (const er of ERJU_DATA) pivotTotals.set(er.id, new Map());
    for (const er of ERJU_DATA) pivotCounts.set(er.id, new Map());
    const allPivotBuckets = [...orderedBuckets].sort((a, b) => {
      const ia = YPDF_PIVOT_BUCKET_ORDER.indexOf(a.bucketId);
      const ib = YPDF_PIVOT_BUCKET_ORDER.indexOf(b.bucketId);
      const oa = ia >= 0 ? ia : Number.MAX_SAFE_INTEGER;
      const ob = ib >= 0 ? ib : Number.MAX_SAFE_INTEGER;
      return oa - ob;
    });

    // Asosiy jadval satrlari
    const body: any[][] = [];
    let rowNum = 0;

    for (const b of orderedBuckets) {
      body.push([{
        content: b.bucketTitle,
        colSpan: totalCols,
        styles: { fillColor: GREEN, textColor: GREENFG, fontStyle: 'bold', halign: 'left',
                  cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 2 } },
      }]);

      const bucketMove = new Map<string, number>();
      let bucketTotal = 0;
      let bucketTeplovozTotal = 0;

      const zapOrder = [...b.zaps.keys()].sort((aId, bId) => {
        const order = ERJU_DATA.find((e) => e.id === b.bucketId)?.zapravkalar ?? [];
        const ia = order.indexOf(aId), ib = order.indexOf(bId);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return aId.localeCompare(bId, 'uz');
      });

      for (const zapId of zapOrder) {
        const za = b.zaps.get(zapId)!;
        const stationMoveTons = new Map<string, number>();
        for (const c of activeCols) stationMoveTons.set(c.id, roundKgToYpdfTons(za.byMove.get(c.id) ?? 0));
        const zaTeplovozTotal = sumMoveValues(stationMoveTons, TEPLOVOZ_TOTAL_KEYS);
        const zaTotal = activeCols.reduce((sum, c) => addYpdfTons(sum, stationMoveTons.get(c.id) ?? 0), 0);
        const hasStationFuel = za.totalFuel > 0;
        rowNum++;
        bucketTotal = addYpdfTons(bucketTotal, zaTotal);
        bucketTeplovozTotal = addYpdfTons(bucketTeplovozTotal, zaTeplovozTotal);

        const pivotMap = pivotTotals.get(b.bucketId)!;
        const pivotCountMap = pivotCounts.get(b.bucketId)!;
        for (const c of activeCols) {
          const v = stationMoveTons.get(c.id) ?? 0;
          if (v > 0) {
            pivotMap.set(c.id, addYpdfTons(pivotMap.get(c.id) ?? 0, v));
            grandByMove.set(c.id, addYpdfTons(grandByMove.get(c.id) ?? 0, v));
          }
          const count = za.byMoveCount.get(c.id) ?? 0;
          if (count > 0) {
            pivotCountMap.set(c.id, (pivotCountMap.get(c.id) ?? 0) + count);
          }
        }

      body.push([
        { content: String(YPDF_STATION_NUMBERS[za.stationId] ?? rowNum), styles: { halign: 'center' } },
          pdfText(za.label),
          { content: hasStationFuel ? formatYpdfTons(zaTotal) : '', styles: { halign: 'right' } },
          { content: hasStationFuel ? formatYpdfTons(zaTeplovozTotal) : '', styles: { halign: 'right' } },
          ...activeCols.map((c) => ({ content: hasStationFuel ? formatYpdfTons(stationMoveTons.get(c.id) ?? 0) : '', styles: { halign: 'right' } })),
        ]);

        for (const [k, vv] of stationMoveTons)
          bucketMove.set(k, addYpdfTons(bucketMove.get(k) ?? 0, vv));
        grandTotal = addYpdfTons(grandTotal, zaTotal);
        grandTeplovozTotal = addYpdfTons(grandTeplovozTotal, zaTeplovozTotal);
      }

      body.push([
        { content: `Jami ${b.bucketTitle}`, colSpan: 2, styles: { fontStyle: 'italic', fillColor: SUM, halign: 'left' } },
        { content: formatYpdfTons(bucketTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: SUM } },
        { content: formatYpdfTons(bucketTeplovozTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: SUM } },
        ...activeCols.map((c) => ({ content: formatYpdfTons(bucketMove.get(c.id) ?? 0), styles: { halign: 'right', fontStyle: 'bold', fillColor: SUM } })),
      ]);
    }

    body.push([
      { content: 'ОБЩИЙ ИТОГ', colSpan: 2, styles: { fontStyle: 'bold', fillColor: GRAND_ROW, textColor: GRAND_ROW_FG, halign: 'left' } },
      { content: formatYpdfTons(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: GRAND_ROW, textColor: GRAND_ROW_FG } },
      { content: formatYpdfTons(grandTeplovozTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: GRAND_ROW, textColor: GRAND_ROW_FG } },
      ...activeCols.map((c) => ({ content: formatYpdfTons(grandByMove.get(c.id) ?? 0), styles: { halign: 'right', fontStyle: 'bold', fillColor: GRAND_ROW, textColor: GRAND_ROW_FG } })),
    ]);

    // ── Yangi sahifa (birinchi sana uchun emas) ───────────────────────────
    if (!isFirstDate) doc.addPage();

    const dayFirstPage = doc.getNumberOfPages();
    const dayLabel = formatYpdfDayLabel(dateKey);
    const dayHeaderY = isFirstDate ? titleEndY + 1.5 : 10;
    drawDayHeader(dayLabel, dayHeaderY);

    const drawContinuationDayHeader = () => {
      if (currentPageNumber() !== dayFirstPage) drawDayHeader(dayLabel, 10);
    };

    const tableStartY: number = dayHeaderY + 4;
    isFirstDate = false;

    // ── Asosiy jadval ─────────────────────────────────────────────────────
    autoTable(doc, {
      head,
      body,
      startY: tableStartY,
      theme: 'grid',
      styles:     { font: PDF_CYRILLIC_FONT, fontSize: 7, cellPadding: 1.2, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { font: PDF_CYRILLIC_FONT, fillColor: [232, 235, 232], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.3 },
      columnStyles: (() => {
        const cs: Record<number, any> = { 0: { cellWidth: 8 }, 1: { cellWidth: 52 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 } };
        const ijaraIdx = activeCols.findIndex(c => c.id === 'ijara');
        if (ijaraIdx >= 0) cs[4 + ijaraIdx] = { cellWidth: 26 };
        return cs;
      })(),
      tableWidth: W - MARGIN * 2,
      margin: { left: MARGIN, right: MARGIN, top: CONTINUATION_TOP },
      willDrawPage: drawContinuationDayHeader,
    });

    // ── Pivot jadval ──────────────────────────────────────────────────────
    const pivotHead: any[][] = [[
      '',
      ...allPivotBuckets.map((b) => ({ content: b.pivotShort, styles: { halign: 'center' } })),
      { content: 'Jami', styles: { halign: 'center' } },
    ]];

    const pivotBody: any[][] = [];
    for (const mv of YPDF_COUNT_ROWS) {
      const rowTot = allPivotBuckets.reduce((s, bb) => s + (pivotCounts.get(bb.bucketId)?.get(mv.id) ?? 0), 0);
      pivotBody.push([
        pdfText(mv.label),
        ...allPivotBuckets.map((b) => ({ content: String(pivotCounts.get(b.bucketId)?.get(mv.id) ?? 0), styles: { halign: 'right' } })),
        { content: String(rowTot), styles: { halign: 'right' } },
      ]);
    }
    const pfooter = allPivotBuckets.map((b) => {
      const bucketCounts = pivotCounts.get(b.bucketId);
      const sub = YPDF_COUNT_ROWS.reduce((sum, row) => sum + (bucketCounts?.get(row.id) ?? 0), 0);
      return { content: String(sub), styles: { halign: 'right', fontStyle: 'bold', fillColor: GRAND } };
    });
    const grandCount = YPDF_COUNT_ROWS.reduce(
      (sum, row) => sum + allPivotBuckets.reduce((s, b) => s + (pivotCounts.get(b.bucketId)?.get(row.id) ?? 0), 0),
      0,
    );
    pivotBody.push([
      { content: 'Jami', styles: { fontStyle: 'bold', fillColor: GRAND } },
      ...pfooter,
      { content: String(grandCount), styles: { halign: 'right', fontStyle: 'bold', fillColor: GRAND } },
    ]);

    const afterMain = (doc as any).lastAutoTable?.finalY ?? tableStartY;
    autoTable(doc, {
      head: pivotHead,
      body: pivotBody,
      startY: afterMain + 6,
      theme: 'grid',
      styles:     { font: PDF_CYRILLIC_FONT, fontSize: 7, cellPadding: 1.2, valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.2 },
      headStyles: { font: PDF_CYRILLIC_FONT, fillColor: [232, 235, 232], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7, lineColor: [0, 0, 0], lineWidth: 0.3 },
      margin: { left: MARGIN, right: MARGIN, top: CONTINUATION_TOP },
      willDrawPage: drawContinuationDayHeader,
    });

    // ── Harakat turi hisobi (jadval ostidan, chap tarafda) ────────────────
    const SHORT_MOVE: Record<string, string> = {
      yuk: 'Yuk', yolovchi: "Yo'lovchi", manyovr: 'Manyovr',
      xojalik: "Xo'jalik", ijara: 'Ijara', arenda: 'Ijara', tamirlash: "Ta'mirlash",
      ref: 'Zagranitsa', zagranitsa: 'Zagranitsa', korxona: 'Korxona', qurulish: 'Qurilish',
    };
    const moveCount = new Map<string, number>();
    for (const r of dayRows) {
      const rowMoveKeys = new Set<string>();
      if (toNum(r.fuelAmount) > 0) {
        const mk = moveColumnKey(r.moveType, activeCols);
        if (mk !== NOMA_KEY && mk !== MISC_AGG) rowMoveKeys.add(mk);
      }
      if (getZagranitsaAmount(r) > 0) {
        const zk = moveColumnKey(ZAGRANITSA_KEY, activeCols);
        if (zk !== NOMA_KEY && zk !== MISC_AGG) rowMoveKeys.add(zk);
      }
      for (const key of rowMoveKeys) moveCount.set(key, (moveCount.get(key) ?? 0) + 1);
    }
    const visibleMoveCounts: { label: string; count: number }[] = [];
    const afterPivot = (doc as any).lastAutoTable?.finalY ?? afterMain + 6;
    let cy = afterPivot + 5;
    const pageH = doc.internal.pageSize.height;
    const lineHeight = 3.8;
    const neededHeight = Math.max(0, (visibleMoveCounts.length - 1) * lineHeight) + 2;
    if (visibleMoveCounts.length > 0 && cy + neededHeight > pageH - MARGIN) {
      doc.addPage();
      cy = MARGIN + 4;
    }
    doc.setFontSize(6.5);
    doc.setFont(PDF_CYRILLIC_FONT, 'normal');
    doc.setTextColor(70, 70, 70);
    for (const row of visibleMoveCounts) {
      doc.text(`${row.label}: ${row.count}`, MARGIN, cy);
      cy += lineHeight;
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont(PDF_CYRILLIC_FONT, 'normal');
  }

  const slug = cyrToLat(reportTitle).slice(0, 40).replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
  doc.save(`y_pdf_${slug}.pdf`);
}
