import { db } from './config';
import {
  collection, addDoc, query, where, orderBy, limit,
  onSnapshot, doc, updateDoc, getDoc,
} from 'firebase/firestore';
import type { ChatMessage, ChatType } from '@/lib/types';
import { sanitizeForFirestore } from './sanitize';

const COLLECTION = 'messages';

export async function sendMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<string> {
  const payload = sanitizeForFirestore({
    ...message,
    createdAt: Date.now(),
  });
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  return docRef.id;
}
 
export function subscribeToChatMessages( 
  chatType: ChatType, 
  chatScope: string, 
  callback: (messages: ChatMessage[]) => void, 
  limitCount: number = 50 
) { 
  const q = query( 
    collection(db, COLLECTION), 
    where('chatType', '==', chatType), 
    where('chatScope', '==', chatScope), 
    orderBy('createdAt', 'desc'), 
    limit(limitCount) 
  ); 
   
  return onSnapshot(q, (snapshot) => { 
    const messages = snapshot.docs 
      .map(d => ({ id: d.id, ...d.data() }) as ChatMessage) 
      .filter(m => !m.isDeleted) 
      .reverse(); 
    callback(messages); 
  }); 
}

/** Admin panel: barcha kanallardan so'nggi xabarlar (yulduzcha filtrlash clientda). */
export function subscribeAdminMessageFeed(
  callback: (messages: ChatMessage[]) => void,
  limitCount: number = 300,
) {
  const q = query(
    collection(db, COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as ChatMessage,
    );
    callback(messages.filter((m) => !m.isDeleted));
  });
}
 
export async function deleteMessage(messageId: string): Promise<void> { 
  const messageRef = doc(db, COLLECTION, messageId); 
  await updateDoc(messageRef, { isDeleted: true }); 
} 
