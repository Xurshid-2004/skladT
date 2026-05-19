import { useState, useEffect } from "react";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Har kuni soat 00:00 da yangi sana kalitini qaytaradi.
 * Bu hook'ga bog'liq bo'lgan useEffect'lar yangi kun boshida qayta ishlaydi.
 */
export function useMidnightReset(): string {
  const [dateKey, setDateKey] = useState(todayKey);

  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ms = tomorrow.getTime() - now.getTime();
    const t = setTimeout(() => setDateKey(todayKey()), ms);
    return () => clearTimeout(t);
  }, [dateKey]);

  return dateKey;
}
