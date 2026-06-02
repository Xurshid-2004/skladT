import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Category, Submission } from "@/lib/types";
import { db } from "./config";

type SubmissionLike = Partial<Submission> & {
  id?: string;
  category?: Category | string;
  stationId?: string | null;
  nodeId?: string | null;
  timestamp?: unknown;
  timestampMs?: number;
  dateISO?: string;
  year?: number;
  qanchaBerildi?: unknown;
  qancha?: unknown;
  qanchaOlindi?: unknown;
  dizMasla?: unknown;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalDateISO(input: Date): string {
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, "0");
  const d = String(input.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function timestampToMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const ts = value as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
  };

  if (typeof ts.toMillis === "function") {
    const ms = ts.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof ts.toDate === "function") {
    const ms = ts.toDate().getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof ts.seconds === "number") {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1_000_000);
  }

  return null;
}

export function buildStandardDateFields(input: Date = new Date()) {
  return {
    timestampMs: input.getTime(),
    dateISO: toLocalDateISO(input),
    year: input.getFullYear(),
    month: input.getMonth() + 1,
    day: input.getDate(),
  };
}

export function standardDateFieldsFromSubmission(
  submission: SubmissionLike,
  fallback: Date = new Date(),
) {
  const ms =
    typeof submission.timestampMs === "number"
      ? submission.timestampMs
      : timestampToMillis(submission.timestamp);
  const date = ms == null ? fallback : new Date(ms);
  const fields = buildStandardDateFields(date);
  const dateISO =
    typeof submission.dateISO === "string" && DATE_RE.test(submission.dateISO)
      ? submission.dateISO
      : fields.dateISO;

  return {
    ...fields,
    dateISO,
    year: typeof submission.year === "number" ? submission.year : Number(dateISO.slice(0, 4)),
  };
}

export function fuelKgForSubmission(submission: SubmissionLike): number {
  const raw =
    submission.category === "korxona"
      ? submission.qancha
      : submission.category === "qurulish"
        ? submission.qanchaOlindi
        : submission.qanchaBerildi;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function maslaKgForSubmission(submission: SubmissionLike): number {
  const n = Number(submission.dizMasla ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanDocId(value: string): string {
  return value.replace(/[\/\s]+/g, "_").replace(/_+/g, "_");
}

function summaryParts(submission: SubmissionLike) {
  const stationId = String(submission.stationId ?? "").trim();
  const category = String(submission.category ?? "").trim() as Category;
  if (!stationId || !category) return null;

  const date = standardDateFieldsFromSubmission(submission);
  const nodeId = submission.nodeId == null ? null : String(submission.nodeId);

  return {
    stationId,
    nodeId,
    category,
    dateISO: date.dateISO,
    year: date.year,
  };
}

function sameSummaryBucket(a: ReturnType<typeof summaryParts>, b: ReturnType<typeof summaryParts>) {
  return (
    a != null &&
    b != null &&
    a.stationId === b.stationId &&
    a.category === b.category &&
    a.dateISO === b.dateISO
  );
}

function hasStandardSummaryMarker(submission: SubmissionLike): boolean {
  return (
    typeof submission.dateISO === "string" &&
    DATE_RE.test(submission.dateISO) &&
    typeof submission.timestampMs === "number"
  );
}

async function applySummaryDelta(
  submission: SubmissionLike,
  direction: 1 | -1,
  countDelta: 1 | 0 | -1,
): Promise<void> {
  const parts = summaryParts(submission);
  if (!parts) return;

  const fuelDelta = fuelKgForSubmission(submission) * direction;
  const maslaDelta = maslaKgForSubmission(submission) * direction;
  const dailyId = cleanDocId(`${parts.dateISO}_${parts.stationId}_${parts.category}`);
  const yearlyId = cleanDocId(`${parts.year}_${parts.stationId}_${parts.category}`);

  const shared = {
    stationId: parts.stationId,
    nodeId: parts.nodeId,
    category: parts.category,
    updatedAt: serverTimestamp(),
  };

  await Promise.all([
    setDoc(
      doc(db, "dailySummaries", dailyId),
      {
        ...shared,
        dateISO: parts.dateISO,
        year: parts.year,
        totalFuelKg: increment(fuelDelta),
        totalMaslaKg: increment(maslaDelta),
        recordCount: increment(countDelta),
      },
      { merge: true },
    ),
    setDoc(
      doc(db, "yearlySummaries", yearlyId),
      {
        ...shared,
        year: parts.year,
        totalFuelKg: increment(fuelDelta),
        totalMaslaKg: increment(maslaDelta),
        recordCount: increment(countDelta),
      },
      { merge: true },
    ),
  ]);
}

async function safeSummaryWrite(work: () => Promise<void>, label: string): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.warn(`${label}: summary yangilanmadi`, error);
  }
}

export function submissionWithStandardDateFields<T extends Record<string, unknown>>(
  data: T,
  now: Date = new Date(),
): T & ReturnType<typeof buildStandardDateFields> {
  return {
    ...data,
    ...buildStandardDateFields(now),
  };
}

export async function recordSubmissionCreatedForSummaries(submission: SubmissionLike): Promise<void> {
  await safeSummaryWrite(
    () => applySummaryDelta(submission, 1, 1),
    "recordSubmissionCreatedForSummaries",
  );
}

export async function recordSubmissionDeletedForSummaries(submission: SubmissionLike): Promise<void> {
  if (!hasStandardSummaryMarker(submission)) return;

  await safeSummaryWrite(
    () => applySummaryDelta(submission, -1, -1),
    "recordSubmissionDeletedForSummaries",
  );
}

export async function recordSubmissionUpdatedForSummaries(
  before: SubmissionLike,
  after: SubmissionLike,
): Promise<void> {
  await safeSummaryWrite(async () => {
    if (!hasStandardSummaryMarker(before)) {
      await applySummaryDelta(after, 1, 1);
      return;
    }

    const beforeParts = summaryParts(before);
    const afterParts = summaryParts(after);

    if (sameSummaryBucket(beforeParts, afterParts)) {
      const fuelDelta = fuelKgForSubmission(after) - fuelKgForSubmission(before);
      const maslaDelta = maslaKgForSubmission(after) - maslaKgForSubmission(before);
      await applySummaryDelta(
        {
          ...after,
          qanchaBerildi:
            after.category === "lokomotiv" || after.category === "tamirlash" ? fuelDelta : undefined,
          qancha: after.category === "korxona" ? fuelDelta : undefined,
          qanchaOlindi: after.category === "qurulish" ? fuelDelta : undefined,
          dizMasla: maslaDelta,
        },
        1,
        0,
      );
      return;
    }

    await applySummaryDelta(before, -1, -1);
    await applySummaryDelta(after, 1, 1);
  }, "recordSubmissionUpdatedForSummaries");
}
