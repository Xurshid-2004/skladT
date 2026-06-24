import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/config";
import { sanitizeForFirestore } from "@/lib/firebase/sanitize";
import type { Category } from "@/lib/types";

const OPERATOR_BALANCES_KEY = "operator_station_fuel_balances";
const OPERATOR_BALANCES_CHANGED_EVENT = "operatorBalancesChanged";
const OPERATOR_OVERLIMITS_KEY = "operator_station_fuel_overlimits";
const OPERATOR_OVERLIMITS_CHANGED_EVENT = "operatorOverlimitsChanged";
const OPERATOR_BALANCE_COLLECTION = "operatorStationBalances";
const OPERATOR_OVERLIMIT_COLLECTION = "operatorOverlimits";

type OperatorOverlimitDetails = {
  category?: Category;
  staffCode?: string;
  staffName?: string;
  nodeId?: string | null;
};

type OperatorFuelState = {
  balances: Record<string, number>;
  overlimits: Record<string, number>;
  exceededKg: number;
};

function normalizeFuelKg(kg: number) {
  return Math.round(kg * 1000) / 1000;
}

function readNumberMap(key: string): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const balances: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const amount = Number(value);
      if (Number.isFinite(amount) && amount >= 0) {
        balances[key] = amount;
      }
    }
    return balances;
  } catch {
    return {};
  }
}

function writeNumberMap(key: string, eventName: string, values: Record<string, number>) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(key, JSON.stringify(values));
  window.dispatchEvent(new Event(eventName));
}

export function readOperatorBalances() {
  return readNumberMap(OPERATOR_BALANCES_KEY);
}

export function readOperatorOverlimits() {
  return readNumberMap(OPERATOR_OVERLIMITS_KEY);
}

function writeOperatorBalances(balances: Record<string, number>) {
  writeNumberMap(OPERATOR_BALANCES_KEY, OPERATOR_BALANCES_CHANGED_EVENT, balances);
}

function writeOperatorOverlimits(overlimits: Record<string, number>) {
  writeNumberMap(OPERATOR_OVERLIMITS_KEY, OPERATOR_OVERLIMITS_CHANGED_EVENT, overlimits);
}

function getRemoteFuelNumbers(data: Record<string, unknown> | undefined) {
  const balanceKg = Number(data?.balanceKg ?? data?.currentKg ?? 0);
  const overlimitKg = Number(data?.overlimitKg ?? 0);

  return {
    balanceKg: Number.isFinite(balanceKg) && balanceKg >= 0 ? normalizeFuelKg(balanceKg) : 0,
    overlimitKg: Number.isFinite(overlimitKg) && overlimitKg >= 0 ? normalizeFuelKg(overlimitKg) : 0,
  };
}

function writeLocalFuelState(
  stationId: string,
  balanceKg: number,
  overlimitKg: number,
): OperatorFuelState {
  const balances = { ...readOperatorBalances(), [stationId]: normalizeFuelKg(Math.max(0, balanceKg)) };
  const overlimits = { ...readOperatorOverlimits(), [stationId]: normalizeFuelKg(Math.max(0, overlimitKg)) };

  writeOperatorBalances(balances);
  writeOperatorOverlimits(overlimits);

  return { balances, overlimits, exceededKg: 0 };
}

async function saveOperatorStationFuelState(stationId: string, balanceKg: number, overlimitKg: number) {
  try {
    await setDoc(
      doc(db, OPERATOR_BALANCE_COLLECTION, stationId),
      sanitizeForFirestore({
        stationId,
        balanceKg: normalizeFuelKg(Math.max(0, balanceKg)),
        overlimitKg: normalizeFuelKg(Math.max(0, overlimitKg)),
        updatedAt: serverTimestamp(),
      }),
      { merge: true },
    );
  } catch (error) {
    console.warn("operatorStationBalances yozilmadi:", error);
  }
}

export function subscribeOperatorFuelState(callback: (state: Omit<OperatorFuelState, "exceededKg">) => void) {
  return onSnapshot(
    collection(db, OPERATOR_BALANCE_COLLECTION),
    (snapshot) => {
      const balances: Record<string, number> = {};
      const overlimits: Record<string, number> = {};

      snapshot.docs.forEach((item) => {
        const stationId = String(item.data().stationId ?? item.id).trim();
        if (!stationId) return;

        const remote = getRemoteFuelNumbers(item.data());
        balances[stationId] = remote.balanceKg;
        overlimits[stationId] = remote.overlimitKg;
      });

      writeOperatorBalances(balances);
      writeOperatorOverlimits(overlimits);
      callback({ balances, overlimits });
    },
    (error) => {
      console.warn("operatorStationBalances o'qilmadi:", error);
    },
  );
}

export function setOperatorStationFuelBalance(stationId: string, amountKg: number) {
  const cleanStationId = String(stationId ?? "").trim();
  const cleanAmount = Number(amountKg);

  if (!cleanStationId || !Number.isFinite(cleanAmount) || cleanAmount < 0) {
    return { balances: readOperatorBalances(), overlimits: readOperatorOverlimits(), exceededKg: 0 };
  }

  const balances = readOperatorBalances();
  const overlimits = readOperatorOverlimits();
  const currentOverlimit = overlimits[cleanStationId] ?? 0;
  const coveredOverlimit = Math.min(currentOverlimit, cleanAmount);
  const nextOverlimit = normalizeFuelKg(currentOverlimit - coveredOverlimit);
  const nextBalance = normalizeFuelKg(cleanAmount - coveredOverlimit);

  const nextBalances = { ...balances, [cleanStationId]: nextBalance };
  const nextOverlimits = { ...overlimits, [cleanStationId]: nextOverlimit };

  writeOperatorBalances(nextBalances);
  writeOperatorOverlimits(nextOverlimits);
  void saveOperatorStationFuelState(cleanStationId, nextBalance, nextOverlimit);

  return { balances: nextBalances, overlimits: nextOverlimits, exceededKg: 0 };
}

