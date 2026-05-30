"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/lib/utils/session";
import { Header } from "@/components/layout/header";
import LokomotivForm from "@/components/forms/lokomotiv-form";
import LokomotivRecentTable from "@/components/lokomotiv-recent-table";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { Zapravka, Session } from "@/lib/types";
import SectionTabs from "@/components/zapravka/section-tabs";
import PageBackground from "@/components/common/page-background";

export default function LokomotivClient() {
  const router = useRouter();
  const params = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [zapravka, setZapravka] = useState<Zapravka | null>(null);
  const [tableKey, setTableKey] = useState(0);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.push("/login");
      return;
    }
    setSession(s);

    const z = ZAPRAVKALAR.find((z) => z.id === params.id);
    if (!z) {
      router.push("/uzellar");
      return;
    }
    setZapravka(z);
  }, [router, params.id]);

  if (!session || !zapravka) return null;

  return (
    <div className="user-panel min-h-screen bg-muted/20 relative">
      <PageBackground variant="locomotive" />
      <Header />

      <main className="w-full">
        {/* Header + Form — cheklangan kenglik */}
        <div className="w-full px-3 pt-5 sm:px-5 sm:pt-6">
          <SectionTabs />

          {/* Form */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <LokomotivForm
              stationId={zapravka.id}
              onSaved={() => setTableKey(k => k + 1)}
            />
          </div>
        </div>

        {/* Table — to'liq kenglik */}
        <div className="w-full px-3 sm:px-5 mt-10 pb-10 animate-in fade-in duration-700">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-1 h-7 bg-primary rounded-full" />
            <h2 className="text-xl font-black text-primary uppercase tracking-tighter">
              Mening yozuvlarim
            </h2>
          </div>
          <LokomotivRecentTable key={tableKey} stationId={zapravka.id} />
        </div>
      </main>

      <style jsx>{`
        .neon-text {
          text-shadow: 0 0 15px rgba(30, 58, 138, 0.1);
        }
      `}</style>
    </div>
  );
}
