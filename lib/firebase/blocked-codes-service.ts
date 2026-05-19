import { db } from './config';
import { collection, doc, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';

const COLLECTION = 'blocked_codes';

export type BlockedCodeDoc = {
  code: string;
  note?: string;
  blockedAt: number;
  blockedByDisplayName?: string;
};

export async function isCodeBlocked(code: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COLLECTION, code.trim()));
  return snap.exists();
}

export async function blockCode(payload: BlockedCodeDoc): Promise<void> {
  await setDoc(doc(db, COLLECTION, payload.code.trim()), {
    ...payload,
    code: payload.code.trim(),
  });
}

export async function unblockCode(code: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, code.trim()));
}

export function subscribeBlockedCodes(cb: (rows: BlockedCodeDoc[]) => void): () => void {
  return onSnapshot(collection(db, COLLECTION), (snap) => {
    cb(
      snap.docs
        .map((d) => ({ ...(d.data() as BlockedCodeDoc), code: d.id }))
        .sort((a, b) => (b.blockedAt || 0) - (a.blockedAt || 0)),
    );
  });
}
