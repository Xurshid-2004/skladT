"use client";

import { Truck, Building2, HardHat, Wrench, Check } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const SECTIONS = [
  {
    key: "lokomotiv",
    label: "ЛОКОМОТИВ",
    icon: Truck,
    card: "bg-gradient-to-br from-sky-500 via-blue-700 to-indigo-800 border-indigo-900 shadow-indigo-900/25",
    iconBox: "bg-white/20 text-white ring-white/30",
  },
  {
    key: "korxona",
    label: "ПРЕДПРИЯТИЕ",
    icon: Building2,
    card: "bg-gradient-to-br from-rose-500 via-pink-600 to-red-700 border-rose-800 shadow-rose-900/25",
    iconBox: "bg-white/20 text-white ring-white/30",
  },
  {
    key: "qurulish",
    label: "СТРОИТЕЛЬСТВО",
    icon: HardHat,
    card: "bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-700 border-orange-800 shadow-orange-900/25",
    iconBox: "bg-white/20 text-white ring-white/30",
  },
  {
    key: "tamirlash",
    label: "РЕМОНТ",
    icon: Wrench,
    card: "bg-gradient-to-br from-teal-400 via-emerald-600 to-green-800 border-emerald-900 shadow-emerald-900/25",
    iconBox: "bg-white/20 text-white ring-white/30",
  },
] as const;

export default function SectionTabs() {
  const params = useParams();
  const pathname = usePathname();
  const stationId = params.id as string;
  // filter(Boolean) removes empty strings caused by trailing slash
  const segments = pathname.split("/").filter(Boolean);
  const currentSection = segments[segments.length - 1];

  return (
    <div
      className="mx-auto mb-3 mt-1 grid w-full max-w-[1500px] grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4"
      role="tablist"
      aria-label="Bo'limlar"
    >
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = currentSection === section.key;
        return (
          <Link
            key={section.key}
            href={`/zapravka/${stationId}/${section.key}`}
            role="tab"
            aria-selected={isActive}
            aria-label={section.label}
            className={`section-tab-card relative flex min-h-[56px] items-center justify-center gap-2 overflow-hidden rounded-xl border px-3 py-1.5 text-white shadow-lg transition-none sm:min-h-[60px] ${
              isActive ? "pr-10" : ""
            } ${section.card} ${
              isActive ? "ring-2 ring-white/70 ring-offset-2 ring-offset-background" : ""
            }`}
          >
            {isActive && (
              <span
                className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-white/70"
                aria-hidden
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </span>
            )}

            <span
              className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ring-1 sm:h-8 sm:w-8 ${section.iconBox}`}
            >
              <Icon className="h-4 w-4 stroke-[2.9] text-white sm:h-[18px] sm:w-[18px]" />
            </span>

            <span className="relative min-w-0 truncate text-center text-[12px] font-black uppercase leading-none tracking-wide text-white sm:text-[13px] lg:text-sm">
              {section.label}
            </span>

            {isActive && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-9 rounded-full bg-white/70" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
