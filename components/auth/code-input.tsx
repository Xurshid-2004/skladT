"use client";

import { useRef, useEffect } from "react";

interface CodeInputProps {
  code: string[];
  onChange: (code: string[]) => void;
  error?: boolean;
}

export function CodeInput({ code, onChange, error }: CodeInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    onChange(newCode);

    if (value && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
      {code.map((digit, i) => {
        const filled = !!digit;
        return (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            aria-label={`Kod raqami ${i + 1}`}
            aria-invalid={error ? "true" : "false"}
            className={`h-16 w-full text-center text-2xl font-black sm:h-[4.5rem] sm:text-3xl rounded-2xl border-2 shadow-sm transition-all duration-150 outline-none focus:scale-[1.03] ${
              error
                ? "border-danger bg-[var(--input-error-bg)] text-danger animate-shake"
                : filled
                  ? "border-[#16a34a] bg-[#ecfdf5] dark:bg-[#0f2a1d] text-[#15803d] dark:text-emerald-300 shadow-[0_4px_12px_rgba(22,163,74,0.18)]"
                  : "border-[#c7d2fe] bg-white dark:bg-[var(--muted)] text-foreground"
            } focus:border-[#16a34a] focus:ring-4 focus:ring-[rgba(22,163,74,0.18)]`}
          />
        );
      })}
    </div>
  );
}
