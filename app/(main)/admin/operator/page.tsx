"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/admin-layout";
import { motion, type Variants } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Compass,
  Network,
  RadioTower,
  Route,
  TrainFront,
} from "lucide-react";

type OperatorErju = {
  id: string;
  number: string;
  name: string;
  short: string;
  region: string;
  accent: string;
  glow: string;
  icon: React.ComponentType<{ className?: string }>;
  stations: string[];
};

const ERJU_CARDS: OperatorErju[] = [
  {
    id: "toshkent",
    number: "01",
    name: "Toshkent ERJU",
    short: "Toshkent",
    region: "Markaziy nazorat",
    accent: "from-blue-600 via-sky-500 to-cyan-400",
    glow: "shadow-blue-700/30",
    icon: TrainFront,
    stations: ["Toshkent", "Angren", "Sirdaryo", "Hovos", "Jizzax"],
  },
  {
    id: "qoqon",
    number: "02",
    name: "Qo'qon ERJU",
    short: "Qo'qon",
    region: "Vodiy yo'nalishi",
    accent: "from-violet-600 via-fuchsia-500 to-pink-400",
    glow: "shadow-violet-700/30",
    icon: Network,
    stations: ["Andijon", "Qo'qon", "Marg'lon"],
  },
  {
    id: "buxoro",
    number: "03",
    name: "Buxoro ERJU",
    short: "Buxoro",
    region: "G'arbiy hudud",
    accent: "from-emerald-600 via-teal-500 to-lime-400",
    glow: "shadow-emerald-700/30",
    icon: Building2,
    stations: ["Samarqand", "Ziyovuddin", "Buxoro", "Tinchlik", "Uchquduq"],
  },
  {
    id: "qarshi",
    number: "04",
    name: "Qarshi ERJU",
    short: "Qarshi",
    region: "Janubiy markaz",
    accent: "from-orange-600 via-amber-500 to-yellow-300",
    glow: "shadow-orange-700/30",
    icon: Route,
    stations: ["Qarshi"],
  },
  {
    id: "termiz",
    number: "05",
    name: "Termiz ERJU",
    short: "Termiz",
    region: "Chegara yo'nalishi",
    accent: "from-rose-600 via-red-500 to-orange-400",
    glow: "shadow-rose-700/30",
    icon: RadioTower,
    stations: ["Termiz", "Darband", "Qumqo'rg'on"],
  },
  {
    id: "qongirot",
    number: "06",
    name: "Qo'ng'irot ERJU",
    short: "Qo'ng'irot",
    region: "Shimoliy hudud",
    accent: "from-slate-700 via-indigo-600 to-blue-500",
    glow: "shadow-indigo-700/30",
    icon: Compass,
    stations: ["Qo'ng'irot", "Urganch", "Miskin"],
  },
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 22 },
  },
};

export default function OperatorPage() {
  const [selectedId, setSelectedId] = useState(ERJU_CARDS[0].id);

  return (
    <AdminLayout>
      <div className="max-w-7xl space-y-6 pb-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {ERJU_CARDS.map((card) => {
            const Icon = card.icon;
            const active = selectedId === card.id;

            return (
              <motion.button
                key={card.id}
                type="button"
                variants={item}
                whileHover={{ y: -6, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setSelectedId(card.id)}
                className={[
                  "group relative min-h-[210px] overflow-hidden rounded-[28px] p-5 text-left text-white shadow-xl transition-none",
                  "border border-white/15",
                  active ? `ring-4 ring-white/80 ${card.glow}` : "ring-1 ring-black/5",
                ].join(" ")}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(255,255,255,0.34),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]" />
                <motion.div
                  className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15"
                  animate={{ scale: active ? [1, 1.08, 1] : 1 }}
                  transition={{ duration: 2.8, repeat: active ? Infinity : 0 }}
                />

                <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-16 w-16 place-items-center rounded-[22px] border border-white/20 bg-white/20 shadow-inner backdrop-blur">
                      <Icon className="h-8 w-8 stroke-[2.6]" />
                    </div>
                    <div className="flex items-center gap-2">
                      {active && (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-slate-950 shadow-lg">
                          <CheckCircle2 className="h-5 w-5 stroke-[3]" />
                        </span>
                      )}
                      <span className="rounded-2xl bg-black/20 px-3 py-1.5 text-sm font-black tabular-nums">
                        {card.number}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/75">
                      {card.region}
                    </p>
                    <h2 className="mt-2 text-2xl font-black uppercase tracking-wide">
                      {card.name}
                    </h2>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {card.stations.slice(0, 4).map((station) => (
                        <span
                          key={station}
                          className="rounded-full border border-white/15 bg-black/18 px-2.5 py-1 text-[10px] font-black uppercase text-white/90"
                        >
                          {station}
                        </span>
                      ))}
                      {card.stations.length > 4 && (
                        <span className="rounded-full border border-white/15 bg-black/18 px-2.5 py-1 text-[10px] font-black uppercase text-white/90">
                          +{card.stations.length - 4}
                        </span>
                      )}
                    </div>
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
