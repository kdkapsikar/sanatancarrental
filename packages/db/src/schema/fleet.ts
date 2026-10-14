import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { FareRule } from "@cab/fare-engine";
import type { LocalisedText } from "./types.js";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const vehicleClasses = pgTable("vehicle_classes", {
  code: text("code").primaryKey(),
  name: jsonb("name").$type<LocalisedText>().notNull(),
  seats: smallint("seats").notNull(),
  luggageBags: smallint("luggage_bags"),
  exampleModels: text("example_models").array().notNull().default(sql`'{}'::text[]`),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const tripType = pgEnum("trip_type", [
  "outstation_one_way",
  "outstation_round_trip",
  "local",
  "airport_transfer",
]);

/**
 * Versioned fare rules. `rule` holds the fare-engine FareRule body. Example rows (used for
 * development) can never be active, so a placeholder price cannot reach a customer.
 */
export const fareRules = pgTable(
  "fare_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleClassCode: text("vehicle_class_code")
      .notNull()
      .references(() => vehicleClasses.code),
    tripType: tripType("trip_type").notNull(),
    version: integer("version").notNull(),
    rule: jsonb("rule").$type<Omit<FareRule, "id" | "version" | "vehicleClass" | "tripType">>().notNull(),
    isActive: boolean("is_active").notNull().default(false),
    isExample: boolean("is_example").notNull().default(false),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    approvedBy: text("approved_by"),
    notes: text("notes"),
    createdAt,
  },
  (t) => [
    uniqueIndex("fare_rules_version_uq").on(t.vehicleClassCode, t.tripType, t.version),
    uniqueIndex("fare_rules_one_active_uq")
      .on(t.vehicleClassCode, t.tripType)
      .where(sql`${t.isActive}`),
    check("fare_rules_example_never_active", sql`not (${t.isExample} and ${t.isActive})`),
    check("fare_rules_active_needs_approval", sql`not ${t.isActive} or ${t.approvedBy} is not null`),
  ],
);

/** own_fleet / attached_partner are the launch models (B/C). aggregator_partner needs the flag. */
export const vendorKind = pgEnum("vendor_kind", ["own_fleet", "attached_partner", "aggregator_partner"]);

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: vendorKind("kind").notNull(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  gstin: text("gstin"),
  active: boolean("active").notNull().default(false),
  createdAt,
});

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    vehicleClassCode: text("vehicle_class_code")
      .notNull()
      .references(() => vehicleClasses.code),
    registrationNumber: text("registration_number").notNull(),
    makeModel: text("make_model").notNull(),
    registrationYear: smallint("registration_year"),
    fuel: text("fuel"),
    seats: smallint("seats"),
    active: boolean("active").notNull().default(false),
    createdAt,
  },
  (t) => [uniqueIndex("vehicles_registration_uq").on(t.registrationNumber)],
);

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  /** ISO 639-1 codes, e.g. {mr,hi,en}. */
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(false),
  createdAt,
});

export const documentOwnerKind = pgEnum("document_owner_kind", ["vendor", "vehicle", "driver"]);
export const documentType = pgEnum("document_type", [
  "registration_certificate",
  "tourist_permit",
  "insurance",
  "fitness_certificate",
  "puc_certificate",
  "driving_licence",
  "psv_badge",
  "police_verification",
  "vendor_kyc",
  "vendor_agreement",
]);
export const documentStatus = pgEnum("document_status", ["pending", "verified", "rejected"]);

/**
 * Compliance documents. Exactly one owner FK is set and it matches owner_kind. "Expired" is
 * derived from expires_on at check time rather than stored, so it can never be stale.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerKind: documentOwnerKind("owner_kind").notNull(),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id),
    driverId: uuid("driver_id").references(() => drivers.id),
    type: documentType("type").notNull(),
    documentNumber: text("document_number"),
    status: documentStatus("status").notNull().default("pending"),
    issuedOn: date("issued_on"),
    expiresOn: date("expires_on"),
    /** Object-storage key of the uploaded file; never a public URL. */
    fileKey: text("file_key"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt,
  },
  (t) => [
    check(
      "documents_single_owner",
      sql`(${t.ownerKind} = 'vendor' and ${t.vendorId} is not null and ${t.vehicleId} is null and ${t.driverId} is null)
       or (${t.ownerKind} = 'vehicle' and ${t.vehicleId} is not null and ${t.vendorId} is null and ${t.driverId} is null)
       or (${t.ownerKind} = 'driver' and ${t.driverId} is not null and ${t.vendorId} is null and ${t.vehicleId} is null)`,
    ),
    check(
      "documents_verified_has_reviewer",
      sql`${t.status} = 'pending' or ${t.reviewedBy} is not null`,
    ),
    index("documents_expiry_idx").on(t.expiresOn).where(sql`${t.status} = 'verified'`),
    index("documents_vehicle_idx").on(t.vehicleId),
    index("documents_driver_idx").on(t.driverId),
    index("documents_vendor_idx").on(t.vendorId),
  ],
);

export const guides = pgTable("guides", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  /** Credential type and legal requirement still to be confirmed with the tourism department. */
  credentialType: text("credential_type"),
  credentialNumber: text("credential_number"),
  credentialVerifiedBy: text("credential_verified_by"),
  credentialVerifiedAt: timestamp("credential_verified_at", { withTimezone: true }),
  credentialExpiresOn: date("credential_expires_on"),
  bio: jsonb("bio").$type<LocalisedText>(),
  active: boolean("active").notNull().default(false),
  createdAt,
});

export const guideServicePlaces = pgTable(
  "guide_service_places",
  {
    guideId: uuid("guide_id")
      .notNull()
      .references(() => guides.id, { onDelete: "cascade" }),
    placeId: uuid("place_id").notNull(),
  },
  (t) => [uniqueIndex("guide_service_places_uq").on(t.guideId, t.placeId)],
);
