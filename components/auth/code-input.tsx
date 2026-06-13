"use client";

import { useRef, useEffect } from "react";

interface CodeInputProps {
  code: string;
  onChange: (code: string) => void;
  error?: boolean;
}

export function CodeInput({ code, onChange, error }: CodeInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filled = !!code.trim();

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={4}
      pattern="[0-9]*"
      autoComplete="off"
      value={code}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      aria-label="Kirish kodi"
      aria-invalid={error ? "true" : "false"}
      placeholder="Kodni kiriting"
      className={`h-16 w-full rounded-2xl border-2 px-5 text-center text-2xl font-black shadow-sm outline-none transition-all duration-150 sm:h-[4.5rem] sm:text-3xl ${
        error
          ? "border-danger bg-[var(--input-error-bg)] text-danger animate-shake"
          : filled
            ? "border-[#16a34a] bg-[#ecfdf5] text-[#15803d] shadow-[0_4px_12px_rgba(22,163,74,0.18)] dark:bg-[#0f2a1d] dark:text-emerald-300"
            : "border-[#c7d2fe] bg-white text-foreground dark:bg-[var(--muted)]"
      } focus:border-[#16a34a] focus:ring-4 focus:ring-[rgba(22,163,74,0.18)]`}
    />
  );
}
