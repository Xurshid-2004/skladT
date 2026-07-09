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
      className="mx-auto mb-2 mt-1 grid w-full grid-cols-2 gap-1.5 sm:gap-2 md:sticky md:top-[4.5rem] md:mx-0 md:mb-0 md:max-h-[calc(100vh-5.5rem)] md:grid-cols-1 md:content-start md:gap-2.5 md:overflow-y-auto md:rounded-[1.5rem] md:border md:border-white/10 md:bg-black md:p-2 md:shadow-[1px_0_0_rgba(255,255,255,0.06),8px_0_32px_rgba(0,0,0,0.18)]"
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
            className={`section-tab-card relative flex min-h-[46px] items-center justify-center gap-2 overflow-hidden rounded-xl border px-2.5 py-1 text-white shadow-md transition-none sm:min-h-[50px] md:min-h-[5.6rem] md:justify-start md:gap-3 md:rounded-[1.35rem] md:px-4 ${
              isActive ? "ring-2 ring-white/70 ring-offset-1 ring-offset-background" : ""
            } ${section.card} ${
              isActive ? "brightness-105" : "opacity-95"
            }`}
          >
            {isActive && (
              <span
                className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-white/70"
                aria-hidden
              >
                <Check className="h-3 w-3 stroke-[3]" />
              </span>
            )}

            <span
              className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 sm:h-8 sm:w-8 md:h-11 md:w-11 md:rounded-2xl ${section.iconBox}`}
            >
              <Icon className="h-4 w-4 stroke-[2.9] text-white md:h-5 md:w-5" />
            </span>

            <span className="relative min-w-0 truncate text-center text-[11px] font-black uppercase leading-none tracking-wide text-white sm:text-[12px] md:text-left md:text-sm">
              {section.label}
            </span>

            {isActive && (
              <span className="absolute bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-white/80 md:bottom-auto md:left-0 md:top-1/2 md:h-12 md:w-1 md:-translate-x-0 md:-translate-y-1/2" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
