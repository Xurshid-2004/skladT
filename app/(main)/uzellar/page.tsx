"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/utils/session";

export default function UzellarRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.role === "worker" && session.stationId) {
      router.replace(`/zapravka/${session.stationId}/lokomotiv`);
      return;
    }

    if (session.role === "admin") {
      router.replace("/admin");
      return;
    }

    router.replace("/login");
  }, [router]);

  return null;
}
