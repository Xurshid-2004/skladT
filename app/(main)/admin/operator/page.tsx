"use client";

import { useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { BatteryMedium, CheckCircle2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";

import AdminLayout from "@/components/admin/admin-layout";
import { ERJU_LABEL, getOperatorCards } from "./operator-data";

const CARD_THEMES = [
  {
    gradient: "from-[#48d15f] via-[#61d27f] to-[#22a85a]",
    shape: "rounded-[1.65rem] rounded-br-[3rem]",
    glow: "shadow-emerald-700/28",
    arc: "#fef08a",
    glowColor: "rgba(254,240,138,0.32)",
  },
  {
    gradient: "from-[#ffd06a] via-[#ffb84d] to-[#f97316]",
    shape: "rounded-[1.25rem] rounded-tl-[2.8rem]",
    glow: "shadow-orange-700/28",
    arc: "#fff7ad",
    glowColor: "rgba(255,247,173,0.34)",
  },
  {
    gradient: "from-[#80c7ff] via-[#57a5ef] to-[#2563eb]",
    shape: "rounded-[1.75rem] rounded-tr-[3rem]",
    glow: "shadow-blue-700/28",
    arc: "#dbeafe",
    glowColor: "rgba(219,234,254,0.32)",
  },
  {
    gradient: "from-[#66e4d4] via-[#22c3dd] to-[#0891b2]",
    shape: "rounded-[1.35rem] rounded-bl-[3rem]",
    glow: "shadow-cyan-700/28",
    arc: "#cffafe",
    glowColor: "rgba(207,250,254,0.33)",
  },
  {
    gradient: "from-[#ff9b8f] via-[#fb7185] to-[#e11d48]",
    shape: "rounded-[1.8rem] rounded-tl-[1rem] rounded-br-[2.8rem]",
    glow: "shadow-rose-700/28",
    arc: "#ffe4e6",
    glowColor: "rgba(255,228,230,0.32)",
  },
  {
    gradient: "from-[#c084fc] via-[#8b5cf6] to-[#4f46e5]",
    shape: "rounded-[1.25rem] rounded-tr-[2.8rem] rounded-bl-[2.2rem]",
    glow: "shadow-violet-700/28",
    arc: "#f5d0fe",
    glowColor: "rgba(245,208,254,0.32)",
  },
  {
    gradient: "from-[#f6d365] via-[#fda085] to-[#fb923c]",
    shape: "rounded-[2rem] rounded-tr-[1rem]",
    glow: "shadow-amber-700/28",
    arc: "#fef3c7",
    glowColor: "rgba(254,243,199,0.34)",
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.04,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

function GaugePreview({
  value = 30,
  arc = "#fde047",
  glowColor = "rgba(250,204,21,0.22)",
}: {
  value?: number;
  arc?: string;
  glowColor?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  const deg = safeValue * 3.6;

  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[145px] place-items-center rounded-[1.6rem] rounded-tr-[0.8rem] border border-white/18 bg-[#121827]/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_34px_rgba(2,6,23,0.28)] backdrop-blur">
      <div
        className="absolute inset-4 rounded-full"
        style={{
          background: `conic-gradient(from -42deg, ${arc} 0deg ${deg}deg, rgba(255,255,255,0.22) ${deg}deg 360deg)`,
          boxShadow: `0 0 26px ${glowColor}`,
        }}
      />
      <div className="absolute inset-[31px] rounded-full bg-[#121827] shadow-[inset_0_0_28px_rgba(15,23,42,0.92)]" />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <BatteryMedium className="h-8 w-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.22)]" strokeWidth={2.8} />
        <span className="mt-2 text-4xl font-black leading-none tracking-normal text-white tabular-nums">
          {safeValue}%
        </span>
      </div>
    </div>
  );
}

export default function OperatorPage() {
  const router = useRouter();
  const cards = useMemo(() => getOperatorCards(), []);
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");

  return (
    <AdminLayout>
      <div className="w-full max-w-[96rem] space-y-4 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Operator
            </p>
            <h1 className="text-2xl font-black uppercase tracking-wide text-slate-950 dark:text-white">
              Zapravkalar nazorati
            </h1>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cardlar</p>
            <p className="text-xl font-black tabular-nums text-slate-950 dark:text-white">{cards.length}</p>
          </div>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {cards.map((card, index) => {
            const active = selectedId === card.id;
            const theme = CARD_THEMES[index % CARD_THEMES.length];
            const erjuName = ERJU_LABEL[card.uzelId] ?? card.uzelId;

            return (
              <motion.button
                key={card.id}
                type="button"
                variants={item}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setSelectedId(card.id);
                  router.push(`/admin/operator/${card.id}`);
                }}
                className={[
                  "group relative min-h-[232px] overflow-hidden border p-3 text-left text-white shadow-xl transition-none",
                  `bg-gradient-to-br ${theme.gradient} ${theme.shape} ${theme.glow}`,
                  active ? "border-white/80 ring-4 ring-white/55" : "border-white/20 hover:border-white/60",
                ].join(" ")}
              >
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0.06)_36%,rgba(0,0,0,0.20)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.20))]" />
                <div className="absolute -right-10 top-5 h-24 w-44 rotate-12 bg-white/18 blur-md" />
                <div className="relative z-10 flex h-full flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1 rounded-2xl rounded-tr-md border border-white/22 bg-black/34 px-3 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/86 drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]">
                        {erjuName}
                      </p>
                      <h2 className="mt-1 text-[1.35rem] font-black uppercase leading-[1.08] tracking-normal text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.72)]">
                        {card.name}
                      </h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {active && (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-slate-950 shadow-lg shadow-black/20">
                          <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
                        </span>
                      )}
                      <span className="rounded-xl border border-white/18 bg-black/18 px-2 py-1 text-xs font-black tabular-nums text-white backdrop-blur">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </div>

                  <GaugePreview arc={theme.arc} glowColor={theme.glowColor} />

                  <div className="flex items-center justify-between gap-2 rounded-2xl rounded-tr-md border border-white/25 bg-black/30 px-2.5 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.16)] backdrop-blur-md">
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-white" />
                      <span className="truncate">{card.slug}</span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-white/18 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                      30%
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </AdminLayout>
  );
}
