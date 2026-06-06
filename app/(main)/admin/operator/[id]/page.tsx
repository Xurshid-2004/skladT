import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BatteryMedium, MapPin } from "lucide-react";

import AdminLayout from "@/components/admin/admin-layout";
import { ERJU_LABEL, getOperatorCardById, getOperatorCards } from "../operator-data";

type OperatorStationPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return getOperatorCards().map((card) => ({
    id: card.id,
  }));
}

export default async function OperatorStationPage({ params }: OperatorStationPageProps) {
  const { id } = await params;
  const card = getOperatorCardById(id);

  if (!card) {
    notFound();
  }

  const erjuName = ERJU_LABEL[card.uzelId] ?? card.uzelId;

  return (
    <AdminLayout>
      <div className="w-full max-w-[96rem] space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Operator
            </p>
            <h1 className="mt-1 break-words text-3xl font-black uppercase tracking-wide text-slate-950 dark:text-white">
              {card.name}
            </h1>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{erjuName}</p>
          </div>

          <Link
            href="/admin/operator"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-950/20 transition hover:brightness-110 dark:bg-white dark:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Orqaga
          </Link>
        </div>

        <section className="overflow-hidden rounded-[1.75rem] border border-white/40 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-2xl shadow-slate-950/18 dark:border-white/10">
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <div className="flex min-h-[18rem] flex-col justify-between rounded-[1.35rem] border border-white/12 bg-white/8 p-5 shadow-inner shadow-white/5 backdrop-blur">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-emerald-200/90">
                  Zapravka sahifasi
                </p>
                <h2 className="mt-3 text-4xl font-black uppercase leading-tight tracking-normal text-white">
                  {card.name}
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-200">
                  Kunlik nazorat oynasi.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/12 bg-black/24 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/55">ERJU</p>
                  <p className="mt-1 text-lg font-black text-white">{erjuName}</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-black/24 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/55">Slug</p>
                  <p className="mt-1 text-lg font-black text-white">{card.slug}</p>
                </div>
              </div>
            </div>

            <div className="grid place-items-center rounded-[1.35rem] border border-white/12 bg-black/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <div className="relative grid aspect-square w-full max-w-[17rem] place-items-center rounded-[2rem] border border-white/15 bg-[#121827] shadow-[0_24px_55px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-7 rounded-full bg-[conic-gradient(from_-42deg,#facc15_0deg_108deg,rgba(255,255,255,0.18)_108deg_360deg)] shadow-[0_0_34px_rgba(250,204,21,0.32)]" />
                <div className="absolute inset-[4.9rem] rounded-full bg-[#121827] shadow-[inset_0_0_28px_rgba(15,23,42,0.94)]" />
                <div className="relative z-10 flex flex-col items-center">
                  <BatteryMedium className="h-10 w-10 text-white" strokeWidth={2.8} />
                  <span className="mt-3 text-6xl font-black leading-none tracking-normal text-white">30%</span>
                  <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/80">
                    <MapPin className="h-3.5 w-3.5" />
                    {card.slug}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
