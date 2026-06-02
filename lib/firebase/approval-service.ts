import { db } from './config'; 
import { 
  collection, query, where, onSnapshot, 
} from 'firebase/firestore'; 
import type { Approval } from '@/lib/types'; 
 
const APPROVALS = 'approvals'; 
 
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
