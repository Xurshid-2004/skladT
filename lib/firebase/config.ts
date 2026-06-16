import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

/** `.env.local` bo'lmasa ham lokal dev ishlashi uchun (NEXT_PUBLIC_* — clientda ochiq). */
const FIREBASE_PUBLIC_DEFAULTS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyB_qSW_ZKnRqMxFWJGlA3PlrILF4I9d7MY",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "osysytem.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "osysytem",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "osysytem.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "324886485574",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:324886485574:web:3af5a0801d6e6214428847",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-BR2409F71G",
} as const;

function readEnv(name: keyof typeof FIREBASE_PUBLIC_DEFAULTS): string {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return FIREBASE_PUBLIC_DEFAULTS[name];
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

const firebaseConfig = {
  apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId:
    readEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID") ||
    FIREBASE_PUBLIC_DEFAULTS.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Offline persistence: ma'lumotlar IndexedDB da saqlanadi, internet yo'q bo'lsa ham ishlaydi
let db: Firestore;
try {
  if (typeof window !== "undefined") {
    db = initializeFirestore(app, {
      localCache:
        process.env.NODE_ENV === "development"
          ? memoryLocalCache()
          : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } else {
    db = getFirestore(app);
  }
} catch {
  db = getFirestore(app);
}
export { db };

export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;
