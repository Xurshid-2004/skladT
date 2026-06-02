import { db } from "./config";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import type { AccessCode } from "@/lib/types";
import { logAction } from "./audit-service";

const COLLECTION = "access_codes";

export type AdminCodeRecord = AccessCode & { id: string };

export function subscribeAdminCodes(callback: (codes: AdminCodeRecord[]) => void) {
  const q = query(collection(db, COLLECTION), where("role", "==", "admin"));

  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as AccessCode) }))
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    callback(rows);
  });
}

export async function upsertAdminCode(params: {
  code: string;
  displayName: string;
  actorCode: string;
  actorName: string;
}) {
  const code = params.code.trim();
  const ref = doc(db, COLLECTION, code);
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data() as Partial<AccessCode>) : null;
  const now = Date.now();

  await setDoc(
    ref,
    {
      code,
      displayName: params.displayName.trim(),
      role: "admin",
      nodeId: null,
      stationId: null,
      codeType: "admin",
      isActive: true,
      createdAt: typeof prev?.createdAt === "number" ? prev.createdAt : now,
      updatedAt: now,
    },
    { merge: true },
  );

  await logAction({
    userId: params.actorCode,
    userName: params.actorName,
    userRole: "admin",
    action: prev ? "update" : "create",
    entityType: "code",
    entityId: code,
    changes: {
      displayName: { old: prev?.displayName ?? null, new: params.displayName.trim() },
      role: { old: prev?.role ?? null, new: "admin" },
    },
  });
}
