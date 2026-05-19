import { db } from './config';
import { collection, addDoc, query, where, getDocs, doc, updateDoc, deleteDoc, onSnapshot, orderBy } from 'firebase/firestore';
import type { FormQuestion } from '@/lib/types';
import { logAction } from './audit-service';
import { sanitizeForFirestore } from './sanitize';

const COLLECTION = 'questions';

export async function createQuestion(question: Omit<FormQuestion, 'id' | 'createdAt' | 'updatedAt'>, userId: string, userName: string): Promise<string> {
  const payload = sanitizeForFirestore({
    ...question,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'create', 
    entityType: 'question', 
    entityId: docRef.id, 
    changes: { question: { old: null, new: question } }, 
  }); 
   
  return docRef.id; 
} 
 
export async function updateQuestion(id: string, updates: Partial<FormQuestion>, userId: string, userName: string): Promise<void> {
  const payload = sanitizeForFirestore({
    ...updates,
    updatedAt: Date.now(),
  });
  await updateDoc(doc(db, COLLECTION, id), payload);
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'update', 
    entityType: 'question', 
    entityId: id, 
    changes: { update: { old: null, new: updates } }, 
  }); 
} 
 
export async function deleteQuestion(id: string, userId: string, userName: string): Promise<void> { 
  await deleteDoc(doc(db, COLLECTION, id)); 
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'delete', 
    entityType: 'question', 
    entityId: id, 
    changes: {}, 
  }); 
} 
 
export function subscribeToQuestions(category: FormQuestion['category'], stationId?: string, callback?: (questions: FormQuestion[]) => void) { 
  let q = query(collection(db, COLLECTION), where('category', '==', category), orderBy('order', 'asc')); 
  
  return onSnapshot(q, (snapshot) => { 
    let questions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as FormQuestion);
    
    // Filter by stationId if provided (include global questions where stationId is empty)
    if (stationId) {
      questions = questions.filter(q => !q.stationId || q.stationId === stationId);
    }
    
    if (callback) callback(questions); 
  }); 
}

export async function reorderQuestions(category: string, newOrder: { id: string, order: number }[], userId: string, userName: string) {
  for (const item of newOrder) {
    await updateDoc(doc(db, COLLECTION, item.id), { 
      order: item.order,
      updatedAt: Date.now()
    });
  }

  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'update', 
    entityType: 'question_order', 
    entityId: category, 
    changes: { order: { old: null, new: 'Bulk update' } } 
  });
}
