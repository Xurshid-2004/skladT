import { openDB } from 'idb';

const DB_NAME = 'temiryo_offline';
const DB_VERSION = 1;

export async function getOfflineDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('pending_submissions')) {
        db.createObjectStore('pending_submissions', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function savePendingSubmission(data: any) {
  const db = await getOfflineDB();
  const tx = db.transaction('pending_submissions', 'readwrite');
  await tx.objectStore('pending_submissions').add({
    ...data,
    savedAt: Date.now(),
  });
  await tx.done;
}

export async function getPendingSubmissions() {
  const db = await getOfflineDB();
  return db.getAll('pending_submissions');
}

export async function deletePendingSubmission(id: number) {
  const db = await getOfflineDB();
  const tx = db.transaction('pending_submissions', 'readwrite');
  await tx.objectStore('pending_submissions').delete(id);
  await tx.done;
}

export async function syncPendingSubmissions(uploadFn: (data: any) => Promise<void>) {
  const pending = await getPendingSubmissions();
  for (const item of pending) {
    try {
      // Remove local 'id' and 'savedAt' before uploading if needed, or pass as is
      await uploadFn(item);
      await deletePendingSubmission(item.id);
    } catch (error) {
      console.error('Sync xato:', error);
      break;
    }
  }
}
