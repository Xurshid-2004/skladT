import { db } from './config'; 
import { collection, addDoc, query, orderBy, limit, getDocs, where } from 'firebase/firestore'; 
import type { AuditLog } from '@/lib/types'; 
 
const COLLECTION = 'audit_logs'; 
 
export async function logAction(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> { 
  await addDoc(collection(db, COLLECTION), { 
    ...log, 
    timestamp: Date.now(), 
  }); 
} 
 
export async function getRecentLogs(limitCount: number = 100): Promise<AuditLog[]> { 
  const q = query( 
    collection(db, COLLECTION), 
    orderBy('timestamp', 'desc'), 
    limit(limitCount) 
  ); 
  const snapshot = await getDocs(q); 
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLog); 
} 
 
export async function getLogsByUser(userId: string, limitCount: number = 100) { 
  const q = query( 
    collection(db, COLLECTION), 
    where('userId', '==', userId), 
    orderBy('timestamp', 'desc'), 
    limit(limitCount) 
  ); 
  const snapshot = await getDocs(q); 
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as AuditLog); 
} 
