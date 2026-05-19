import { db } from './config';
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, doc, updateDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { LokomotivSubmission } from '@/lib/types';
import { sanitizeForFirestore } from './sanitize';
import { ZAPRAVKALAR } from '@/lib/data/uzellar';

const COLLECTION = 'submissions';

// Yangi yozuv qo'shish
export async function addLokomotivSubmission(data: Omit<LokomotivSubmission, 'id' | 'timestamp' | 'createdAt'>) {
  const payload = sanitizeForFirestore({
    ...data,
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    category: 'lokomotiv',
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);

  // fuelRecords kolleksiyasiga ham yoz (ERJU ma'lumotnoma uchun)
  try {
    await addFuelRecord(data);
  } catch (e) {
    console.warn('fuelRecord yozilmadi:', e);
  }

  return docRef.id;
}

// fuelRecords kolleksiyasiga yozish (ERJU PDF uchun)
async function addFuelRecord(data: Omit<LokomotivSubmission, 'id' | 'timestamp' | 'createdAt'>) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;

  const zap = ZAPRAVKALAR.find(z => z.id === data.stationId);
  const supplyPoint = zap?.name ?? data.stationId;

  // Col 6 (Ruxsat indeksi): stansiya / tashkilot / ijarachi / mashina raqami
  const extraParts: string[] = [];
  if (data.stansiya)    extraParts.push(data.stansiya);
  if (data.tashkilot)   extraParts.push(data.tashkilot);
  if (data.ijarachi)    extraParts.push(data.ijarachi);
  if (data.mashinadaYetkazildi && data.mashinaRaqami)
    extraParts.push(`M: ${data.mashinaRaqami}`);
  const trainIndex = extraParts.join(' / ');

  const payload = sanitizeForFirestore({
    date,
    time,
    supplyPoint,
    staffCode:    data.staffCode,
    staffName:    data.staffName,
    locCode:      data.stationId,
    locoSeries:   data.rusumi,
    locoCode:     data.lokomotivNumber,
    moveType:     data.harakatTuri,
    locoNumber:   data.poyezdNumber ?? '',
    trainIndex,
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
  const docRef = doc(db, COLLECTION, id);
  const payload = sanitizeForFirestore({
    ...updates,
    isEdited: true,
    editedAt: Date.now(),
  });
  await updateDoc(docRef, payload);
}
