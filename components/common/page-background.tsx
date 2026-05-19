"use client";

type Variant = "locomotive" | "railway" | "factory" | "construction" | "gear" | "default";

const PATTERNS: Record<Variant, string> = {
  locomotive: "/patterns/locomotive.svg",
  railway: "/patterns/railway.svg",
  factory: "/patterns/factory.svg",
  construction: "/patterns/construction.svg",
  gear: "/patterns/gear.svg",
  default: "/patterns/railway.svg",
};

export default function PageBackground({ variant = "default" }: { variant?: Variant }) {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none -z-10 opacity-[0.075] dark:opacity-[0.045]"
      style={{
        backgroundImage: `url(${PATTERNS[variant]})`,
        backgroundSize: "300px",
        backgroundRepeat: "repeat",
      }}
    />
  );
}
