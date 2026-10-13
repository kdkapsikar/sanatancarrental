/**
 * Compliance rules for vendors, vehicles and drivers. Pure functions over plain data so the same
 * checks run in dispatch, the admin review queue and the expiry-alert job.
 *
 * The document list reflects plan §4 (RC, permit, insurance, fitness, PUC, licence, badge, police
 * verification). It is an operational baseline, not legal advice; confirm the final list against
 * the Maharashtra Motor Vehicle Aggregator Rules 2026 and the client's lawyer.
 */

export type OwnerKind = "vendor" | "vehicle" | "driver";

export type DocumentType =
  // vehicle
  | "registration_certificate"
  | "tourist_permit"
  | "insurance"
  | "fitness_certificate"
  | "puc_certificate"
  // driver
  | "driving_licence"
  | "psv_badge"
  | "police_verification"
  // vendor
  | "vendor_kyc"
  | "vendor_agreement";

export type DocumentStatus = "pending" | "verified" | "rejected";

export interface ComplianceDocument {
  type: DocumentType;
  status: DocumentStatus;
  /** ISO date (YYYY-MM-DD), inclusive last valid day. null = document has no expiry. */
  expiresOn: string | null;
}

export interface Requirement {
  type: DocumentType;
  /** Does the document carry an expiry date that must be tracked? */
  expires: boolean;
}

export const REQUIREMENTS: Record<OwnerKind, Requirement[]> = {
  vehicle: [
    { type: "registration_certificate", expires: true },
    { type: "tourist_permit", expires: true },
    { type: "insurance", expires: true },
    { type: "fitness_certificate", expires: true },
    { type: "puc_certificate", expires: true },
  ],
  driver: [
    { type: "driving_licence", expires: true },
    { type: "psv_badge", expires: true },
    { type: "police_verification", expires: true },
  ],
  vendor: [
    { type: "vendor_kyc", expires: false },
    { type: "vendor_agreement", expires: true },
  ],
};

export type ReasonCode =
  | "document_missing"
  | "document_pending"
  | "document_rejected"
  | "document_expired"
  | "document_expires_during_trip"
  | "document_expiry_missing"
  | "vehicle_too_old"
  | "vehicle_registration_year_missing"
  | "owner_inactive";

export interface Reason {
  owner: OwnerKind;
  ownerId: string;
  code: ReasonCode;
  documentType?: DocumentType;
  detail?: string;
}

export interface Warning {
  owner: OwnerKind;
  ownerId: string;
  documentType: DocumentType;
  expiresOn: string;
  daysLeft: number;
}

export interface ComplianceConfig {
  /** Maximum vehicle age in years (draft rules said 9 [verify against final rules]). */
  maxVehicleAgeYears: number;
  /** Days before expiry to start warning the vendor. */
  expiryWarningDays: number;
}

export interface Owner {
  id: string;
  active: boolean;
  documents: ComplianceDocument[];
}
export interface VehicleOwner extends Owner {
  /** Year of first registration, from the RC. */
  registrationYear: number | null;
}

