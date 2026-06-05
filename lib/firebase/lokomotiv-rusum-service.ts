import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./config";
import { sanitizeForFirestore } from "./sanitize";
import type { HarakatTuri } from "@/lib/types";
import { HARAKAT_TURI_LIST, RUSUMI_LIST } from "@/lib/data/lokomotiv-config";

const DOC_REF = doc(db, "settings", "lokomotivRusumlar");

export interface CustomLokomotivRusum {
  id: string;
  value: string;
  label: string;
  code?: string;
  harakatTurlari: HarakatTuri[];
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
  baseValue?: string;
}

export interface LokomotivRusumSettings {
  items: CustomLokomotivRusum[];
  hiddenStaticValues: string[];
}

function normalizeRusum(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeKey(value: string): string {
  return normalizeRusum(value).toLowerCase();
}

function normalizeRusumCode(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function makeRusumId(value: string, createdAt = Date.now()): string {
  return `${normalizeKey(value).replace(/[^a-z0-9]+/g, "-")}-${createdAt}`;
}

function makeStaticOverrideId(value: string): string {
  return `static-${normalizeKey(value).replace(/[^a-z0-9]+/g, "-")}`;
}

const ACTIVE_HARAKAT_TURLARI = new Set<string>(HARAKAT_TURI_LIST.map((item) => item.value));
const STATIC_CODE_BY_VALUE = new Map(
  RUSUMI_LIST.map((item) => [normalizeKey(String(item.value)), String(item.number)]),
);

function normalizeHarakatTurlari(values: unknown[]): HarakatTuri[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values)].filter(
    (value): value is HarakatTuri => typeof value === "string" && ACTIVE_HARAKAT_TURLARI.has(value),
  );
}

function readItems(raw: unknown): CustomLokomotivRusum[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      const value = typeof item?.value === "string" ? normalizeRusum(item.value) : "";
      const label = typeof item?.label === "string" ? normalizeRusum(item.label) : "";
      const createdAt = Number(item?.createdAt ?? Date.now());
      return {
        id: typeof item?.id === "string" && item.id.trim() ? item.id.trim() : makeRusumId(value || label, createdAt),
        value,
        label,
        code: normalizeRusumCode(item?.code) || undefined,
        harakatTurlari: normalizeHarakatTurlari(item?.harakatTurlari ?? []),
        createdAt,
        createdBy: typeof item?.createdBy === "string" ? item.createdBy : undefined,
        updatedAt: item?.updatedAt == null ? undefined : Number(item.updatedAt),
        baseValue: typeof item?.baseValue === "string" ? normalizeRusum(item.baseValue) : undefined,
      };
    })
    .filter((item) => item.value && item.label && item.harakatTurlari.length > 0);
}

function readHiddenStaticValues(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw
      .filter((item): item is string => typeof item === "string")
      .map(normalizeRusum)
      .filter(Boolean),
  )];
}

function readSettings(data: any): LokomotivRusumSettings {
  return {
    items: readItems(data?.items),
    hiddenStaticValues: readHiddenStaticValues(data?.hiddenStaticValues),
  };
}

async function getSettings(): Promise<LokomotivRusumSettings> {
  const snap = await getDoc(DOC_REF);
  return readSettings(snap.exists() ? snap.data() : {});
}

function addHiddenStaticValue(values: string[], value: string): string[] {
  const normalized = normalizeRusum(value);
  if (!normalized) return values;
  const keys = new Set(values.map(normalizeKey));
  return keys.has(normalizeKey(normalized)) ? values : [...values, normalized];
}

function assertValidCode(code: string): void {
  if (!code) throw new Error("Rusum raqamini kiriting.");
  if (!/^\d+$/.test(code)) throw new Error("Rusum raqami faqat raqamlardan iborat bo'lishi kerak.");
}

function assertUniqueCode(
  code: string,
  items: CustomLokomotivRusum[],
  options: { exceptId?: string; allowStaticValue?: string } = {},
): void {
  const normalized = normalizeRusumCode(code);
  if (!normalized) return;

  const allowStaticKey = options.allowStaticValue ? normalizeKey(options.allowStaticValue) : "";
  const staticDuplicate = [...STATIC_CODE_BY_VALUE.entries()].find(
    ([valueKey, staticCode]) => staticCode === normalized && valueKey !== allowStaticKey,
  );
  if (staticDuplicate) throw new Error("Bu rusum raqami asosiy rusumlarda bor.");

  const duplicate = items.find((item) => item.id !== options.exceptId && item.code === normalized);
  if (duplicate) throw new Error("Bu rusum raqami allaqachon mavjud.");
}

export function subscribeLokomotivRusumSettings(
  callback: (settings: LokomotivRusumSettings) => void,
) {
  return onSnapshot(
    DOC_REF,
    (snap) => callback(readSettings(snap.exists() ? snap.data() : {})),
    (err) => {
      console.warn("subscribeLokomotivRusumSettings:", err);
      callback({ items: [], hiddenStaticValues: [] });
    },
  );
}

