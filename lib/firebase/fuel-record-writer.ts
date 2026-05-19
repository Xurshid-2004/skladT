/**
 * ERJU Y.PDF uchun fuelRecords yozuvlari.
 * Lokomotivdan tashqari: korxona, qurulish, tamirlash — faqat online addSubmission dan keyin.
 */

import { addDoc, collection } from 'firebase/firestore';
import { db } from './config';
import { sanitizeForFirestore } from './sanitize';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';

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
    trainIndex?: string;
    weight?: string;
    time?: string;
    dateISO?: string;
  },
): Promise<void> {
  if (!Number(base.fuelAmountKg) || base.fuelAmountKg <= 0) return;

  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const date = base.dateISO ?? localDate;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const time = base.time ?? `${hh}:${mm}`;

  const zap = ZAPRAVKALAR.find((z) => z.id === base.stationId);
  const supplyPoint = zap?.name ?? base.stationId;

  const payload = sanitizeForFirestore({
    date,
    time,
    supplyPoint,
    staffCode: base.staffCode,
    staffName: base.staffName,
    locCode: base.stationId,
    moveType,
    locoSeries: base.locoSeries ?? '',
    locoCode: base.locoCode ?? '',
    locoNumber: '',
    trainIndex: base.trainIndex ?? '',
    route: '',
    trainCode: '',
    trainNumber: '',
    weight: base.weight ?? '',
    balanceBefore:
      base.balanceBeforeKg == null || base.balanceBeforeKg === 0
        ? ''
        : String(base.balanceBeforeKg),
    fuelAmount: String(base.fuelAmountKg),
    maslaAmount:
      base.dizMaslaKg != null && !Number.isNaN(Number(base.dizMaslaKg))
        ? String(base.dizMaslaKg)
        : '',
  });

  await addDoc(collection(db, 'fuelRecords'), payload);
}
