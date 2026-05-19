"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession } from "@/lib/utils/session";
import { Header } from "@/components/layout/header";
import QurulishForm from "@/components/forms/qurulish-form";
import QurulishRecentTable from "@/components/forms/qurulish-recent-table";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { Zapravka, Session } from "@/lib/types";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import SectionTabs from "@/components/zapravka/section-tabs";
import PageBackground from "@/components/common/page-background";

export default function QurulishClient() {
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
    if (!z) { router.push("/uzellar"); return; }
    setZapravka(z);
  }, [router, params.id]);

  if (!session || !zapravka) return null;

  return (
    <div className="min-h-screen bg-muted/20 relative">
      <PageBackground variant="construction" />
      <Header />

      <main className="w-full">
        {/* Header + Form — cheklangan kenglik */}
        <div className="container mx-auto px-4 pt-8 max-w-5xl">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {session.role !== "worker" ? (
              <Link href={`/zapravka/${zapravka.id}`} className="flex items-center gap-2 px-5 py-3 bg-background border-2 border-primary/10 rounded-2xl font-black text-primary hover:bg-primary/5 transition-all shadow-sm w-fit">
                <ChevronLeft className="w-6 h-6" /> ORQAGA
              </Link>
            ) : <span />}
            <div className="text-left md:text-right">
              <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tighter uppercase">
                {zapravka.name} ZAPRAVKASI
              </h1>
              <p className="text-muted-foreground font-black tracking-[0.2em] text-xs mt-2 uppercase">QURULISH BO'LIMI</p>
            </div>
          </div>

          <SectionTabs />

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <QurulishForm
              stationId={zapravka.id}
              onSaved={() => setTableKey(k => k + 1)}
            />
          </div>
        </div>

        {/* Table — to'liq kenglik */}
        <div className="w-full px-3 sm:px-5 mt-10 pb-10 animate-in fade-in duration-700">
          <div className="flex items-center gap-3 mb-4 px-1">
            <div className="w-1 h-7 bg-danger rounded-full" />
            <h2 className="text-xl font-black text-danger uppercase tracking-tighter">
              Mening yozuvlarim
            </h2>
          </div>
          <QurulishRecentTable key={tableKey} stationId={zapravka.id} />
        </div>
      </main>
    </div>
  );
}
