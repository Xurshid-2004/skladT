import { Session } from "../types";
import { auth, db } from "../firebase/config";
import { signInAnonymously, signOut } from "firebase/auth";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

const SESSION_KEY = "uz_temiryo_session";

/** Login sahifasida: avvalgi foydalanuvchini tozalab, yangi anonim UID */
export async function beginLoginAuth(): Promise<void> {
  if (typeof window === "undefined") return;
  await clearSession();
  await signInAnonymously(auth);
}

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

    await setDoc(
      ref,
      {
        code: session.code,
        role: session.role,
        stationId: session.stationId ?? null,
        nodeId: session.nodeId ?? null,
        displayName: session.displayName ?? null,
        staffVaultFullName: session.role === "worker" ? session.displayName : null,
        createdAt: now,
        lastSeen: now,
      },
      { merge: true },
    );

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
  const ok = await ensureActiveSession(session);
  if (!ok) {
    console.warn(
      "Sessiya saqlandi, lekin onlayn jadval (active_sessions) yozilmadi — Anonymous Auth yoki Firestore qoidalarini tekshiring.",
    );
  }
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const data = sessionStorage.getItem(SESSION_KEY);
  if (!data) return null;

  try {
    const session = JSON.parse(data) as Session;
    if (Date.now() > session.expiresAt) {
      void clearSession();
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