export function subscribeLokomotivRusumlar(
  callback: (items: CustomLokomotivRusum[]) => void,
) {
  return subscribeLokomotivRusumSettings((settings) => callback(settings.items));
}

export async function addLokomotivRusum(payload: {
  label: string;
  code: string;
  harakatTurlari: HarakatTuri[];
  createdBy?: string;
}): Promise<void> {
  const label = normalizeRusum(payload.label);
  const code = normalizeRusumCode(payload.code);
  const harakatTurlari = normalizeHarakatTurlari(payload.harakatTurlari);
  if (!label || harakatTurlari.length === 0) return;
  assertValidCode(code);

  const settings = await getSettings();
  const current = settings.items;
  const key = normalizeKey(label);
  const existingIndex = current.findIndex((item) => normalizeKey(item.value) === key);
  assertUniqueCode(code, current, {
    exceptId: existingIndex >= 0 ? current[existingIndex]?.id : undefined,
  });

  let next: CustomLokomotivRusum[];
  if (existingIndex >= 0) {
    next = current.map((item, index) =>
      index === existingIndex
        ? {
            ...item,
            label,
            value: label,
            code,
            harakatTurlari: normalizeHarakatTurlari([
              ...item.harakatTurlari,
              ...harakatTurlari,
            ]),
          }
        : item,
    );
  } else {
    next = [
      ...current,
      {
        id: makeRusumId(label),
        value: label,
        label,
        code,
        harakatTurlari,
        createdAt: Date.now(),
        createdBy: payload.createdBy,
      },
    ];
  }

  await setDoc(DOC_REF, sanitizeForFirestore({ items: next }), { merge: true });
}

export async function updateLokomotivRusum(
  id: string,
  payload: {
    label: string;
    code: string;
    harakatTurlari: HarakatTuri[];
  },
): Promise<void> {
  const label = normalizeRusum(payload.label);
  const code = normalizeRusumCode(payload.code);
  const harakatTurlari = normalizeHarakatTurlari(payload.harakatTurlari);
  if (!id || !label || harakatTurlari.length === 0) return;
  assertValidCode(code);

  const settings = await getSettings();
  const current = settings.items;
  const key = normalizeKey(label);
  const duplicate = current.find((item) => item.id !== id && normalizeKey(item.value) === key);
  if (duplicate) throw new Error("Bu rusum allaqachon mavjud.");
  assertUniqueCode(code, current, { exceptId: id });

  let found = false;
  const next = current.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return {
      ...item,
      value: label,
      label,
      code,
      harakatTurlari,
      updatedAt: Date.now(),
    };
  });

  if (!found) throw new Error("Rusum topilmadi.");
  await setDoc(DOC_REF, sanitizeForFirestore({ items: next }), { merge: true });
}

export async function deleteLokomotivRusum(id: string): Promise<void> {
  if (!id) return;

  const settings = await getSettings();
  const current = settings.items;
  const next = current.filter((item) => item.id !== id);

  await setDoc(DOC_REF, sanitizeForFirestore({ items: next }), { merge: true });
}

export async function updateStaticLokomotivRusum(payload: {
  originalValue: string;
  label: string;
  code: string;
  harakatTurlari: HarakatTuri[];
  createdBy?: string;
}): Promise<void> {
  const originalValue = normalizeRusum(payload.originalValue);
  const label = normalizeRusum(payload.label);
  const code = normalizeRusumCode(payload.code);
  const harakatTurlari = normalizeHarakatTurlari(payload.harakatTurlari);
  if (!originalValue || !label || harakatTurlari.length === 0) return;
  assertValidCode(code);

  const settings = await getSettings();
  const id = makeStaticOverrideId(originalValue);
  const key = normalizeKey(label);
  const duplicate = settings.items.find((item) => item.id !== id && normalizeKey(item.value) === key);
  if (duplicate) throw new Error("Bu rusum allaqachon mavjud.");
  assertUniqueCode(code, settings.items, { exceptId: id, allowStaticValue: originalValue });

  const existing = settings.items.find((item) => item.id === id);
  const nextItems = existing
    ? settings.items.map((item) =>
        item.id === id
          ? {
              ...item,
              value: label,
              label,
              code,
              harakatTurlari,
              baseValue: originalValue,
              updatedAt: Date.now(),
            }
          : item,
      )
    : [
        ...settings.items,
        {
          id,
          value: label,
          label,
          code,
          harakatTurlari,
          createdAt: Date.now(),
          createdBy: payload.createdBy,
          baseValue: originalValue,
        },
      ];

  await setDoc(
    DOC_REF,
    sanitizeForFirestore({
      items: nextItems,
      hiddenStaticValues: addHiddenStaticValue(settings.hiddenStaticValues, originalValue),
    }),
    { merge: true },
  );
}

export async function deleteStaticLokomotivRusum(value: string): Promise<void> {
  const originalValue = normalizeRusum(value);
  if (!originalValue) return;

  const settings = await getSettings();
  await setDoc(
    DOC_REF,
    sanitizeForFirestore({
      hiddenStaticValues: addHiddenStaticValue(settings.hiddenStaticValues, originalValue),
    }),
    { merge: true },
  );
}
