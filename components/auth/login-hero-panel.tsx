"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LOGIN_SLIDES, type LoginSlide } from "@/lib/data/login-slides";
import { cn } from "@/lib/utils/cn";

const ROTATE_MS = 4000;

const EASE = [0.4, 0, 0.2, 1] as const;

interface LoginHeroPanelProps {
  slides?: LoginSlide[];
  className?: string;
}

export function LoginHeroPanel({ slides = LOGIN_SLIDES, className }: LoginHeroPanelProps) {
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const count = slides.length;

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      setActive(((index % count) + count) % count);
      setTick((t) => t + 1);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1 || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % count);
      setTick((t) => t + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, prefersReducedMotion]);

  if (count === 0) return null;

  // Slaydlar soni kamaysa, active eski (chegaradan tashqari) qiymatda qolishi mumkin
  const safeIndex = Math.min(active, count - 1);
  const current = slides[safeIndex];

  return (
    <aside
      className={cn(
        "relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-slate-100 dark:bg-slate-900",
        className,
      )}
      aria-label="Tizim haqida"
    >
      <div className="absolute inset-0">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={`${current.id}-${tick}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: EASE }}
          >
            <motion.div
              className="absolute inset-0"
              initial={prefersReducedMotion ? false : { scale: 1.06 }}
              animate={{ scale: 1 }}
              transition={{
                duration: prefersReducedMotion ? 0 : ROTATE_MS / 1000,
                ease: "linear",
              }}
            >
              <Image
                src={current.imageSrc}
                alt=""
                fill
                priority
                sizes="50vw"
                className="object-cover select-none brightness-105 contrast-[1.02] saturate-[1.05]"
                style={{
                  objectPosition: current.objectPosition ?? "center center",
                }}
                draggable={false}
              />
            </motion.div>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.45) 100%)`,
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-end"></div>

      {count > 1 ? (
        <div className="relative z-10 flex items-center gap-2.5 px-10 pb-10">
          {slides.map((slide, index) => (
            <motion.button
              key={slide.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Slayd ${index + 1}: ${slide.title}`}
              aria-current={index === safeIndex ? "true" : undefined}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              animate={{
                scale: index === safeIndex ? 1.08 : 1,
                opacity: index === safeIndex ? 1 : 0.72,
              }}
              transition={{ duration: 0.25, ease: EASE }}
              className={cn(
                "relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 ring-1 ring-black/10",
                index === safeIndex
                  ? "border-white shadow-lg shadow-black/25"
                  : "border-white/50",
              )}
            >
              <Image
                src={slide.imageSrc}
                alt=""
                fill
                className="object-cover brightness-110 contrast-105"
                style={{ objectPosition: slide.objectPosition ?? "center" }}
                sizes="48px"
                draggable={false}
              />
            </motion.button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
