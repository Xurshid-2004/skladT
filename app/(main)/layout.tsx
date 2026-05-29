"use client";

import ChatWidget from "@/components/chat/chat-widget";
import PresenceHeartbeat from "@/components/common/presence-heartbeat";
import { ensureActiveSession, getSession, isSessionValid } from "@/lib/utils/session";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showChat, setShowChat] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSessionValid()) {
        router.replace("/login");
        return;
      }
      const s = getSession();
      if (!s) {
        router.replace("/login");
        return;
      }

      if (pathname.startsWith("/admin") && s.role !== "admin") {
        router.replace("/uzellar");
        return;
      }

      await ensureActiveSession(s);
      if (cancelled) return;

      setShowChat(true);
      setAllowed(true);
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!allowed) return null;

  return (
    <>
      <PresenceHeartbeat />
      {children}
      {showChat && <ChatWidget />}
    </>
  );
}
