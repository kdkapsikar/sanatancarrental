export const LOCALES = ["en", "hi", "mr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Canonical URL token for the city. "Aurangabad" and bare "Sambhajinagar" redirect to it. */
export const CITY_CANONICAL = "chhatrapati-sambhajinagar";

/**
 * Rewrite city-name aliases in a slug to the canonical token, segment by segment.
 * "aurangabad-to-ellora-caves" → "chhatrapati-sambhajinagar-to-ellora-caves".
 * Returns `changed` so middleware can issue a 301.
 */
export function canonicalizeSlug(slug: string): { slug: string; changed: boolean } {
  const lower = slug.toLowerCase();
  const out = lower
    .replace(/(^|-)aurangabad(?=-|$)/g, `$1${CITY_CANONICAL}`)
    .replace(/(^|-)(?<!chhatrapati-)sambhajinagar(?=-|$)/g, `$1${CITY_CANONICAL}`);
  return { slug: out, changed: out !== slug };
}

/** Canonicalise every segment of a path (without locale). */
export function canonicalizePath(path: string): { path: string; changed: boolean } {
  let changed = false;
  const segments = path.split("/").map((s) => {
    if (!s) return s;
    const r = canonicalizeSlug(s);
    changed ||= r.changed;
    return r.slug;
  });
  return { path: segments.join("/"), changed };
}

function joinUrl(siteUrl: string, locale: Locale, path: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return p ? `${base}/${locale}/${p}` : `${base}/${locale}`;
}

export function canonicalUrl(siteUrl: string, locale: Locale, path: string): string {
  return joinUrl(siteUrl, locale, canonicalizePath(path).path);
}

/** hreflang alternates for a path that exists in all locales, plus x-default → en. */
export function hreflangAlternates(
  siteUrl: string,
  path: string,
  locales: readonly Locale[] = LOCALES,
): Record<string, string> {
  const canon = canonicalizePath(path).path;
  const out: Record<string, string> = {};
  for (const l of locales) out[l] = joinUrl(siteUrl, l, canon);
  out["x-default"] = joinUrl(siteUrl, locales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : locales[0]!, canon);
  return out;
}
