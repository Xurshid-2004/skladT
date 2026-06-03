"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, isSessionValid } from "@/lib/utils/session";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (isSessionValid()) {
      const session = getSession();
      if (session?.role === "worker" && session.stationId) {
        router.push(`/zapravka/${session.stationId}/lokomotiv`);
      } else if (session?.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/login");
      }
    } else {
      router.push("/login");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
