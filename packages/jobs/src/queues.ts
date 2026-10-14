import type { OwnerKind } from "@cab/compliance";

/** Queue names. Stubs this session: processors log and return; no messages are sent. */
export const QUEUES = {
  documentExpiry: "document-expiry",
  reviewRequest: "review-request",
  dispatchTimeout: "dispatch-timeout",
} as const;

export interface DocumentExpiryJob {
  /** ISO date the scan runs for (IST). */
  today: string;
  withinDays: number;
}
export interface ReviewRequestJob {
  bookingId: string;
}
export interface DispatchTimeoutJob {
  bookingId: string;
  assignmentId: string;
}

export interface ExpiryNotice {
  owner: OwnerKind;
  ownerId: string;
  documentType: string;
  expiresOn: string;
  daysLeft: number;
}
