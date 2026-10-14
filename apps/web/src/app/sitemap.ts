import type { MetadataRoute } from "next";
import { buildSitemap, type SitemapRecord } from "@cab/seo";
import { listPlaces, listRoutes } from "@/lib/content";
import { READY_LOCALES } from "@/lib/locales";
import { ALLOW_INDEXING, INDEX_THRESHOLD, SITE_URL } from "@/lib/settings";

export const revalidate = 3600;

/** Only records at/above the completeness threshold, and only fully translated locales. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!ALLOW_INDEXING) return [];
  const [places, routes] = await Promise.all([listPlaces(), listRoutes()]);
  const records: SitemapRecord[] = [
    { path: "", completenessScore: 1, lastModified: new Date("2026-10-14"), locales: READY_LOCALES },
    ...places.map((p) => ({ path: `places/${p.slug}`, completenessScore: p.completenessScore, lastModified: p.updatedAt, locales: READY_LOCALES })),
    ...routes.map(({ route }) => ({ path: `routes/${route.slug}`, completenessScore: route.completenessScore, lastModified: route.updatedAt, locales: READY_LOCALES })),
  ];
  return buildSitemap(records, { siteUrl: SITE_URL, threshold: INDEX_THRESHOLD });
}
