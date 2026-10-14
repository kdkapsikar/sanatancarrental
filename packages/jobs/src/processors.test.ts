import { describe, expect, it } from "vitest";
import { processDocumentExpiry, processReviewRequest } from "./processors";

describe("document-expiry processor", () => {
  it("returns notices for documents expiring within the window", async () => {
    const notices = await processDocumentExpiry(
      { today: "2026-10-14", withinDays: 30 },
      {
        listOwners: async () => [
          {
            kind: "vehicle",
            owner: {
              id: "v1",
              active: true,
              documents: [
                { type: "insurance", status: "verified", expiresOn: "2026-10-20" },
                { type: "puc_certificate", status: "verified", expiresOn: "2027-10-20" },
              ],
            },
          },
        ],
      },
    );
    expect(notices).toEqual([
      { owner: "vehicle", ownerId: "v1", documentType: "insurance", expiresOn: "2026-10-20", daysLeft: 6 },
    ]);
  });
});

describe("review-request processor", () => {
  it("is a stub that sends nothing", async () => {
    expect((await processReviewRequest()).sent).toBe(false);
  });
});