const DAY_MS = 86_400_000;
const toDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new RangeError(`invalid date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
};

/**
 * Check one owner's documents for a trip running from `tripStart` to `tripEnd` (ISO dates).
 * A document must be verified and valid through the last day of the trip.
 */
export function checkDocuments(
  kind: OwnerKind,
  owner: Owner,
  tripStart: string,
  tripEnd: string = tripStart,
  config: Pick<ComplianceConfig, "expiryWarningDays"> = { expiryWarningDays: 30 },
): { reasons: Reason[]; warnings: Warning[] } {
  const reasons: Reason[] = [];
  const warnings: Warning[] = [];
  const start = toDay(tripStart);
  const end = toDay(tripEnd);
  if (!owner.active) reasons.push({ owner: kind, ownerId: owner.id, code: "owner_inactive" });

  for (const req of REQUIREMENTS[kind]) {
    // Prefer a verified copy; a newer pending upload must not hide a valid verified one.
    const docs = owner.documents.filter((d) => d.type === req.type);
    const doc =
      docs
        .filter((d) => d.status === "verified")
        .sort((a, b) => (b.expiresOn ?? "9999").localeCompare(a.expiresOn ?? "9999"))[0] ??
      docs.find((d) => d.status === "pending") ??
      docs[0];
    const base = { owner: kind, ownerId: owner.id, documentType: req.type };
    if (!doc) {
      reasons.push({ ...base, code: "document_missing" });
      continue;
    }
    if (doc.status === "rejected") {
      reasons.push({ ...base, code: "document_rejected" });
      continue;
    }
    if (doc.status === "pending") {
      reasons.push({ ...base, code: "document_pending" });
      continue;
    }
    if (!req.expires) continue;
    if (!doc.expiresOn) {
      reasons.push({ ...base, code: "document_expiry_missing" });
      continue;
    }
    const exp = toDay(doc.expiresOn);
    if (exp < start) {
      reasons.push({ ...base, code: "document_expired", detail: doc.expiresOn });
    } else if (exp < end) {
      reasons.push({ ...base, code: "document_expires_during_trip", detail: doc.expiresOn });
    } else if (exp - start <= config.expiryWarningDays) {
      warnings.push({ ...base, expiresOn: doc.expiresOn, daysLeft: exp - start });
    }
  }
  return { reasons, warnings };
}

export function checkVehicleAge(
  vehicle: VehicleOwner,
  onDate: string,
  maxVehicleAgeYears: number,
): Reason[] {
  if (vehicle.registrationYear == null) {
    return [{ owner: "vehicle", ownerId: vehicle.id, code: "vehicle_registration_year_missing" }];
  }
  const year = Number(onDate.slice(0, 4));
  const age = year - vehicle.registrationYear;
  return age > maxVehicleAgeYears
    ? [
        {
          owner: "vehicle",
          ownerId: vehicle.id,
          code: "vehicle_too_old",
          detail: `${age} years (max ${maxVehicleAgeYears})`,
        },
      ]
    : [];
}

export interface EligibilityInput {
  vendor: Owner;
  vehicle: VehicleOwner;
  driver: Owner;
  tripStart: string;
  tripEnd?: string;
}

export interface Eligibility {
  eligible: boolean;
  reasons: Reason[];
  warnings: Warning[];
}

/**
 * The single gate for assignment. Dispatch must call this and refuse to assign when
 * `eligible` is false. There is no override parameter by design.
 */
export function checkEligibility(input: EligibilityInput, config: ComplianceConfig): Eligibility {
  const end = input.tripEnd ?? input.tripStart;
  const parts = [
    checkDocuments("vendor", input.vendor, input.tripStart, end, config),
    checkDocuments("vehicle", input.vehicle, input.tripStart, end, config),
    checkDocuments("driver", input.driver, input.tripStart, end, config),
  ];
  const reasons = [
    ...parts.flatMap((p) => p.reasons),
    ...checkVehicleAge(input.vehicle, input.tripStart, config.maxVehicleAgeYears),
  ];
  return { eligible: reasons.length === 0, reasons, warnings: parts.flatMap((p) => p.warnings) };
}

/** Documents expiring within `withinDays` of `today` (for the alert job). */
export function expiringDocuments(
  kind: OwnerKind,
  owner: Owner,
  today: string,
  withinDays: number,
): Warning[] {
  const t = toDay(today);
  return owner.documents
    .filter((d) => d.status === "verified" && d.expiresOn)
    .map((d) => ({ d, left: toDay(d.expiresOn!) - t }))
    .filter(({ left }) => left >= 0 && left <= withinDays)
    .map(({ d, left }) => ({
      owner: kind,
      ownerId: owner.id,
      documentType: d.type,
      expiresOn: d.expiresOn!,
      daysLeft: left,
    }));
}
