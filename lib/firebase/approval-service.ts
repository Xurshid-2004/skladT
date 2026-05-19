import { db } from './config'; 
import { 
  collection, addDoc, query, where, doc, updateDoc, getDoc, onSnapshot, 
} from 'firebase/firestore'; 
import type { Approval, ChatMessage } from '@/lib/types'; 
 
const APPROVALS = 'approvals'; 
const MESSAGES = 'messages'; 
 
export async function approveOrReject( 
  messageId: string, 
  approve: boolean, 
  sutkalikLimit: number, 
  adminCode: string, 
  adminName: string, 
  stationId: string, 
  nodeId: string 
): Promise<void> { 
  const messageRef = doc(db, MESSAGES, messageId); 
   
  await updateDoc(messageRef, { 
    'request.status': approve ? 'approved' : 'rejected', 
    'request.approvedBy': adminCode, 
    'request.approvedByName': adminName, 
    'request.approvedAt': Date.now(), 
    'request.sutkalikLimit': sutkalikLimit, 
  }); 
   
  if (approve) { 
    const messageSnap = await getDoc(messageRef); 
    const message = messageSnap.data() as ChatMessage; 
    if (!message.request) return; 
     
    await addDoc(collection(db, APPROVALS), { 
      messageId, 
      requestType: message.request.requestType, 
      seriya: message.request.seriya || null, 
      lokomotivNumber: message.request.lokomotivNumber || null, 
      requestKind: message.request.requestKind || null, 
      korxonaNomi: message.request.korxonaNomi || null, 
      stationId, 
      nodeId, 
      approvedBy: adminCode, 
      approvedByName: adminName, 
      approvedAt: Date.now(), 
      sutkalikLimit, 
      validUntil: Date.now() + (sutkalikLimit * 24 * 60 * 60 * 1000), 
      isActive: true, 
    }); 
  } 
} 
 
export function subscribeToActiveApprovals( 
  stationId: string, 
  callback: (approvals: Approval[]) => void 
) { 
  const q = query( 
    collection(db, APPROVALS), 
    where('stationId', '==', stationId), 
    where('isActive', '==', true) 
  ); 
   
  return onSnapshot(q, (snapshot) => { 
    const now = Date.now(); 
    const approvals = snapshot.docs 
      .map(d => ({ id: d.id, ...d.data() }) as Approval) 
      .filter(a => a.validUntil > now); 
    callback(approvals); 
  }); 
} 
