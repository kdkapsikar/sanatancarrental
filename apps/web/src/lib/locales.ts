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
 * Locales that search engines may index (and that appear in hreflang / the sitemap): fully
 * translated AND signed off in INDEXABLE_LOCALES (comma list, default "en"). Hindi and Marathi
 * render for everyone but stay noindex until a native speaker has reviewed them.
 */
const SIGNED_OFF = (process.env["INDEXABLE_LOCALES"] ?? "en").split(",").map((s) => s.trim());
export const READY_LOCALES: readonly Locale[] = LOCALES.filter(
  (l) => !hasPlaceholder(MESSAGES[l]) && SIGNED_OFF.includes(l),
);

export const isReadyLocale = (l: Locale) => READY_LOCALES.includes(l);
