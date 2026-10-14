// Idempotent seed: vehicle classes, 16 places, 20 routes, and EXAMPLE (inactive) fare rules.
import { sql } from "drizzle-orm";
import { createDb } from "../client.js";
import { placeCompleteness, routeCompleteness } from "../completeness.js";
import { fareRules, places, routes, vehicleClasses } from "../schema/index.js";
import {
  PLACE_SEEDS,
  ROUTE_SEEDS,
  SOURCE_FETCHED_AT,
  VEHICLE_CLASSES,
  WIKI,
  routeGaps,
} from "./data.js";
import { EXAMPLE_FARE_RULES } from "./example-fare-rules.js";

const { db, client } = createDb(process.argv[2]);

try {
  await db.transaction(async (tx) => {
    for (const vc of VEHICLE_CLASSES) {
      await tx
        .insert(vehicleClasses)
        .values(vc)
        .onConflictDoUpdate({ target: vehicleClasses.code, set: vc });
    }

    const placeIds = new Map<string, string>();
    for (const seed of PLACE_SEEDS) {
      const w = WIKI.find((x) => x.slug === seed.slug);
      if (!w) throw new Error(`no source record for ${seed.slug}`);
      const row = {
        slug: seed.slug,
        kind: w.kind as (typeof places.$inferInsert)["kind"],
        name: {
          en: seed.nameEn ?? w.wikipediaTitle,
          ...(seed.nameHi ?? w.hi ? { hi: seed.nameHi ?? w.hi! } : {}),
          ...(w.mr ? { mr: w.mr } : {}),
        },
        aliases: seed.aliases,
        location: w.lat !== null && w.lng !== null ? { lat: w.lat, lng: w.lng } : null,
        district: seed.district ?? null,
        unescoSite: seed.unescoSite ?? null,
        closedDays: null,
        openingHours: null,
        entryFeesPaise: null,
        officialTicketUrl: null,
        description: null,
        verifiedSource: w.source,
        verifiedAt: new Date(SOURCE_FETCHED_AT),
        needsVerification: seed.needsVerification,
      };
      const { score } = placeCompleteness(row);
      const [res] = await tx
        .insert(places)
        .values({ ...row, completenessScore: score })
        .onConflictDoUpdate({
          target: places.slug,
          set: { ...row, completenessScore: score, updatedAt: sql`now()` },
        })
        .returning({ id: places.id });
      placeIds.set(seed.slug, res!.id);
    }

    for (const r of ROUTE_SEEDS) {
      const row = {
        slug: `${r.origin}-to-${r.destination}`,
        originPlaceId: placeIds.get(r.origin)!,
        destinationPlaceId: placeIds.get(r.destination)!,
        distanceKm: null,
        driveMinutes: null,
        tollEstimatePaise: null,
        statesEntered: r.statesEntered ?? [],
        stopPlaceIds: null,
        bestSeason: null,
        notes: null,
        verifiedSource: null,
        verifiedAt: null,
        needsVerification: routeGaps(r.extraGaps),
      };
      const { score } = routeCompleteness(row);
      await tx
        .insert(routes)
        .values({ ...row, completenessScore: score })
        .onConflictDoUpdate({
          target: routes.slug,
          set: { ...row, completenessScore: score, updatedAt: sql`now()` },
        });
    }

    for (const fr of EXAMPLE_FARE_RULES) {
      await tx
        .insert(fareRules)
        .values(fr)
        .onConflictDoNothing({
          target: [fareRules.vehicleClassCode, fareRules.tripType, fareRules.version],
        });
    }
  });

  const [counts] = await db.execute<{ places: number; routes: number; rules: number; active: number }>(sql`
    select (select count(*) from places)::int places, (select count(*) from routes)::int routes,
           (select count(*) from fare_rules)::int rules,
           (select count(*) from fare_rules where is_active)::int active`);
  console.log("seeded", counts);
} finally {
  await client.end();
}
