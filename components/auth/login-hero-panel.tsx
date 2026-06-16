"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LOGIN_SLIDES, type LoginSlide } from "@/lib/data/login-slides";
import { cn } from "@/lib/utils/cn";

const EASE = [0.4, 0, 0.2, 1] as const;
const HERO_IMAGES = ["/login/slide-1.png", "/login/slide-4.png"] as const;

interface LoginHeroPanelProps {
  slides?: LoginSlide[];
  className?: string;
}

export function LoginHeroPanel({ slides = LOGIN_SLIDES, className }: LoginHeroPanelProps) {
  const [activeImage, setActiveImage] = useState(0);
  const count = slides.length;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImage((current) => (current + 1) % HERO_IMAGES.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, []);

  if (count === 0) return null;

  return (
    <aside
      className={cn(
        "relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-slate-100 dark:bg-slate-900",
        className,
      )}
      aria-label="Tizim haqida"
    >
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.85, ease: EASE }}
        >
          {HERO_IMAGES.map((src, index) => (
            <motion.img
              key={src}
              src={src}
              alt=""
              className="absolute inset-0 h-full w-full select-none object-cover brightness-105 contrast-[1.02] saturate-[1.05]"
              aria-hidden="true"
              initial={false}
              animate={{ opacity: index === activeImage ? 1 : 0, scale: index === activeImage ? 1 : 1.04 }}
              transition={{ duration: 0.7, ease: EASE }}
            />
          ))}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.45) 100%)`,
            }}
          />
        </motion.div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-end"></div>
    </aside>
  );
}
