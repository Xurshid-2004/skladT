import { db } from './config';
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { Submission, Category } from '@/lib/types';
import { sanitizeForFirestore } from './sanitize';
import {
  recordSubmissionCreatedForSummaries,
  submissionWithStandardDateFields,
} from './summary-service';
import { updateSubmissionByIdWithSummary } from './submission-mutations';
import { buildReportDate, getReportDateOverride } from '@/lib/utils/report-date-override';

const COLLECTION = 'submissions';

// Yangi yozuv qo'shish
export async function addSubmission(category: Category, data: any) {
  const now = buildReportDate();
  const datedData = submissionWithStandardDateFields(data, now);
  const hasDateOverride = !!getReportDateOverride();
  const createdTime = hasDateOverride ? Timestamp.fromDate(now) : serverTimestamp();
  const payload = sanitizeForFirestore({
    ...datedData,
    timestamp: createdTime,
    createdAt: createdTime,
    category: category,
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  await recordSubmissionCreatedForSummaries({
    id: docRef.id,
    ...datedData,
    category,
  });
  return docRef.id;
}
 
// Ishchining oxirgi yozuvlarini olish 
export async function getRecentSubmissions(stationId: string, category: Category, limitCount: number = 20) { 
  const q = query( 
    collection(db, COLLECTION), 
    where('stationId', '==', stationId), 
    where('category', '==', category), 
    orderBy('timestamp', 'desc'), 
    limit(limitCount) 
  ); 
   
  const snapshot = await getDocs(q); 
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Submission[]; 
} 
 
// Real-time subscription
export function subscribeToSubmissions(
  stationId: string,
  category: Category,
  callback: (data: any[]) => void,
  limitCount: number = 100
) { 
  const q = query( 
    collection(db, COLLECTION), 
    where('stationId', '==', stationId), 
    where('category', '==', category), 
    orderBy('timestamp', 'desc'), 
    limit(limitCount) 
  ); 
   
  return onSnapshot(q, (snapshot) => { 
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); 
    callback(data); 
  }); 
} 
 
// Yozuvni tahrirlash (faqat shu kun ichida)
export async function updateSubmission(id: string, updates: any) {
  const payload = sanitizeForFirestore({
    ...updates,
    isEdited: true,
    editedAt: serverTimestamp(),
  });
  await updateSubmissionByIdWithSummary(id, payload);
}

// Tahrirlash mumkinligini tekshirish (faqat shu kun)
export function canEdit(submission: Submission): boolean {
  const now = new Date();
  // serverTimestamp() Firestore Timestamp yoki milliseconds bo'lishi mumkin
  const raw = submission.timestamp;
  const subDate = raw && typeof (raw as any).toDate === 'function'
    ? (raw as any).toDate()
    : new Date(raw as number);
  return now.getFullYear() === subDate.getFullYear() &&
         now.getMonth() === subDate.getMonth() &&
         now.getDate() === subDate.getDate();
}
