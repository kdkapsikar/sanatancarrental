import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import type { Quote } from "@cab/fare-engine";
import type { Eligibility } from "@cab/compliance";
import { places, routes, tourPackages, itineraries } from "./content";
import { drivers, fareRules, guides, tripType, vehicleClasses, vehicles, vendors } from "./fleet";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const locale = pgEnum("locale", ["en", "hi", "mr"]);
export const channel = pgEnum("channel", ["web", "whatsapp", "phone", "admin"]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** E.164, e.g. +919800000000. */
    phone: text("phone").notNull(),
    fullName: text("full_name"),
    email: text("email"),
    preferredLocale: locale("preferred_locale").notNull().default("en"),
    createdAt,
  },
  (t) => [uniqueIndex("customers_phone_uq").on(t.phone)],
);

export const bookingStatus = pgEnum("booking_status", [
  "quoted",
  "pending_payment",
  "confirmed",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
]);

/**
 * A booking stores the exact quote it was sold at (`quote` + `quoteFingerprint`). The invoice
 * must reproduce this fingerprint; any change to the trip creates a new quote.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    status: bookingStatus("status").notNull().default("quoted"),
    channel: channel("channel").notNull(),
    locale: locale("locale").notNull(),
    tripType: tripType("trip_type").notNull(),
    vehicleClassCode: text("vehicle_class_code")
      .notNull()
      .references(() => vehicleClasses.code),
    originPlaceId: uuid("origin_place_id").references(() => places.id),
    destinationPlaceId: uuid("destination_place_id").references(() => places.id),
    pickupText: text("pickup_text").notNull(),
    dropText: text("drop_text"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    passengers: smallint("passengers").notNull(),
    luggageBags: smallint("luggage_bags"),
    routeId: uuid("route_id").references(() => routes.id),
    packageId: uuid("package_id").references(() => tourPackages.id),
    itineraryId: uuid("itinerary_id").references(() => itineraries.id),
    guideId: uuid("guide_id").references(() => guides.id),
    fareRuleId: uuid("fare_rule_id")
      .notNull()
      .references(() => fareRules.id),
    quote: jsonb("quote").$type<Quote>().notNull(),
    quoteFingerprint: text("quote_fingerprint").notNull(),
    quotedTotalPaise: integer("quoted_total_paise").notNull(),
    cancelledReason: text("cancelled_reason"),
    createdAt,
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("bookings_reference_uq").on(t.reference),
    index("bookings_start_idx").on(t.startAt),
    check("bookings_passengers_positive", sql`${t.passengers} > 0`),
    check("bookings_end_after_start", sql`${t.endAt} is null or ${t.endAt} >= ${t.startAt}`),
    check("bookings_total_nonneg", sql`${t.quotedTotalPaise} >= 0`),
    check(
      "bookings_completed_has_time",
      sql`${t.status} <> 'completed' or ${t.completedAt} is not null`,
    ),
  ],
);

export const assignmentStatus = pgEnum("assignment_status", [
  "offered",
  "accepted",
  "rejected",
  "cancelled",
  "completed",
]);

/** Each assignment keeps the eligibility result it was made under, for audit. */
export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id),
    driverId: uuid("driver_id")
      .notNull()
      .references(() => drivers.id),
    status: assignmentStatus("status").notNull().default("offered"),
    eligibility: jsonb("eligibility").$type<Eligibility>().notNull(),
    offeredAt: timestamp("offered_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("assignments_one_live_per_booking_uq")
      .on(t.bookingId)
      .where(sql`${t.status} in ('offered','accepted')`),
    check("assignments_only_if_eligible", sql`(${t.eligibility}->>'eligible')::boolean`),
  ],
);

export const paymentKind = pgEnum("payment_kind", ["advance", "balance", "refund"]);
export const paymentStatus = pgEnum("payment_status", ["created", "authorized", "captured", "failed", "refunded"]);

