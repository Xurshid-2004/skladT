// Firebase yagona init nuqtasi.
// MUHIM:
//  - Konfiguratsiya `.env` faylidan o'qiladi (Vercel ga deploy qilishga tayyor).
//  - `getApps()` guard SSR / HMR da takroriy initializeApp xatosini oldini oladi.
//  - Analytics faqat brauzerda yuklanadi (SSR da crash bo'lmaydi).

import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Bitta marta init.
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firestore — yagona manba (single source of truth).
export const db: Firestore = getFirestore(app);

// Analytics — faqat brauzerda va qo'llab-quvvatlansagina.
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((ok) => {
      if (ok) analytics = getAnalytics(app);
    })
    .catch(() => {
      /* analytics qo'llab-quvvatlanmasa — jim o'tkazib yuboramiz */
    });
}
export { analytics };

export default app;
