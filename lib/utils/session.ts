import { Session } from "../types";
import { auth, db } from "../firebase/config";
import { signInAnonymously, signOut } from "firebase/auth";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getStaffFullNameByTabel } from "../firebase/staff-service";

const SESSION_KEY = "uz_temiryo_session";

export async function saveSession(session: Session): Promise<void> {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // Firebase Anonymous Auth — ixtiyoriy. Agar Firebase Console'da
  // yoqilmagan bo'lsa (auth/configuration-not-found), login baribir
  // ishlaydi: localStorage sessiyasi yetarli, faqat Firestore yozuvlari
  // ushbu qurilmadan amalga oshmaydi.
  try {
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;

    const now = Date.now();
    try {
      await setDoc(doc(db, "active_sessions", user.uid), {
        code: session.code,
        role: session.role,
        stationId: session.stationId,
        nodeId: session.nodeId,
        displayName: session.displayName,
        staffVaultFullName: null,
        createdAt: now,
        lastSeen: now,
      });
      try {
        const vaultFullName = await getStaffFullNameByTabel(session.code);
        if (vaultFullName) {
          await updateDoc(doc(db, "active_sessions", user.uid), {
            staffVaultFullName: vaultFullName,
            lastSeen: Date.now(),
          });
        }
      } catch (vaultErr) {
        console.warn("staff vault F.I.Sh qo'shilmadi:", vaultErr);
      }
    } catch (fsError) {
      console.warn("active_sessions yozuvi o'tkazib yuborildi:", fsError);
    }
  } catch (authError: any) {
    if (authError?.code === "auth/configuration-not-found") {
      console.warn(
        "Firebase Anonymous Auth yoqilmagan — login local sessiya bilan davom etmoqda. " +
          "To'liq funksiya uchun Firebase Console > Authentication > Sign-in method'da Anonymous'ni yoqing."
      );
    } else {
      console.warn("Firebase auth o'tkazib yuborildi:", authError);
    }
  }
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
