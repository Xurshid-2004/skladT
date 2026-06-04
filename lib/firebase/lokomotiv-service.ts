import { db } from './config';
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { LokomotivSubmission } from '@/lib/types';
import { sanitizeForFirestore } from './sanitize';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';
import {
  recordSubmissionCreatedForSummaries,
  submissionWithStandardDateFields,
  toLocalDateISO,
} from './summary-service';
import { updateSubmissionByIdWithSummary } from './submission-mutations';
import { buildReportDate, getReportDateOverride } from '@/lib/utils/report-date-override';

const COLLECTION = 'submissions';

// Yangi yozuv qo'shish
export async function addLokomotivSubmission(data: Omit<LokomotivSubmission, 'id' | 'timestamp' | 'createdAt'>) {
  const now = buildReportDate();
  const datedData = submissionWithStandardDateFields(data, now);
  const hasDateOverride = !!getReportDateOverride();
  const createdTime = hasDateOverride ? Timestamp.fromDate(now) : serverTimestamp();
  const payload = sanitizeForFirestore({
    ...datedData,
    timestamp: createdTime,
    createdAt: createdTime,
    category: 'lokomotiv',
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  await recordSubmissionCreatedForSummaries({
    id: docRef.id,
    ...datedData,
    category: 'lokomotiv',
  });

  // fuelRecords kolleksiyasiga ham yoz (ERJU ma'lumotnoma uchun)
  try {
    await addFuelRecord(datedData);
  } catch (e) {
    console.warn('fuelRecord yozilmadi:', e);
  }

  return docRef.id;
}

// fuelRecords kolleksiyasiga yozish (ERJU PDF uchun)
async function addFuelRecord(data: Omit<LokomotivSubmission, 'id' | 'timestamp' | 'createdAt'>) {
  const now = buildReportDate();
  const date = typeof (data as any).dateISO === 'string' ? (data as any).dateISO : toLocalDateISO(now);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;

  const zap = ZAPRAVKALAR.find(z => z.id === data.stationId);
  const supplyPoint = zap?.name ?? data.stationId;

  const locoNumber = data.harakatTuri === 'manyovr'
    ? data.stansiya ?? ''
    : data.harakatTuri === 'xojalik'
      ? data.tashkilot ?? ''
      : data.poyezdNumber ?? '';

  // ERJU Y.PDF 6-ustun: faqat formadagi Index/Ruxsat indeksi.
  const trainIndex = data.ruxsatIndeksi ?? '';

  const payload = sanitizeForFirestore({
    date,
    dateISO: date,
    year: Number(date.slice(0, 4)),
    time,
    supplyPoint,
    staffCode:    data.staffCode,
    staffName:    data.staffName,
    locCode:      data.stationId,
    locoSeries:   data.rusumi,
    locoCode:     data.lokomotivNumber,
    // Depo/jadval va Zagranitsa logikasi hozircha PDF/fuelRecordsga ulanmaydi.
    jadval:       '',
    zagranitsa:   '',
    zagranitsaAmount: '',
    moveType:     data.harakatTuri,
    locoNumber,
    trainIndex,
    ruxsatIndeksi: data.ruxsatIndeksi ?? '',
    weight:       data.poyezdVazni != null ? String(data.poyezdVazni) : '',
    balanceBefore: String(data.qoldiq),
    fuelAmount:   String(data.qanchaBerildi),
    maslaAmount:  String(data.dizMasla),
    // qo'shimcha maydonlar
    stansiya:     data.stansiya    ?? '',
    tashkilot:    data.tashkilot   ?? '',
    ijarachi:     data.ijarachi    ?? '',
    mashinadaYetkazildi: data.mashinadaYetkazildi ?? false,
    mashinaRaqami: data.mashinaRaqami ?? '',
    route: '', trainCode: '', trainNumber: '',
  });

  await addDoc(collection(db, 'fuelRecords'), payload);
}
 
// Ishchining oxirgi yozuvlarini olish 
export async function getRecentSubmissions(stationId: string, limitCount: number = 20) { 
  const q = query( 
    collection(db, COLLECTION), 
    where('stationId', '==', stationId), 
    where('category', '==', 'lokomotiv'), 
    orderBy('timestamp', 'desc'), 
    limit(limitCount) 
  ); 
   
  const snapshot = await getDocs(q); 
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LokomotivSubmission[]; 
} 
 
// Real-time subscription 
export function subscribeToSubmissions( 
  stationId: string, 
  callback: (data: LokomotivSubmission[]) => void, 
  limitCount: number = 20 
) { 
  const q = query( 
    collection(db, COLLECTION), 
    where('stationId', '==', stationId), 
    where('category', '==', 'lokomotiv'), 
    orderBy('timestamp', 'desc'), 
    limit(limitCount) 
  ); 
   
  return onSnapshot(q, (snapshot) => { 
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LokomotivSubmission[]; 
    callback(data); 
  }); 
} 
 
// Yozuvni tahrirlash (faqat shu kun ichida)
export async function updateSubmission(id: string, updates: Partial<LokomotivSubmission>) {
  const payload = sanitizeForFirestore({
    ...updates,
    isEdited: true,
    editedAt: Date.now(),
  });
  await updateSubmissionByIdWithSummary(id, payload);
}