/** Payments are out of scope this session; table exists so bookings and ledger can reference it. */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    kind: paymentKind("kind").notNull(),
    status: paymentStatus("status").notNull().default("created"),
    amountPaise: integer("amount_paise").notNull(),
    liveMode: boolean("live_mode").notNull().default(false),
    createdAt,
  },
  (t) => [
    check("payments_amount_positive", sql`${t.amountPaise} > 0`),
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.providerRef),
  ],
);

export const ledgerDirection = pgEnum("ledger_direction", ["debit", "credit"]);

/**
 * Double-entry ledger. Entries sharing `txnId` must balance (debits = credits); enforced by a
 * deferred constraint trigger in migration 0001.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    txnId: uuid("txn_id").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    account: text("account").notNull(),
    direction: ledgerDirection("direction").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    memo: text("memo"),
    createdAt,
  },
  (t) => [
    index("ledger_txn_idx").on(t.txnId),
    check("ledger_amount_positive", sql`${t.amountPaise} > 0`),
  ],
);

export const reviewStatus = pgEnum("review_status", ["pending_moderation", "published", "hidden"]);

/**
 * Reviews exist only for a real, completed booking (one per booking; trigger in migration 0001).
 * AggregateRating markup is built only from `published` rows.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    rating: smallint("rating").notNull(),
    body: text("body"),
    locale: locale("locale").notNull(),
    status: reviewStatus("status").notNull().default("pending_moderation"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [
    uniqueIndex("reviews_booking_uq").on(t.bookingId),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
  ],
);

export const conversationChannel = pgEnum("conversation_channel", ["whatsapp", "web_chat"]);

export const conversations = pgTable(
  "conversations",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: conversationChannel("channel").notNull(),
  externalThreadId: text("external_thread_id"),
  customerId: uuid("customer_id").references(() => customers.id),
  bookingId: uuid("booking_id").references(() => bookings.id),
  locale: locale("locale"),
  handedOffToHuman: boolean("handed_off_to_human").notNull().default(false),
  /** Short summary for the operations team when handed off. */
  handoffNote: text("handoff_note"),
  createdAt,
  },
  (t) => [uniqueIndex("conversations_thread_uq").on(t.channel, t.externalThreadId)],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // customer | bot | agent | system
    body: text("body").notNull(),
    toolCalls: jsonb("tool_calls"),
    createdAt,
  },
  (t) => [index("conversation_messages_conv_idx").on(t.conversationId, t.createdAt)],
);

export const consentPurpose = pgEnum("consent_purpose", [
  "data_processing",
  "whatsapp_utility",
  "whatsapp_marketing",
  "location_sharing",
  "review_request",
]);

/** Append-only consent record (DPDP Act readiness [check current rules]). */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").references(() => customers.id),
    phone: text("phone").notNull(),
    purpose: consentPurpose("purpose").notNull(),
    granted: boolean("granted").notNull(),
    source: text("source").notNull(), // web_form | whatsapp_optin | phone | admin
    policyVersion: text("policy_version").notNull(),
    evidence: jsonb("evidence"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consents_phone_purpose_idx").on(t.phone, t.purpose, t.recordedAt)],
);

export const proposalKind = pgEnum("proposal_kind", ["request_callback"]);
export const proposalStatus = pgEnum("proposal_status", ["pending", "confirmed", "cancelled"]);

/**
 * Write actions the assistant proposes. Nothing is stored about the person until they press
 * Confirm (web card or WhatsApp button); the confirm handler re-validates `payload`.
 */
export const assistantProposals = pgTable(
  "assistant_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: proposalKind("kind").notNull(),
    channel: conversationChannel("channel").notNull(),
    payload: jsonb("payload").notNull(),
    status: proposalStatus("status").notNull().default("pending"),
    /** WhatsApp: the sender's wa_id, so only they can confirm. Null for web. */
    ownerRef: text("owner_ref"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("assistant_proposals_status_idx").on(t.status, t.expiresAt)],
);

/** WhatsApp message ids already handled (webhooks are retried; replies must not repeat). */
export const whatsappInbound = pgTable("whatsapp_inbound", {
  messageId: text("message_id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});
