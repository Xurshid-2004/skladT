"use client";

import { useEffect, useRef } from "react";
import { auth, db } from "@/lib/firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const INTERVAL_MS = 20_000;

/**
 * Ishchi/admin asosiy zonada bo'lganda active_sessions.{uid}.lastSeen ni yangilaydi
 * — dashboardda "onlayn" ko'rinish uchun.
 */
export default function PresenceHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function ping() {
      const u = auth.currentUser;
      if (!u) return;
      try {
        const ref = doc(db, "active_sessions", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        await updateDoc(ref, { lastSeen: Date.now() });
      } catch (err) {
        console.warn("presence heartbeat:", err);
      }
    }

    void ping();
    intervalRef.current = setInterval(() => void ping(), INTERVAL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") void ping();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  return null;
}
