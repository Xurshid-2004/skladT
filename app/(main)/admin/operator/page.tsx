"use client";

import { useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useRouter } from "next/navigation";

import AdminLayout from "@/components/admin/admin-layout";
import { getOperatorCards } from "./operator-data";

const CARD_THEMES = [
  {
    gradient: "from-[#48d15f] via-[#61d27f] to-[#22a85a]",
    shape: "rounded-[1.65rem] rounded-br-[3rem]",
    glow: "shadow-emerald-700/28",
  },
  {
    gradient: "from-[#ffd06a] via-[#ffb84d] to-[#f97316]",
    shape: "rounded-[1.25rem] rounded-tl-[2.8rem]",
    glow: "shadow-orange-700/28",
  },
  {
    gradient: "from-[#80c7ff] via-[#57a5ef] to-[#2563eb]",
    shape: "rounded-[1.75rem] rounded-tr-[3rem]",
    glow: "shadow-blue-700/28",
  },
  {
    gradient: "from-[#66e4d4] via-[#22c3dd] to-[#0891b2]",
    shape: "rounded-[1.35rem] rounded-bl-[3rem]",
    glow: "shadow-cyan-700/28",
  },
  {
    gradient: "from-[#ff9b8f] via-[#fb7185] to-[#e11d48]",
    shape: "rounded-[1.8rem] rounded-tl-[1rem] rounded-br-[2.8rem]",
    glow: "shadow-rose-700/28",
  },
  {
    gradient: "from-[#c084fc] via-[#8b5cf6] to-[#4f46e5]",
    shape: "rounded-[1.25rem] rounded-tr-[2.8rem] rounded-bl-[2.2rem]",
    glow: "shadow-violet-700/28",
  },
  {
    gradient: "from-[#f6d365] via-[#fda085] to-[#fb923c]",
    shape: "rounded-[2rem] rounded-tr-[1rem]",
    glow: "shadow-amber-700/28",
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

export default function OperatorPage() {
  const router = useRouter();
  const cards = useMemo(() => getOperatorCards(), []);
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? "");

  return (
    <AdminLayout>
      <div className="w-full max-w-[96rem] space-y-3 pb-5">
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
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
        >
          {cards.map((card, index) => {
            const active = selectedId === card.id;
            const theme = CARD_THEMES[index % CARD_THEMES.length];

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
                  "group relative min-h-[86px] overflow-hidden border px-4 py-3 text-left text-white shadow-lg transition-none",
                  `bg-gradient-to-br ${theme.gradient} ${theme.shape} ${theme.glow}`,
                  active ? "border-white/80 ring-2 ring-white/60" : "border-white/20 hover:border-white/60",
                ].join(" ")}
              >
                <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.20)_0%,rgba(255,255,255,0.06)_36%,rgba(0,0,0,0.20)_100%)]" />
                <div className="absolute -right-8 -top-8 h-20 w-28 rotate-12 bg-white/18 blur-md" />
                <div className="relative z-10 flex min-h-[62px] items-center">
                  <h2 className="line-clamp-2 text-[1.15rem] font-black uppercase leading-[1.05] tracking-normal text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.62)] sm:text-[1.25rem]">
                    {card.name}
                  </h2>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>
    </AdminLayout>
  );
}
