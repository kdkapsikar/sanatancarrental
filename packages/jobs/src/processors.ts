import { expiringDocuments, type Owner, type OwnerKind } from "@cab/compliance";
import type { DocumentExpiryJob, ExpiryNotice } from "./queues.js";

export interface OwnerSource {
  /** Loads owners with documents. Implemented against the DB in the next session. */
  listOwners(): Promise<Array<{ kind: OwnerKind; owner: Owner }>>;
}

/**
 * Finds documents expiring within the window. Sending the vendor alert (WhatsApp utility
 * template) is out of scope this session, so the caller just receives the notices.
 */
export async function processDocumentExpiry(
  job: DocumentExpiryJob,
  source: OwnerSource,
): Promise<ExpiryNotice[]> {
  const owners = await source.listOwners();
  return owners.flatMap(({ kind, owner }) =>
    expiringDocuments(kind, owner, job.today, job.withinDays),
  );
}

/**
 * Review requests go to every customer with a completed booking. There is no gating on
 * expected sentiment (plan §7.2.3). Stub: not sent.
 */
export async function processReviewRequest(): Promise<{ sent: false; reason: string }> {
  return { sent: false, reason: "messaging not implemented (out of scope this session)" };
}
