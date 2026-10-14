import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const en = (await import("../../messages/en.json")).default;
  return {
    locale,
    timeZone: "Asia/Kolkata",
    // Untranslated strings stay marked TODO_TRANSLATE in the files (and keep the locale noindex),
    // but visitors see the English text rather than the marker.
    messages: locale === "en" ? messages : withEnglishFallback(messages, en),
  };
});

type Tree = { [k: string]: string | Tree };
function withEnglishFallback(msgs: Tree, en: Tree): Tree {
  return Object.fromEntries(
    Object.entries(msgs).map(([k, v]) => {
      const e = en[k];
      if (typeof v === "string") return [k, v.startsWith("TODO_TRANSLATE") && typeof e === "string" ? e : v];
      return [k, withEnglishFallback(v, (e as Tree) ?? {})];
    }),
  );
}
