"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/lib/utils/session";
import { Header } from "@/components/layout/header";
import KorxonaForm from "@/components/forms/korxona-form";
import KorxonaRecentTable from "@/components/forms/korxona-recent-table";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { Zapravka, Session } from "@/lib/types";
import SectionTabs from "@/components/zapravka/section-tabs";
import PageBackground from "@/components/common/page-background";

export default function KorxonaClient() {
  const router = useRouter();
  const params = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [zapravka, setZapravka] = useState<Zapravka | null>(null);
  const [tableKey, setTableKey] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.push("/login"); return; }
    setSession(s);
    const z = ZAPRAVKALAR.find((z) => z.id === params.id);
    if (!z) {
      if (s.role === "worker" && s.stationId) {
        router.push(`/zapravka/${s.stationId}/lokomotiv`);
      } else {
        router.push(s.role === "admin" ? "/admin" : "/login");
      }
      return;
    }
    setZapravka(z);
  }, [router, params.id]);

  if (!session || !zapravka) return null;

  return (
    <div className="user-panel min-h-screen bg-muted/20 relative">
      <PageBackground variant="factory" />
      <Header />

      <main className="w-full">
        {/* Header + Form — cheklangan kenglik */}
        <div className="w-full px-3 pt-3 sm:px-5 sm:pt-4">
          <SectionTabs />

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <KorxonaForm
              stationId={zapravka.id}
              onSaved={() => setTableKey(k => k + 1)}
            />
          </div>
        </div>

        {/* Table — to'liq kenglik */}
        <div className="w-full px-3 sm:px-5 mt-5 pb-8 animate-in fade-in duration-700">
          <div className="flex items-center gap-2.5 mb-2.5 px-1">
            <div className="w-1 h-6 bg-accent rounded-full" />
            <h2 className="text-lg font-black text-accent uppercase tracking-tighter">
              Mening yozuvlarim
            </h2>
          </div>
          <KorxonaRecentTable key={tableKey} stationId={zapravka.id} />
        </div>
      </main>
    </div>
  );
}
