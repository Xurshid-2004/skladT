// Universal Firestore CRUD servisi.
// Maqsad: har qanday formadan kelgan ma'lumotlarni (input + select + dynamic
// fields) Firestore ga to'liq, xavfsiz va auto-id (addDoc) bilan saqlash.
//
// Qoidalar:
//  - localStorage / sessionStorage MUTLAQO ishlatilmaydi.
//  - Firestore — yagona manba (single source of truth).
//  - `undefined` qiymatlar Firestore tomonidan rad etiladi — sanitize qilinadi.
//  - updateDoc partial yangilash beradi: tegmagan field-lar saqlanib qoladi.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type FieldValue,
} from "firebase/firestore";

import { db } from "../../firbase";

/** Har qanday formadan kelishi mumkin bo'lgan ma'lumot turi. */
export type AnyData = Record<string, unknown>;

/** O'qishda qaytariladigan element: hujjat ma'lumotlari + auto id. */
export type WithId<T extends AnyData = AnyData> = T & { id: string };

/**
 * `undefined` qiymatlarni olib tashlaydi (Firestore ularni qabul qilmaydi).
 * Bo'sh string ("") va `null` qiymatlar — to'g'ri qiymatlar deb saqlanadi,
 * shu sababli select da "tanlanmagan" holatni `null` orqali yuborish mumkin.
 * Funksiya rekursiv — ichki obyektlar va massivlar ham tozalanadi.
 */
function sanitize<T>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null) return value;

  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => sanitize(v)) as unknown as T;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue; // undefined field-larni butunlay tashlab yuboramiz
      out[k] = sanitize(v);
    }
    return out as unknown as T;
  }

  return value;
}

/**
 * Yangi hujjat yaratadi (auto-generated ID — addDoc).
 * @returns yaratilgan hujjat id'si.
 */
export async function createItem<T extends AnyData>(
  collectionName: string,
  data: T,
): Promise<string> {
  if (!collectionName) throw new Error("createItem: collectionName bo'sh bo'lishi mumkin emas");
  if (!data || typeof data !== "object") {
    throw new Error("createItem: data obyekt bo'lishi shart");
  }

  const payload: DocumentData = {
    ...sanitize(data),
    createdAt: serverTimestamp() as FieldValue,
    updatedAt: serverTimestamp() as FieldValue,
  };

  const ref = await addDoc(collection(db, collectionName), payload);
  return ref.id;
}

/**
 * Kollektsiyadagi barcha hujjatlarni qaytaradi.
 * Har bir element tarkibida `id` ham bo'ladi.
 */
export async function getItems<T extends AnyData = AnyData>(
  collectionName: string,
): Promise<WithId<T>[]> {
  if (!collectionName) throw new Error("getItems: collectionName bo'sh bo'lishi mumkin emas");

  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
}

/**
 * Bitta hujjatni id orqali oladi. Topilmasa `null` qaytaradi (crash qilmaydi).
 */
export async function getItemById<T extends AnyData = AnyData>(
  collectionName: string,
  id: string,
): Promise<WithId<T> | null> {
  if (!collectionName || !id) return null;

  const snap = await getDoc(doc(db, collectionName, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as T) };
}

/**
 * Mavjud hujjatni yangilaydi. updateDoc partial: faqat berilgan field'larni
 * o'zgartiradi, qolganlariga tegmaydi (eski ma'lumotlar yo'qolmaydi).
 */
export async function updateItem<T extends AnyData>(
  collectionName: string,
  id: string,
  data: Partial<T>,
): Promise<void> {
  if (!collectionName) throw new Error("updateItem: collectionName bo'sh bo'lishi mumkin emas");
  if (!id) throw new Error("updateItem: id majburiy");
  if (!data || typeof data !== "object") {
    throw new Error("updateItem: data obyekt bo'lishi shart");
  }

  const payload: DocumentData = {
    ...sanitize(data),
    updatedAt: serverTimestamp() as FieldValue,
  };

  // `id` field-i payload ichida yuborilmasin — u hujjat kalitini bildirar edi.
  delete (payload as Record<string, unknown>).id;

  await updateDoc(doc(db, collectionName, id), payload);
}

/** Hujjatni o'chiradi. */
export async function deleteItem(collectionName: string, id: string): Promise<void> {
  if (!collectionName) throw new Error("deleteItem: collectionName bo'sh bo'lishi mumkin emas");
  if (!id) throw new Error("deleteItem: id majburiy");

  await deleteDoc(doc(db, collectionName, id));
}

/**
 * Konkret bitta kollektsiya uchun "bog'langan" servis yaratadi.
 * Misol:
 *   const items = createCollectionService<Item>("items");
 *   await items.create({...});
 *   await items.list();
 */
export function createCollectionService<T extends AnyData = AnyData>(collectionName: string) {
  return {
    create: (data: T) => createItem<T>(collectionName, data),
    list: () => getItems<T>(collectionName),
    get: (id: string) => getItemById<T>(collectionName, id),
    update: (id: string, data: Partial<T>) => updateItem<T>(collectionName, id, data),
    remove: (id: string) => deleteItem(collectionName, id),
  };
}
