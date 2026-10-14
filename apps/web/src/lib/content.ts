import "server-only";
import { asc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { places, routes, type LocalisedText } from "@cab/db";
import type { Locale } from "@cab/seo";
import { db } from "./db";
import { withBase } from "./base";

/** Localised text with English fallback. Placeholder strings fall back to English too. */
export function pick(t: LocalisedText | null | undefined, locale: Locale): string | null {
  if (!t) return null;
  const v = t[locale];
  return v && !v.startsWith("TODO_TRANSLATE") ? v : t.en;
}

export async function listPlaces() {
  return db.select().from(places).orderBy(asc(places.slug));
}

export async function getPlace(slug: string) {
  const [p] = await db.select().from(places).where(eq(places.slug, slug)).limit(1);
  return p ?? null;
}

const origin = alias(places, "origin");
const destination = alias(places, "destination");

function routeQuery() {
  return db
    .select({ route: routes, origin, destination })
    .from(routes)
    .innerJoin(origin, eq(routes.originPlaceId, origin.id))
    .innerJoin(destination, eq(routes.destinationPlaceId, destination.id));
}

export async function listRoutes() {
  return routeQuery().orderBy(asc(routes.slug));
}

export async function getRoute(slug: string) {
  const [r] = await routeQuery().where(eq(routes.slug, slug)).limit(1);
  return r ?? null;
}

export async function routesTouching(placeId: string) {
  return routeQuery().where(or(eq(routes.originPlaceId, placeId), eq(routes.destinationPlaceId, placeId)));
}

/** Places with coordinates, localised, for the region map. */
export function toMapPlaces(rows: Array<typeof places.$inferSelect>, locale: Locale) {
  return rows
    .filter((p) => p.location)
    .map((p) => ({
      slug: p.slug,
      kind: p.kind,
      name: pick(p.name, locale)!,
      lng: p.location!.lng,
      lat: p.location!.lat,
      href: withBase(`/${locale}/places/${p.slug}`),
    }));
}

/** Filter group for a place kind (home page chips). */
export function kindGroup(kind: string): "caves" | "temples" | "heritage" | "cities" | "nature" {
  if (kind === "cave_site") return "caves";
  if (kind === "temple") return "temples";
  if (kind === "fort" || kind === "monument") return "heritage";
  if (kind === "nature") return "nature";
  return "cities";
}

/** Places for the trip finder: every name and alias; links to the route from the city when one exists. */
export function toFinderPlaces(
  rows: Array<typeof places.$inferSelect>,
  routeRows: Awaited<ReturnType<typeof listRoutes>>,
  locale: Locale,
) {
  return rows
    .filter((p) => p.slug !== "chhatrapati-sambhajinagar")
    .map((p) => {
      const route = routeRows.find((r) => r.origin.slug === "chhatrapati-sambhajinagar" && r.destination.slug === p.slug);
      return {
        slug: p.slug,
        kind: p.kind,
        label: pick(p.name, locale)!,
        alt: locale === "en" ? (p.name.mr ?? null) : p.name.en,
        terms: [p.slug, p.name.en, p.name.hi, p.name.mr, ...p.aliases].filter((x): x is string => !!x),
        href: route ? `/${locale}/routes/${route.route.slug}` : `/${locale}/places/${p.slug}`,
      };
    });
}
