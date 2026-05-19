import { db } from "./config";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
import type { StaffVaultRecord } from "@/lib/types";
import { sanitizeForFirestore } from "./sanitize";

const COLLECTION = "staff";

export function sortStaffByTabel<T extends { tabelNumber: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) =>
    a.tabelNumber.localeCompare(b.tabelNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

export function subscribeStaff(callback: (staff: StaffVaultRecord[]) => void) {
  const q = query(collection(db, COLLECTION));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<StaffVaultRecord, "id">),
    }));
    callback(sortStaffByTabel(data));
  });
}

export async function addStaffDoc(
  payload: Omit<StaffVaultRecord, "id">,
): Promise<void> {
  await addDoc(collection(db, COLLECTION), sanitizeForFirestore(payload));
}

export async function updateStaffDoc(
  id: string,
  patch: Pick<StaffVaultRecord, "fullName" | "tabelNumber" | "zapravka">,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), sanitizeForFirestore(patch));
}

export async function deleteStaffDoc(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

/** Faol sessiyadan keyin: joriy kod staff vaultda bo'lsa F.I.Sh */
export async function getStaffFullNameByTabel(
  tabel: string,
): Promise<string | null> {
  const t = tabel.trim();
  if (!t) return null;
  const q = query(
    collection(db, COLLECTION),
    where("tabelNumber", "==", t),
    limit(1),
  );
  const snap = await getDocs(q);
  const d = snap.docs[0];
  if (!d) return null;
  const name = (d.data() as { fullName?: string }).fullName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}