export function changeOperatorStationFuelBalance(stationId: string, deltaKg: number) {
  const cleanStationId = String(stationId ?? "").trim();
  const cleanDelta = Number(deltaKg);

  if (!cleanStationId || !Number.isFinite(cleanDelta) || cleanDelta === 0) {
    return { balances: readOperatorBalances(), overlimits: readOperatorOverlimits(), exceededKg: 0 };
  }

  const balances = readOperatorBalances();
  const overlimits = readOperatorOverlimits();
  const currentBalance = balances[cleanStationId] ?? 0;
  const currentOverlimit = overlimits[cleanStationId] ?? 0;

  let nextBalance = currentBalance;
  let nextOverlimit = currentOverlimit;
  let exceededKg = 0;

  if (cleanDelta > 0) {
    const coveredOverlimit = Math.min(currentOverlimit, cleanDelta);
    nextOverlimit = normalizeFuelKg(currentOverlimit - coveredOverlimit);
    nextBalance = normalizeFuelKg(currentBalance + (cleanDelta - coveredOverlimit));
  } else {
    const spendAmount = Math.abs(cleanDelta);
    if (spendAmount <= currentBalance) {
      nextBalance = normalizeFuelKg(currentBalance - spendAmount);
    } else {
      exceededKg = normalizeFuelKg(spendAmount - currentBalance);
      nextBalance = 0;
      nextOverlimit = normalizeFuelKg(currentOverlimit + exceededKg);
    }
  }

  const nextBalances = { ...balances, [cleanStationId]: nextBalance };
  const nextOverlimits = { ...overlimits, [cleanStationId]: nextOverlimit };

  writeOperatorBalances(nextBalances);
  writeOperatorOverlimits(nextOverlimits);
  void saveOperatorStationFuelState(cleanStationId, nextBalance, nextOverlimit);

  return { balances: nextBalances, overlimits: nextOverlimits, exceededKg };
}

async function saveOperatorOverlimitRecord(
  stationId: string,
  amountKg: number,
  usedKg: number,
  details?: OperatorOverlimitDetails,
) {
  try {
    await addDoc(
      collection(db, OPERATOR_OVERLIMIT_COLLECTION),
      sanitizeForFirestore({
        stationId,
        amountKg,
        usedKg,
        category: details?.category,
        staffCode: details?.staffCode,
        staffName: details?.staffName,
        nodeId: details?.nodeId,
        createdAt: serverTimestamp(),
      }),
    );
  } catch (error) {
    console.warn("operatorOverlimits yozilmadi:", error);
  }
}

export async function subtractOperatorStationFuel(
  stationId: string,
  amountKg: number,
  details?: OperatorOverlimitDetails,
) {
  const cleanStationId = String(stationId ?? "").trim();
  const cleanAmount = Number(amountKg);

  if (!cleanStationId || !Number.isFinite(cleanAmount) || cleanAmount <= 0) return;

  let result: OperatorFuelState;

  try {
    result = await runTransaction(db, async (transaction) => {
      const ref = doc(db, OPERATOR_BALANCE_COLLECTION, cleanStationId);
      const snapshot = await transaction.get(ref);
      const localBalances = readOperatorBalances();
      const localOverlimits = readOperatorOverlimits();
      const remote = snapshot.exists() ? getRemoteFuelNumbers(snapshot.data()) : null;
      const currentBalance = remote?.balanceKg ?? localBalances[cleanStationId] ?? 0;
      const currentOverlimit = remote?.overlimitKg ?? localOverlimits[cleanStationId] ?? 0;

      let nextBalance = currentBalance;
      let nextOverlimit = currentOverlimit;
      let exceededKg = 0;

      if (cleanAmount <= currentBalance) {
        nextBalance = normalizeFuelKg(currentBalance - cleanAmount);
      } else {
        exceededKg = normalizeFuelKg(cleanAmount - currentBalance);
        nextBalance = 0;
        nextOverlimit = normalizeFuelKg(currentOverlimit + exceededKg);
      }

      transaction.set(
        ref,
        sanitizeForFirestore({
          stationId: cleanStationId,
          balanceKg: nextBalance,
          overlimitKg: nextOverlimit,
          updatedAt: serverTimestamp(),
        }),
        { merge: true },
      );

      return {
        balances: { ...localBalances, [cleanStationId]: nextBalance },
        overlimits: { ...localOverlimits, [cleanStationId]: nextOverlimit },
        exceededKg,
      };
    });

    writeOperatorBalances(result.balances);
    writeOperatorOverlimits(result.overlimits);
  } catch (error) {
    console.warn("operatorStationBalances transaction ishlamadi:", error);
    result = changeOperatorStationFuelBalance(cleanStationId, -cleanAmount);
  }

  if (result.exceededKg > 0) {
    await saveOperatorOverlimitRecord(cleanStationId, result.exceededKg, cleanAmount, details);
  }
}
