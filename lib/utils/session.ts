import { Session } from "../types";
import { auth, db } from "../firebase/config";
import { signInAnonymously, signOut } from "firebase/auth";
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { getStaffFullNameByTabel } from "../firebase/staff-service";

const SESSION_KEY = "uz_temiryo_session";

/** Firebase Auth + active_sessions — presence uchun majburiy */
export async function ensureActiveSession(
  session: Session,
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    let user = auth.currentUser;
    if (!user) {
      const userCredential = await signInAnonymously(auth);
      user = userCredential.user;
    }

    const ref = doc(db, "active_sessions", user.uid);
    const now = Date.now();
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        code: session.code,
        role: session.role,
        stationId: session.stationId ?? null,
        nodeId: session.nodeId ?? null,
        displayName: session.displayName ?? null,
        staffVaultFullName: null,
        createdAt: now,
        lastSeen: now,
      });
    } else {
      await updateDoc(ref, { lastSeen: now });
    }

    try {
      const data = (await getDoc(ref)).data();
      if (!data?.staffVaultFullName) {
        const vaultFullName = await getStaffFullNameByTabel(session.code);
        if (vaultFullName) {
          await updateDoc(ref, {
            staffVaultFullName: vaultFullName,
            lastSeen: Date.now(),
          });
        }
      }
    } catch (vaultErr) {
      console.warn("staff vault F.I.Sh qo'shilmadi:", vaultErr);
    }

    return true;
  } catch (authError: unknown) {
    const code =
      authError && typeof authError === "object" && "code" in authError
        ? String((authError as { code: string }).code)
        : "";
    if (code === "auth/configuration-not-found") {
      console.warn(
        "Firebase Anonymous Auth yoqilmagan — onlayn jadval ishlamaydi. " +
          "Firebase Console > Authentication > Anonymous yoqing.",
      );
    } else {
      console.warn("ensureActiveSession:", authError);
    }
    return false;
  }
}

export async function saveSession(session: Session): Promise<void> {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  await ensureActiveSession(session);
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem(SESSION_KEY);
  if (!data) return null;

  try {
    const session = JSON.parse(data) as Session;
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);

  try {
    if (auth.currentUser) {
      await deleteDoc(doc(db, "active_sessions", auth.currentUser.uid));
      await signOut(auth);
    }
  } catch (error) {
    console.error("Logout error:", error);
  }
}

export function isSessionValid(): boolean {
  return getSession() !== null;
}
