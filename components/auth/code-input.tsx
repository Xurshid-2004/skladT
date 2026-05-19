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
    <div className="flex gap-4 justify-center">
      {code.map((digit, i) => (
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
          className={`w-16 h-20 text-center text-3xl font-black border-2 rounded-2xl bg-background shadow-md focus:ring-4 focus:ring-primary/20 focus:scale-105 transition-all ${
            error ? "border-danger text-danger animate-shake" : "border-primary/25 focus:border-primary text-foreground"
          }`}
        />
      ))}
    </div>
  );
}
