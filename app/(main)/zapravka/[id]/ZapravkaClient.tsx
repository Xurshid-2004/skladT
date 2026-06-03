"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/utils/session";
import { ZAPRAVKALAR } from "@/lib/data/uzellar";
import { Zapravka, Session, LokomotivSubmission } from "@/lib/types";
import { TrainFront, Factory, Construction, Settings, ChevronLeft, LayoutDashboard, Clock, History } from "lucide-react";
import Link from "next/link";
import { subscribeToSubmissions } from "@/lib/firebase/lokomotiv-service";
import { format } from "date-fns";

const categories = [
  { 
    id: "lokomotiv", 
    name: "LOKOMOTIV", 
    icon: TrainFront, 
    color: "bg-primary", 
    description: "Poyezd va manyovr lokomotivlari hisobi",
    path: "/lokomotiv"
  },
  { 
    id: "korxona", 
    name: "KORXONA", 
    icon: Factory, 
    color: "bg-accent", 
    description: "Korxona va tashkilotlar dizel yoqilg'isi",
    path: null
  },
  { 
    id: "qurulish", 
    name: "QURULISH", 
    icon: Construction, 
    color: "bg-danger", 
    description: "Maxsus texnika va qurulish mashinalari",
    path: null
  },
  { 
    id: "tamirlash", 
    name: "TEPLOVOZLAR TA'MIRLASH", 
    icon: Settings, 
    color: "bg-success", 
    description: "Depo ichidagi ta'mirlash ishlari",
    path: null
  },
];

export default function ZapravkaClient() {
  const router = useRouter();
  const params = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [zapravka, setZapravka] = useState<Zapravka | null>(null);
  const [stats, setStats] = useState({
    todayCount: 0,
    lastSubmissionTime: "",
  });

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.push("/login");
      return;
    }
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

    // Skip the section-picker hub and land on lokomotiv directly.
    router.replace(`/zapravka/${z.id}/lokomotiv`);
    return;

    // Subscribe for stats
    const unsubscribe = subscribeToSubmissions(z!.id, (data: LokomotivSubmission[]) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySubmissions = data.filter(sub => {
        const subDate = new Date(sub.timestamp);
        subDate.setHours(0, 0, 0, 0);
        return subDate.getTime() === today.getTime();
      });

      setStats({
        todayCount: todaySubmissions.length,
        lastSubmissionTime: data.length > 0 ? format(data[0].timestamp, "HH:mm") : "---",
      });
    });

    return () => unsubscribe();
  }, [router, params.id]);

  if (!session || !zapravka) return null;

  const handleCategoryClick = (cat: typeof categories[0]) => {
    if (cat.id === 'lokomotiv' || cat.id === 'korxona' || cat.id === 'qurulish' || cat.id === 'tamirlash') {
      router.push(`/zapravka/${zapravka.id}/${cat.id}`);
    } else {
      alert(`Bu bo'lim keyingi bosqichda ishlab chiqiladi. Tez orada!`);
    }
  };

  return (
    <div className="user-panel min-h-screen bg-muted/20">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back and Title */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <Link
            href={`/zapravka/${zapravka.id}/lokomotiv`}
            className="flex items-center gap-2 px-5 py-3 bg-background border-2 border-primary/10 rounded-2xl font-black text-primary hover:bg-primary/5 transition-all shadow-sm w-fit"
          >
            <ChevronLeft className="w-6 h-6" />
            ORQAGA
          </Link>
          
          <div className="text-left md:text-right">
            <h1 className="text-4xl md:text-5xl font-black text-primary tracking-tighter uppercase neon-text">
              {zapravka.name} ZAPRAVKASI
            </h1>
            <p className="text-muted-foreground font-black tracking-[0.2em] text-xs mt-2 uppercase">
              ENERGY SUPPLY MANAGEMENT
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 animate-in zoom-in-95 duration-500">
          <div className="bg-background/50 backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-lg flex items-center gap-5 group">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500">
              <LayoutDashboard className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bugun saqlangan</p>
              <h3 className="text-2xl font-black text-primary">{stats.todayCount} yozuv</h3>
            </div>
          </div>
          <div className="bg-background/50 backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-lg flex items-center gap-5 group">
            <div className="w-14 h-14 bg-accent/10 text-accent rounded-2xl flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all duration-500">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Oxirgi yozuv</p>
              <h3 className="text-2xl font-black text-accent">{stats.lastSubmissionTime}</h3>
            </div>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {categories.map((cat, index) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat)}
              className={`relative group p-8 rounded-3xl overflow-hidden transition-all duration-300 ${cat.color} text-white hover:scale-[1.02] active:scale-95 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-[${index * 100}ms]`}
            >
              <div className="flex flex-col items-start gap-4 relative z-10 text-left">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <cat.icon className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tighter mb-1 uppercase">
                    {cat.name}
                  </h2>
                  <p className="text-white/80 text-sm font-bold tracking-tight">
                    {cat.description}
                  </p>
                </div>
              </div>
              
              {/* Background pattern */}
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:rotate-12 transition-all duration-700">
                <cat.icon className="w-32 h-32" />
              </div>
            </button>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-12 p-8 bg-slate-900 dark:bg-slate-100 text-slate-100 dark:text-slate-900 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl animate-in fade-in duration-1000">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 dark:bg-black/10 rounded-xl flex items-center justify-center">
              <History className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Tizim versiyasi</p>
              <h4 className="font-black">BOSQICH 2: LOKOMOTIV BO'LIMI</h4>
            </div>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs font-bold opacity-60">Foydalanuvchi:</p>
            <h4 className="font-black text-lg uppercase tracking-tight">{session.displayName} ({session.code})</h4>
          </div>
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
