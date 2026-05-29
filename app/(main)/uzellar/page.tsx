"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/utils/session";
import { UZELLAR, ZAPRAVKALAR } from "@/lib/data/uzellar";
import { Session, Uzel } from "@/lib/types";
import { LayoutGrid, Network, History, Compass, MapPin, Flag, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import PageBackground from "@/components/common/page-background";

const iconMap = {
  LayoutGrid,
  Network,
  History,
  Compass,
  MapPin,
  Flag,
};

export default function UzellarPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [selectedUzel, setSelectedUzel] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.push("/login");
    } else {
      setSession(s);
    }
  }, [router]);

  if (!session) return null;

  const isUzelDisabled = (uzelId: string) => {
    if (session.role === "admin") return false;
    return session.nodeId !== uzelId;
  };

  const getUzelZapravka = (uzelId: string) => {
    if (session.role === "worker" && session.nodeId === uzelId) {
      return session.stationId;
    }
    return null;
  };

  const uzelZapravkalar = selectedUzel 
    ? ZAPRAVKALAR.filter(z => z.uzelId === selectedUzel)
    : [];

  const currentUzel = UZELLAR.find(u => u.id === selectedUzel);

  return (
    <div className="min-h-screen bg-muted/30 relative">
      <PageBackground variant="railway" />
      <Header />
      
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="text-center mb-16 space-y-4">
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase sm:text-5xl md:text-6xl animate-in fade-in slide-in-from-top duration-700">
            {selectedUzel ? currentUzel?.name : "УЗЕЛ ТАНЛАНГ"}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg md:text-xl font-medium">
            {selectedUzel 
              ? "Ушбу узелдаги керакли заправкани танланг" 
              : "Ҳисоб-китобларни давом эттириш учун тегишли темир йўл узелини танланг"}
          </p>
        </div>

        {!selectedUzel ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2 md:px-0">
            {UZELLAR.map((uzel, index) => {
              const Icon = iconMap[uzel.icon as keyof typeof iconMap] || LayoutGrid;
              const disabled = isUzelDisabled(uzel.id);
              const zapravkaId = getUzelZapravka(uzel.id);
              
              const handleClick = () => {
                if (disabled) return;
                
                if (zapravkaId) {
                  router.push(`/zapravka/${zapravkaId}`);
                } else {
                  setSelectedUzel(uzel.id);
                }
              };

              return (
                <div
                  key={uzel.id}
                  onClick={handleClick}
                  className={`relative group p-8 rounded-3xl transition-all duration-300 border-2 overflow-hidden shadow-md cursor-pointer ${
                    disabled
                      ? "bg-muted/40 border-muted opacity-70 grayscale cursor-not-allowed"
                      : "bg-background border-primary/15 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1"
                  } animate-in fade-in slide-in-from-bottom duration-500`}
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        disabled ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                      }`}>
                        <Icon className="w-8 h-8" />
                      </div>
                      
                      <div>
                        <h2 className={`text-2xl font-black tracking-tight mb-1 ${disabled ? "text-muted-foreground" : "text-primary"}`}>
                          {uzel.name}
                        </h2>
                        <p className="text-muted-foreground font-semibold">
                          {uzel.description}
                        </p>
                      </div>
                    </div>

                    {!disabled && (
                      <div className="p-2 rounded-full bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                        <ChevronRight className="w-6 h-6" />
                      </div>
                    )}
                    {disabled && (
                      <div className="p-2 rounded-full bg-muted text-muted-foreground">
                        <Lock className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  
                  <div className={`absolute -right-4 -bottom-4 w-32 h-32 rounded-full blur-3xl transition-opacity opacity-0 group-hover:opacity-20 ${
                    disabled ? "bg-muted" : "bg-primary"
                  }`} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => setSelectedUzel(null)}
              className="flex items-center gap-2 px-6 py-3 bg-background border-2 border-primary/10 rounded-2xl font-black text-primary hover:bg-primary/5 transition-all"
            >
              <ChevronRight className="w-6 h-6 rotate-180" /> ОРҚАГА
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {uzelZapravkalar.map((zap) => (
                <Link
                  key={zap.id}
                  href={`/zapravka/${zap.id}`}
                  className="p-8 bg-background border-2 border-primary/15 rounded-[32px] hover:border-primary hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 transition-all group"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all mb-4">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-primary uppercase tracking-tighter">{zap.name}</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Заправка пункти</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {session.role === "admin" && (
          <div className="mt-16 flex justify-center animate-in fade-in duration-1000">
            <Link
              href="/admin"
              className="px-10 py-5 bg-slate-900 dark:bg-slate-100 text-slate-100 dark:text-slate-900 rounded-2xl font-black text-lg tracking-wider hover:opacity-90 transition-all shadow-xl hover:shadow-primary/20"
            >
              {session.role === "admin" ? "ADMIN PANEL" : "DASTURCHI PANELI"}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
