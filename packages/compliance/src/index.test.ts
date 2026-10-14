import { describe, expect, it } from "vitest";
import {
  REQUIREMENTS,
  checkEligibility,
  expiringDocuments,
  type ComplianceDocument,
  type EligibilityInput,
  type OwnerKind,
} from "./index";

const CONFIG = { maxVehicleAgeYears: 9, expiryWarningDays: 30 };
const TRIP = "2026-11-10";

const allVerified = (kind: OwnerKind, expiresOn = "2027-06-30"): ComplianceDocument[] =>
  REQUIREMENTS[kind].map((r) => ({
    type: r.type,
    status: "verified",
    expiresOn: r.expires ? expiresOn : null,
  }));

function valid(): EligibilityInput {
  return {
    vendor: { id: "vendor-1", active: true, documents: allVerified("vendor") },
    vehicle: {
      id: "vehicle-1",
      active: true,
      registrationYear: 2022,
      documents: allVerified("vehicle"),
    },
    driver: { id: "driver-1", active: true, documents: allVerified("driver") },
    tripStart: TRIP,
  };
}

const codes = (r: ReturnType<typeof checkEligibility>) => r.reasons.map((x) => x.code);

describe("checkEligibility", () => {
  it("passes when everything is verified and in date", () => {
    const r = checkEligibility(valid(), CONFIG);
    expect(r).toEqual({ eligible: true, reasons: [], warnings: [] });
  });

  it.each([
    [
      "missing vehicle insurance",
      (i: EligibilityInput) => {
        i.vehicle.documents = i.vehicle.documents.filter((d) => d.type !== "insurance");
      },
      "document_missing",
    ],
    [
      "expired driver licence",
      (i: EligibilityInput) => {
        i.driver.documents[0]!.expiresOn = "2026-11-09";
      },
      "document_expired",
    ],
    [
      "pending permit",
      (i: EligibilityInput) => {
        i.vehicle.documents.find((d) => d.type === "tourist_permit")!.status = "pending";
      },
      "document_pending",
    ],
    [
      "rejected police verification",
      (i: EligibilityInput) => {
        i.driver.documents.find((d) => d.type === "police_verification")!.status = "rejected";
      },
      "document_rejected",
    ],
    [
      "verified document with no expiry recorded",
      (i: EligibilityInput) => {
        i.vehicle.documents.find((d) => d.type === "puc_certificate")!.expiresOn = null;
      },
      "document_expiry_missing",
    ],
    [
      "vehicle older than the configured maximum",
      (i: EligibilityInput) => {
        i.vehicle.registrationYear = 2016;
      },
      "vehicle_too_old",
    ],
    [
      "unknown registration year",
      (i: EligibilityInput) => {
        i.vehicle.registrationYear = null;
      },
      "vehicle_registration_year_missing",
    ],
    [
      "inactive vendor",
      (i: EligibilityInput) => {
        i.vendor.active = false;
      },
      "owner_inactive",
    ],
    [
      "missing vendor agreement",
      (i: EligibilityInput) => {
        i.vendor.documents = i.vendor.documents.filter((d) => d.type !== "vendor_agreement");
      },
      "document_missing",
    ],
  ])("blocks: %s", (_name, mutate, code) => {
    const input = valid();
    mutate(input);
    const r = checkEligibility(input, CONFIG);
    expect(r.eligible).toBe(false);
    expect(codes(r)).toContain(code);
  });

  it("a document valid on its expiry day still counts (inclusive)", () => {
    const i = valid();
    i.driver.documents[0]!.expiresOn = TRIP;
    expect(checkEligibility(i, CONFIG).eligible).toBe(true);
  });

  it("blocks a multi-day trip when a document expires mid-trip", () => {
    const i = { ...valid(), tripEnd: "2026-11-12" };
    i.vehicle.documents.find((d) => d.type === "insurance")!.expiresOn = "2026-11-11";
    const r = checkEligibility(i, CONFIG);
    expect(r.eligible).toBe(false);
    expect(codes(r)).toContain("document_expires_during_trip");
  });

  it("warns but allows when a document expires within the warning window", () => {
    const i = valid();
    i.vehicle.documents.find((d) => d.type === "insurance")!.expiresOn = "2026-11-25";
    const r = checkEligibility(i, CONFIG);
    expect(r.eligible).toBe(true);
    expect(r.warnings).toEqual([
      expect.objectContaining({ documentType: "insurance", daysLeft: 15 }),
    ]);
  });

  it("vehicle age limit is configurable", () => {
    const i = valid();
    i.vehicle.registrationYear = 2016; // 10 years old in 2026
    expect(checkEligibility(i, { ...CONFIG, maxVehicleAgeYears: 10 }).eligible).toBe(true);
    expect(checkEligibility(i, { ...CONFIG, maxVehicleAgeYears: 9 }).eligible).toBe(false);
  });

  it("a newer pending upload does not hide a valid verified copy", () => {
    const i = valid();
    i.vehicle.documents.push({ type: "insurance", status: "pending", expiresOn: "2028-06-30" });
    expect(checkEligibility(i, CONFIG).eligible).toBe(true);
  });

  it("reports every problem, not just the first", () => {
    const i = valid();
    i.vehicle.documents = [];
    i.driver.documents = [];
    const r = checkEligibility(i, CONFIG);
    expect(r.reasons.length).toBe(REQUIREMENTS.vehicle.length + REQUIREMENTS.driver.length);
  });
});

describe("expiringDocuments", () => {
  it("lists verified documents expiring within the window", () => {
    const owner = {
      id: "d1",
      active: true,
      documents: [
        { type: "driving_licence", status: "verified", expiresOn: "2026-11-01" },
        { type: "psv_badge", status: "verified", expiresOn: "2027-11-01" },
        { type: "police_verification", status: "verified", expiresOn: "2026-10-01" },
      ] satisfies ComplianceDocument[],
    };
    const w = expiringDocuments("driver", owner, "2026-10-13", 30);
    expect(w.map((x) => [x.documentType, x.daysLeft])).toEqual([["driving_licence", 19]]);
  });
});
