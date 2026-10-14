import { LOCALES, type Locale } from "@cab/seo";
import en from "../../messages/en.json" with { type: "json" };
import hi from "../../messages/hi.json" with { type: "json" };
import mr from "../../messages/mr.json" with { type: "json" };

export const MESSAGES: Record<Locale, unknown> = { en, hi, mr };

function hasPlaceholder(v: unknown): boolean {
  if (typeof v === "string") return v.startsWith("TODO_TRANSLATE");
  if (v && typeof v === "object") return Object.values(v).some(hasPlaceholder);
  return false;
}

/**
 * Locales whose UI strings are fully translated. Only these are indexable and listed in
 * hreflang / the sitemap; placeholder locales still render (for review) but are noindex.
 */
export const READY_LOCALES: readonly Locale[] = LOCALES.filter((l) => !hasPlaceholder(MESSAGES[l]));

export const isReadyLocale = (l: Locale) => READY_LOCALES.includes(l);
