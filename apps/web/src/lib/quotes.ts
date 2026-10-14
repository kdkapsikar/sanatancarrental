import "server-only";
import { and, eq } from "drizzle-orm";
import { fareRules, type routes } from "@cab/db";
import { quote, type FareRule, type Quote } from "@cab/fare-engine";
import { db } from "./db";

type RouteRow = typeof routes.$inferSelect;

/**
 * An indicative one-way sedan quote for a route page. Returns null (the page shows "fares
 * being finalised") unless the route has a verified distance AND an approved, active rule
 * exists. Example rules are never active, so placeholder prices cannot appear.
 */
export async function sampleQuoteForRoute(route: RouteRow): Promise<Quote | null> {
  if (route.distanceKm === null || "distanceKm" in route.needsVerification) return null;
  const [row] = await db
    .select()
    .from(fareRules)
    .where(and(eq(fareRules.vehicleClassCode, "sedan"), eq(fareRules.tripType, "outstation_one_way"), eq(fareRules.isActive, true)))
    .limit(1);
  if (!row) return null;
  const rule = { ...row.rule, id: row.id, version: row.version, vehicleClass: row.vehicleClassCode, tripType: row.tripType } as FareRule;
  return quote(
    {
      tripType: "outstation_one_way",
      vehicleClass: "sedan",
      // Indicative quote for a morning departure; the booking flow quotes the real date.
      start: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) + "T08:00:00+05:30",
      routeKm: route.distanceKm,
      statesEntered: route.statesEntered ?? [],
      ...(rule.toll === "included" && route.tollEstimatePaise !== null ? { tollEstimatePaise: route.tollEstimatePaise } : {}),
    },
    rule,
  );
}
