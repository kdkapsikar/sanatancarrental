import { LOCALES, canonicalUrl, hreflangAlternates, type Locale } from "./urls.js";

export interface SitemapRecord {
  /** Path without locale, e.g. "routes/chhatrapati-sambhajinagar-to-ellora-caves". */
  path: string;
  completenessScore: number;
  lastModified: Date;
  /** Locales whose content is actually translated; defaults to all. */
  locales?: readonly Locale[];
}

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  alternates: { languages: Record<string, string> };
}

/** A page is indexable only when its data record clears the completeness threshold. */
export function shouldIndex(score: number, threshold: number): boolean {
  return score >= threshold;
}

/**
 * One entry per (record, locale) for records at or above the threshold. Shape matches Next's
 * MetadataRoute.Sitemap so app/sitemap.ts can return it directly.
 */
export function buildSitemap(
  records: readonly SitemapRecord[],
  opts: { siteUrl: string; threshold: number },
): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    if (!shouldIndex(r.completenessScore, opts.threshold)) continue;
    const locales = r.locales ?? LOCALES;
    const languages = hreflangAlternates(opts.siteUrl, r.path, locales);
    for (const l of locales) {
      const url = canonicalUrl(opts.siteUrl, l, r.path);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, lastModified: r.lastModified, alternates: { languages } });
    }
  }
  return out;
}
