import { db } from './config'; 
import { collection, doc, getDocs, updateDoc, setDoc, query, where, onSnapshot } from 'firebase/firestore'; 
import { logAction } from './audit-service'; 
 
const COLLECTION = 'users'; // We use users collection for codes
 
export async function getAllCodes() { 
  const snapshot = await getDocs(collection(db, COLLECTION)); 
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() })); 
} 
 
export async function updateCodeName(code: string, displayName: string, userId: string, userName: string) { 
  const userRef = doc(db, COLLECTION, code); 
  await updateDoc(userRef, { displayName }); 
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'update', 
    entityType: 'code', 
    entityId: code, 
    changes: { displayName: { old: null, new: displayName } } 
  }); 
} 
 
export async function deactivateCode(code: string, userId: string, userName: string) { 
  const userRef = doc(db, COLLECTION, code); 
  await updateDoc(userRef, { isActive: false }); 
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'update', 
    entityType: 'code', 
    entityId: code, 
    changes: { isActive: { old: true, new: false } } 
  }); 
} 
 
export async function activateReserveCode(code: string, displayName: string, stationId: string, nodeId: string, userId: string, userName: string) { 
  const userRef = doc(db, COLLECTION, code); 
  const data = { 
    code, 
    displayName, 
    stationId, 
    nodeId, 
    role: 'worker', 
    isActive: true 
  }; 
  await setDoc(userRef, data); 
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'create', 
    entityType: 'code', 
    entityId: code, 
    changes: { code: { old: null, new: data } } 
  }); 
} 
 
export async function addNewAdminCode(code: string, displayName: string, userId: string, userName: string) { 
  const userRef = doc(db, COLLECTION, code); 
  const data = { 
    code, 
    displayName, 
    role: 'admin', 
    isActive: true 
  }; 
  await setDoc(userRef, data); 
   
  await logAction({ 
    userId, userName, userRole: 'developer', 
    action: 'create', 
    entityType: 'code', 
    entityId: code, 
    changes: { code: { old: null, new: data } } 
  }); 
}

export function subscribeToAllCodes(callback: (codes: any[]) => void) {
  return onSnapshot(collection(db, COLLECTION), (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
