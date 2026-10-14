import { defineRouting } from "next-intl/routing";
import { LOCALES, DEFAULT_LOCALE } from "@cab/seo";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  // We emit hreflang ourselves via generateMetadata so the set matches translated content.
  alternateLinks: false,
});
