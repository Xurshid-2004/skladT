"use client";

import { Truck, Building2, HardHat, Wrench, Check } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const SECTIONS = [
  {
    key: "lokomotiv",
    label: "ЛОКОМОТИВ",
    icon: Truck,
    card: "bg-blue-700 border-blue-800 shadow-blue-900/20",
    iconBox: "bg-white/18 text-white ring-white/25",
  },
  {
    key: "korxona",
    label: "КОРХОНА",
    icon: Building2,
    card: "bg-orange-600 border-orange-700 shadow-orange-900/20",
    iconBox: "bg-white/18 text-white ring-white/25",
  },
  {
    key: "qurulish",
    label: "КУРИЛИШ",
    icon: HardHat,
    card: "bg-red-500 border-red-700 shadow-red-900/20",
    iconBox: "bg-white/18 text-white ring-white/25",
  },
  {
    key: "tamirlash",
    label: "ТАЪМИРЛАШ",
    icon: Wrench,
    card: "bg-emerald-600 border-emerald-700 shadow-emerald-900/20",
    iconBox: "bg-white/18 text-white ring-white/25",
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
      className="mx-auto my-5 grid w-full max-w-[1780px] grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4"
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
            className={`section-tab-card relative flex min-h-[74px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-3 text-white shadow-lg transition-none sm:min-h-[78px] ${section.card} ${
              isActive ? "ring-2 ring-white/70 ring-offset-2 ring-offset-background" : ""
            }`}
          >
            {isActive && (
              <span
                className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-900 shadow-md ring-1 ring-white/70"
                aria-hidden
              >
                <Check className="h-4 w-4 stroke-[3]" />
              </span>
            )}

            <span
              className={`relative flex h-9 w-9 items-center justify-center rounded-xl ring-1 sm:h-10 sm:w-10 ${section.iconBox}`}
            >
              <Icon className="h-5 w-5 stroke-[2.9] text-white" />
            </span>

            <span className="relative text-center text-[11px] font-black uppercase leading-none tracking-wide text-white sm:text-xs">
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
