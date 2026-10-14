import type { Metadata } from "next";
import { BRAND } from "@cab/config";
import { canonicalUrl, hreflangAlternates, shouldIndex, type Locale } from "@cab/seo";
import { INDEX_THRESHOLD, SITE_URL } from "./settings";
import { READY_LOCALES, isReadyLocale } from "./locales";

/**
 * Canonical + hreflang + robots for a page. A page is indexable only if its data record clears
 * the completeness threshold AND its locale is fully translated.
 */
export function pageMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  completenessScore?: number;
}): Metadata {
  const dataOk = opts.completenessScore === undefined || shouldIndex(opts.completenessScore, INDEX_THRESHOLD);
  const indexable = dataOk && isReadyLocale(opts.locale);
  const languages = indexable ? hreflangAlternates(SITE_URL, opts.path, READY_LOCALES) : undefined;
  // Brand in Devanagari everywhere; English pages also carry the Latin name for search.
  const brand = opts.locale === "en" ? `${BRAND.name} (${BRAND.latin})` : BRAND.name;
  return {
    title: { absolute: `${opts.title} · ${brand}` },
    applicationName: BRAND.name,
    description: opts.description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonicalUrl(SITE_URL, opts.locale, opts.path),
      ...(languages ? { languages } : {}),
    },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}
