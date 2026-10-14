import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { geographyPoint, type LocalisedText, type NeedsVerification } from "./types.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Every publishable content record carries these. `completenessScore` is computed by
 * `computeCompleteness()` (never hand-entered) and gates indexing and the sitemap.
 */
const provenance = {
  completenessScore: numeric("completeness_score", { precision: 4, scale: 3, mode: "number" })
    .notNull()
    .default(0),
  verifiedSource: text("verified_source"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  needsVerification: jsonb("needs_verification").$type<NeedsVerification>().notNull().default({}),
};

export const placeKind = pgEnum("place_kind", [
  "city",
  "town",
  "airport",
  "cave_site",
  "temple",
  "fort",
  "monument",
  "nature",
]);

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    kind: placeKind("kind").notNull(),
    name: jsonb("name").$type<LocalisedText>().notNull(),
    /** Alternate names and spellings used for search and alias redirects. */
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    location: geographyPoint("location"),
    district: text("district"),
    stateCode: text("state_code").notNull().default("MH"),
    /** Weekly closing day(s). null = unknown (not "open every day"). */
    closedDays: jsonb("closed_days").$type<Weekday[]>(),
    openingHours: jsonb("opening_hours").$type<{ open: string; close: string }>(),
    /** Entry fees as published by the authority, in paise, keyed by visitor category. */
    entryFeesPaise: jsonb("entry_fees_paise").$type<Record<string, number>>(),
    officialTicketUrl: text("official_ticket_url"),
    unescoSite: boolean("unesco_site"),
    description: jsonb("description").$type<LocalisedText>(),
    ...provenance,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("places_slug_uq").on(t.slug),
    index("places_location_gix").using("gist", t.location),
    check("places_score_range", sql`${t.completenessScore} between 0 and 1`),
  ],
);

export const routes = pgTable(
  "routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    originPlaceId: uuid("origin_place_id")
      .notNull()
      .references(() => places.id),
    destinationPlaceId: uuid("destination_place_id")
      .notNull()
      .references(() => places.id),
    distanceKm: numeric("distance_km", { precision: 7, scale: 1, mode: "number" }),
    driveMinutes: integer("drive_minutes"),
    tollEstimatePaise: integer("toll_estimate_paise"),
    statesEntered: text("states_entered").array(),
    /** Suggested stops: place ids in order. */
    stopPlaceIds: uuid("stop_place_ids").array(),
    bestSeason: jsonb("best_season").$type<LocalisedText>(),
    notes: jsonb("notes").$type<LocalisedText>(),
    ...provenance,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("routes_slug_uq").on(t.slug),
    uniqueIndex("routes_pair_uq").on(t.originPlaceId, t.destinationPlaceId),
    check("routes_distinct_ends", sql`${t.originPlaceId} <> ${t.destinationPlaceId}`),
    check("routes_distance_positive", sql`${t.distanceKm} is null or ${t.distanceKm} > 0`),
    check("routes_score_range", sql`${t.completenessScore} between 0 and 1`),
  ],
);

export const tourPackages = pgTable(
  "packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<LocalisedText>().notNull(),
    summary: jsonb("summary").$type<LocalisedText>(),
    days: smallint("days").notNull(),
    originPlaceId: uuid("origin_place_id").references(() => places.id),
    inclusions: jsonb("inclusions").$type<LocalisedText[]>(),
    exclusions: jsonb("exclusions").$type<LocalisedText[]>(),
    guideAvailable: boolean("guide_available").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(false),
    ...provenance,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("packages_slug_uq").on(t.slug),
    check("packages_days_positive", sql`${t.days} > 0`),
  ],
);

/** A day-by-day plan: either a package template or a customer's custom itinerary. */
export const itineraries = pgTable("itineraries", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id").references(() => tourPackages.id),
  title: jsonb("title").$type<LocalisedText>(),
  ...timestamps,
});

export const itineraryStops = pgTable(
  "itinerary_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itineraryId: uuid("itinerary_id")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    day: smallint("day").notNull(),
    seq: smallint("seq").notNull(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id),
    plannedMinutes: integer("planned_minutes"),
    note: jsonb("note").$type<LocalisedText>(),
  },
  (t) => [
    uniqueIndex("itinerary_stops_order_uq").on(t.itineraryId, t.day, t.seq),
    check("itinerary_stops_day_positive", sql`${t.day} > 0`),
  ],
);
