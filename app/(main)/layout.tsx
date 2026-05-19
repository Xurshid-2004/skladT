"use client";

import ChatWidget from "@/components/chat/chat-widget";
import PresenceHeartbeat from "@/components/common/presence-heartbeat";
import { getSession, isSessionValid } from "@/lib/utils/session";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showChat, setShowChat] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isSessionValid()) {
      router.replace("/login");
      return;
    }
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }

    // Developer-only zone
    if (pathname.startsWith("/dasturchi") && s.role !== "developer") {
      router.replace("/uzellar");
      return;
    }
    // Admin/Developer-only zone
    if (pathname.startsWith("/admin") && s.role !== "admin" && s.role !== "developer") {
      router.replace("/uzellar");
      return;
    }

    setShowChat(true);
    setAllowed(true);
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
