"use client";

import { Truck, Building2, HardHat, Wrench } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

const SECTIONS = [
  {
    key: "lokomotiv",
    label: "LOKOMOTIV",
    icon: Truck,
    color: "bg-primary",
    shadow: "shadow-primary/30",
    iconText: "text-primary",
    iconSurface: "bg-indigo-500/18 border-indigo-400/35",
  },
  {
    key: "korxona",
    label: "KORXONA",
    icon: Building2,
    color: "bg-accent",
    shadow: "shadow-accent/30",
    iconText: "text-accent",
    iconSurface: "bg-amber-500/18 border-amber-400/35",
  },
  {
    key: "qurulish",
    label: "QURULISH",
    icon: HardHat,
    color: "bg-danger",
    shadow: "shadow-danger/30",
    iconText: "text-danger",
    iconSurface: "bg-red-500/18 border-red-400/35",
  },
  {
    key: "tamirlash",
    label: "TA'MIRLASH",
    icon: Wrench,
    color: "bg-success",
    shadow: "shadow-success/30",
    iconText: "text-success",
    iconSurface: "bg-green-500/18 border-green-400/35",
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = currentSection === section.key;
        return (
          <Link
            key={section.key}
            href={`/zapravka/${stationId}/${section.key}`}
            className={`group relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl min-h-[76px] overflow-hidden transition-all duration-300 border-2 ${
              isActive
                ? `${section.color} text-white border-transparent shadow-xl ${section.shadow} scale-[1.03]`
                : "bg-background/80 backdrop-blur-md border-primary/15 hover:border-primary/40 hover:bg-primary/10 hover:scale-[1.02] hover:shadow-lg text-foreground"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                isActive
                  ? "bg-white/20 border-white/30 backdrop-blur-sm"
                  : `${section.iconSurface} group-hover:bg-background group-hover:border-primary/45`
              }`}
            >
              <Icon
                className={`w-5 h-5 stroke-[2.8] transition-transform duration-300 group-hover:scale-110 ${
                  isActive ? "text-white" : section.iconText
                }`}
              />
            </div>
            <span
              className={`text-[11px] font-black tracking-wide uppercase ${
                isActive ? "text-white" : "text-foreground"
              }`}
            >
              {section.label}
            </span>
            {isActive && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white/60" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
