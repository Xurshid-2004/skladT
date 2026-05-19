import { db } from './config'; 
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'; 
import { logAction } from './audit-service'; 
 
const COLLECTION = 'variants'; 
 
export function subscribeToVariants(stationId: string, callback: (variants: any) => void) { 
  const docRef = doc(db, COLLECTION, stationId); 
  return onSnapshot(docRef, (snap) => { 
    if (snap.exists()) { 
      callback(snap.data()); 
    } else { 
      callback({}); 
    } 
  }); 
} 
 
export async function addVariant(stationId: string, fieldKey: string, value: string, userId: string, userName: string) { 
  const docRef = doc(db, COLLECTION, stationId); 
  const snap = await getDoc(docRef); 
  
  let currentVariants = snap.exists() ? snap.data()[fieldKey] || [] : [];
  if (!currentVariants.includes(value)) {
    const updatedVariants = [...currentVariants, value];
    await updateDoc(docRef, { [fieldKey]: updatedVariants });
    
    await logAction({ 
      userId, userName, userRole: 'developer', 
      action: 'update', 
      entityType: 'variant', 
      entityId: `${stationId}/${fieldKey}`, 
      changes: { add: { old: currentVariants, new: updatedVariants } } 
    });
  }
} 
 
export async function removeVariant(stationId: string, fieldKey: string, value: string, userId: string, userName: string) { 
  const docRef = doc(db, COLLECTION, stationId); 
  const snap = await getDoc(docRef); 
  
  if (snap.exists()) {
    let currentVariants = snap.data()[fieldKey] || [];
    const updatedVariants = currentVariants.filter((v: string) => v !== value);
    await updateDoc(docRef, { [fieldKey]: updatedVariants });
    
    await logAction({ 
      userId, userName, userRole: 'developer', 
      action: 'update', 
      entityType: 'variant', 
      entityId: `${stationId}/${fieldKey}`, 
      changes: { remove: { old: currentVariants, new: updatedVariants } } 
    });
  }
} 
