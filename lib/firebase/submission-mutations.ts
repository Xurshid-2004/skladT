import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import type { Submission } from "@/lib/types";
import { db } from "./config";
import { sanitizeForFirestore } from "./sanitize";
import {
  recordSubmissionDeletedForSummaries,
  recordSubmissionUpdatedForSummaries,
  standardDateFieldsFromSubmission,
} from "./summary-service";

const COLLECTION = "submissions";

type SubmissionPatch = Record<string, unknown>;

async function loadSubmission(id: string): Promise<Submission | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Submission;
}

function missingDatePatch(submission: Submission): SubmissionPatch {
  const raw = submission as unknown as Record<string, unknown>;
  const patch: SubmissionPatch = {};
  const fields = standardDateFieldsFromSubmission(raw);

  if (typeof raw.dateISO !== "string") patch.dateISO = fields.dateISO;
  if (typeof raw.timestampMs !== "number") patch.timestampMs = fields.timestampMs;
  if (typeof raw.year !== "number") patch.year = fields.year;
  if (typeof raw.month !== "number") patch.month = fields.month;
  if (typeof raw.day !== "number") patch.day = fields.day;

  return patch;
}

export async function updateSubmissionWithSummary(
  submission: Submission,
  changes: SubmissionPatch,
): Promise<Submission> {
  const patch = sanitizeForFirestore({
    ...missingDatePatch(submission),
    ...changes,
  });

  await updateDoc(doc(db, COLLECTION, submission.id), patch);

  const updated = {
    ...submission,
    ...patch,
  } as Submission;

  await recordSubmissionUpdatedForSummaries(submission, updated);
  return updated;
}

export async function updateSubmissionByIdWithSummary(
  id: string,
  changes: SubmissionPatch,
): Promise<Submission | null> {
  const before = await loadSubmission(id);
  if (!before) return null;
  return updateSubmissionWithSummary(before, changes);
}

export async function deleteSubmissionWithSummary(submission: Submission): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, submission.id));
  await recordSubmissionDeletedForSummaries(submission);
}

export async function deleteSubmissionByIdWithSummary(id: string): Promise<void> {
  const before = await loadSubmission(id);
  if (!before) return;
  await deleteSubmissionWithSummary(before);
}
