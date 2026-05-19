import { db } from './config';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import type { Limit } from '@/lib/types';
import { logAction } from './audit-service';
import { sanitizeForFirestore } from './sanitize';
 
const COLLECTION = 'limits'; 

export interface LimitsSettings {
  korxonaLimits: { [key: string]: number };
  qurulishLimits: { [key: string]: number };
  korxonaList: { [stationId: string]: string[], default: string[] };
  qurulishKorxonaList: { [stationId: string]: string[], default: string[] };
  buyruqEgalariList: { [stationId: string]: string[], default: string[] };
  mashinaRaqamlari: { [stationId: string]: string[], default: string[] };
  obyektList: { [stationId: string]: string[], default: string[] };
  defaultLimit: number;
  lastUpdated: number;
}
 
export async function createLimit(limitData: Omit<Limit, 'id' | 'createdAt' | 'updatedAt'>, userId: string, userName: string): Promise<string> {
  const payload = sanitizeForFirestore({
    ...limitData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'create', 
    entityType: 'limit', 
    entityId: docRef.id, 
    changes: { limit: { old: null, new: limitData } }, 
  }); 
   
  return docRef.id; 
} 
 
export async function updateLimit(id: string, updates: Partial<Limit>, userId: string, userName: string): Promise<void> {
  const payload = sanitizeForFirestore({
    ...updates,
    updatedAt: Date.now(),
  });
  await updateDoc(doc(db, COLLECTION, id), payload);
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'update', 
    entityType: 'limit', 
    entityId: id, 
    changes: { update: { old: null, new: updates } }, 
  }); 
} 
 
export async function deleteLimit(id: string, userId: string, userName: string): Promise<void> { 
  await deleteDoc(doc(db, COLLECTION, id)); 
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'delete', 
    entityType: 'limit', 
    entityId: id, 
    changes: {}, 
  }); 
} 

// Validation functions
export function checkKorxonaLimit(
  korxonaNomi: string,
  qancha: number,
  nechaSutkalik: number,
  settings: LimitsSettings | null
) {
  if (!settings) return { isOverLimit: false, limit: 0, oshiqMiqdor: 0 };
  
  const limitPerDay = settings.korxonaLimits?.[korxonaNomi] || settings.defaultLimit || 0;
  const totalLimit = limitPerDay * nechaSutkalik;
  const isOverLimit = qancha > totalLimit;
  
  return {
    isOverLimit,
    limit: limitPerDay,
    oshiqMiqdor: isOverLimit ? qancha - totalLimit : 0
  };
}

export function checkQurulishLimit(
  korxonaNomi: string,
  qancha: number,
  settings: LimitsSettings | null
) {
  if (!settings) return { isOverLimit: false, limit: 0, oshiqMiqdor: 0 };
  
  const limit = settings.qurulishLimits?.[korxonaNomi] || settings.defaultLimit || 0;
  const isOverLimit = qancha > limit;
  
  return {
    isOverLimit,
    limit,
    oshiqMiqdor: isOverLimit ? qancha - limit : 0
  };
}
 
export function subscribeToLimits(callback: (settings: LimitsSettings) => void): () => void;
export function subscribeToLimits(type: Limit['type'], callback: (limits: Limit[]) => void, stationId?: string): () => void;
export function subscribeToLimits(
  arg1: any,
  arg2?: any,
  arg3?: any
) {
  if (typeof arg1 === 'function') {
    // Legacy mode: subscribe to settings/limits doc
    return onSnapshot(doc(db, 'settings', 'limits'), (snapshot) => {
      if (snapshot.exists()) {
        arg1(snapshot.data() as LimitsSettings);
      }
    });
  } else {
    // New mode: subscribe to limits collection by type
    const type = arg1;
    const callback = arg2;
    const stationId = arg3;
    let q = query(collection(db, COLLECTION), where('type', '==', type), where('isActive', '==', true));
    if (stationId) {
      q = query(q, where('stationId', '==', stationId));
    }
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Limit));
    });
  }
}

// Add a generic subscriber for developer panel
export function subscribeToAllLimits(callback: (limits: Limit[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Limit));
  });
}
