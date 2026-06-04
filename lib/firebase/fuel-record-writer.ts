/**
 * ERJU Y.PDF uchun fuelRecords yozuvlari.
 * Lokomotivdan tashqari: korxona, qurulish, tamirlash — faqat online addSubmission dan keyin.
 */

import { addDoc, collection } from 'firebase/firestore';
import { db } from './config';
import { sanitizeForFirestore } from './sanitize';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';
import { toLocalDateISO } from './summary-service';
import { parsePdfNumber } from '@/lib/utils/pdf-number';
import { buildReportDate } from '@/lib/utils/report-date-override';

/** Y.PDF ustunlari bilan mos keladigan moveType qiymati */
export type ErjuFuelMoveType =
  | 'yuk'
  | 'yolovchi'
  | 'manyovr'
  | 'xojalik'
  | 'ijara'
  | 'tamirlash'
  | 'korxona'
  | 'qurulish';

interface BaseFuelRow {
  stationId: string;
  staffCode?: string;
  staffName?: string;
  fuelAmountKg: number;
  /** ERJU asosiy ustunlarida ishlatilmaydi — qoldiq 0 */
  balanceBeforeKg?: number;
  dizMaslaKg?: number;
}

export async function appendFuelRecordForErjuJu(
  moveType: ErjuFuelMoveType,
  base: BaseFuelRow & {
    locoSeries?: string;
    locoCode?: string;
    locoNumber?: string;
    trainIndex?: string;
    weight?: string;
    time?: string;
    dateISO?: string;
  },
): Promise<void> {
  const fuelAmountKg = parsePdfNumber(base.fuelAmountKg);
  const balanceBeforeKg = parsePdfNumber(base.balanceBeforeKg);
  const dizMaslaKg = base.dizMaslaKg == null ? 0 : parsePdfNumber(base.dizMaslaKg);
  if (fuelAmountKg <= 0) return;

  const now = buildReportDate();
  const localDate = toLocalDateISO(now);
  const date = base.dateISO ?? localDate;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const time = base.time ?? `${hh}:${mm}`;

  const zap = ZAPRAVKALAR.find((z) => z.id === base.stationId);
  const supplyPoint = zap?.name ?? base.stationId;

  const payload = sanitizeForFirestore({
    date,
    dateISO: date,
    year: Number(date.slice(0, 4)),
    time,
    supplyPoint,
    staffCode: base.staffCode,
    staffName: base.staffName,
    locCode: base.stationId,
    moveType,
    locoSeries: base.locoSeries ?? '',
    locoCode: base.locoCode ?? '',
    locoNumber: base.locoNumber ?? '',
    trainIndex: base.trainIndex ?? '',
    route: '',
    trainCode: '',
    trainNumber: '',
    weight: base.weight ?? '',
    balanceBefore:
      base.balanceBeforeKg == null || balanceBeforeKg === 0
        ? ''
        : String(balanceBeforeKg),
    fuelAmount: String(fuelAmountKg),
    maslaAmount:
      base.dizMaslaKg != null && dizMaslaKg !== 0
        ? String(dizMaslaKg)
        : '',
  });

  await addDoc(collection(db, 'fuelRecords'), payload);
}
