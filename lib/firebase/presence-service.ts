import { db } from "./config";
import { collection, onSnapshot } from "firebase/firestore";
import type { Role } from "@/lib/types";

const COLLECTION = "active_sessions";

/** Necha ms ichida heartbeat bo'lmasa "oflayn" deb hisoblanadi */
export const ONLINE_PRESENCE_MS = 120_000;

export type PresenceSessionDoc = {
  uid: string;
  code: string;
  role: Role;
  stationId: string | null;
  nodeId: string | null;
  createdAt?: number;
  lastSeen?: number;
  /** Local session displayName (zapravka nomi va h.k.) */
  displayName?: string;
  /** Staff vault bilan mos keladigan F.I.Sh */
  staffVaultFullName?: string | null;
};

function coerceRole(v: unknown): Role {
  if (v === "developer" || v === "admin" || v === "worker") return v;
  return "worker";
}

function parseDoc(uid: string, data: Record<string, unknown>): PresenceSessionDoc {
  return {
    uid,
    code: String(data.code ?? ""),
    role: coerceRole(data.role),
    stationId:
      typeof data.stationId === "string"
        ? data.stationId
        : data.stationId == null
          ? null
          : String(data.stationId),
    nodeId:
      typeof data.nodeId === "string"
        ? data.nodeId
        : data.nodeId == null
          ? null
          : String(data.nodeId),
    createdAt: typeof data.createdAt === "number" ? data.createdAt : undefined,
    lastSeen: typeof data.lastSeen === "number" ? data.lastSeen : undefined,
    displayName:
      typeof data.displayName === "string" ? data.displayName : undefined,
    staffVaultFullName:
      typeof data.staffVaultFullName === "string"
        ? data.staffVaultFullName
        : data.staffVaultFullName === null
          ? null
          : undefined,
  };
}

export function subscribePresenceSessions(
  callback: (rows: PresenceSessionDoc[]) => void,
): () => void {
  return onSnapshot(collection(db, COLLECTION), (snap) => {
    const rows = snap.docs.map((d) =>
      parseDoc(d.id, d.data() as Record<string, unknown>),
    );
    callback(rows.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0)));
  });
}

export function isPresenceOnline(lastSeen?: number): boolean {
  if (lastSeen == null) return false;
  return Date.now() - lastSeen < ONLINE_PRESENCE_MS;
}
