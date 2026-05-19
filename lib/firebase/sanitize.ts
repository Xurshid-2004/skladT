// Firestore `undefined` qiymatlarni qabul qilmaydi — saqlashdan oldin
// hujjatdan barcha undefined field'larni rekursiv tarzda olib tashlaymiz.
// `null` va bo'sh string ("") — ataylab qoldirilgan qiymatlar bo'lishi mumkin,
// shuning uchun ularga tegmaymiz.

export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null) return value;

  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => sanitizeForFirestore(v)) as unknown as T;
  }

  // serverTimestamp() va boshqa Firestore sentinel qiymatlarini o'zgartirmaslik
  if (typeof value === "object" && typeof (value as any)._methodName === "string") {
    return value;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = sanitizeForFirestore(v);
    }
    return out as unknown as T;
  }

  return value;
}
