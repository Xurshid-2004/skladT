"use client";

import { motion } from "framer-motion";
import { Fuel, Gauge, MapPin, ShieldCheck, TrainFront } from "lucide-react";
import { LOGIN_SLIDES, type LoginSlide } from "@/lib/data/login-slides";
import { cn } from "@/lib/utils/cn";

const EASE = [0.4, 0, 0.2, 1] as const;
const HERO_IMAGE = "/login/slide-1.png";

interface LoginHeroPanelProps {
  slides?: LoginSlide[];
  className?: string;
}

export function LoginHeroPanel({ slides = LOGIN_SLIDES, className }: LoginHeroPanelProps) {
  const count = slides.length;

  if (count === 0) return null;

  return (
    <aside
      className={cn(
        "relative hidden h-screen overflow-hidden bg-[#071126] text-white lg:flex lg:w-[52%] xl:w-[54%]",
        className,
      )}
      aria-label="Tizim haqida"
    >
      <img
        src={HERO_IMAGE}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-40 saturate-[1.08]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,17,38,0.96)_0%,rgba(7,17,38,0.82)_48%,rgba(7,17,38,0.72)_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-4 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px]" />

      <div className="relative z-10 flex h-full w-full flex-col justify-between gap-6 px-8 py-8 xl:px-12">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/35">
            <TrainFront className="h-6 w-6" strokeWidth={3} />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">UZ Temiryo'l</h2>
            <p className="text-xs font-semibold text-slate-300">Yoqilg'i ta'minot platformasi</p>
          </div>
        </div>

        <div className="max-w-[36rem]">
          <p className="mb-3 inline-flex rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">
            Operativ nazorat
          </p>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight xl:text-5xl">
            Dizel yoqilg'i taqsimotini bir joydan boshqarish
          </h1>
          <p className="mt-4 max-w-[32rem] text-base font-medium leading-7 text-slate-300">
            Zapravkalar, kunlik kirim-chiqim, operator holati va hisobotlarni tez ko'rish uchun ixcham ish paneli.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-orange-950/30">
              <Fuel className="h-4 w-4" strokeWidth={3} />
              Tez kirish
            </span>
            <span className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-950/30">
              <ShieldCheck className="h-4 w-4" strokeWidth={3} />
              Xavfsiz
            </span>
          </div>
        </div>

        <motion.div
          className="grid gap-3 sm:grid-cols-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div className="rounded-2xl border border-white/18 bg-white/14 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Holat</p>
            <p className="mt-1 text-lg font-black text-white">Onlayn</p>
          </div>
          <div className="rounded-2xl border border-white/18 bg-white/14 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-emerald-200">
              <Gauge className="h-4 w-4" strokeWidth={3} />
              <p className="text-[10px] font-black uppercase tracking-widest">Hisobot</p>
            </div>
            <p className="mt-1 text-lg font-black text-white">Kunlik</p>
          </div>
          <div className="rounded-2xl border border-white/18 bg-white/14 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-sky-200">
              <MapPin className="h-4 w-4" strokeWidth={3} />
              <p className="text-[10px] font-black uppercase tracking-widest">Tarmoq</p>
            </div>
            <p className="mt-1 text-lg font-black text-white">20+</p>
          </div>
        </motion.div>
      </div>
    </aside>
  );
}
