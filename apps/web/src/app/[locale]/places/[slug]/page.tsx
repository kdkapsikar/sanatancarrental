import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { breadcrumbList, canonicalUrl, type Locale } from "@cab/seo";
import type { Weekday } from "@cab/db";
import { Link } from "@/i18n/navigation";
import { getPlace, pick, routesTouching } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/settings";
import { JsonLd } from "@/components/JsonLd";
import { inr } from "@/lib/format";

export const revalidate = 3600;

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  const place = await getPlace(slug);
  if (!place) return {};
  const t = await getTranslations({ locale, namespace: "place" });
  const name = pick(place.name, locale)!;
  return pageMetadata({
    locale,
    path: `places/${slug}`,
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name }),
    completenessScore: place.completenessScore,
  });
}

export default async function PlacePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const place = await getPlace(slug);
  if (!place) notFound();
  const t = await getTranslations("place");
  const tw = await getTranslations("weekday");
  const tn = await getTranslations("site.nav");
  const name = pick(place.name, locale)!;
  const related = await routesTouching(place.id);
  const unverified = Object.keys(place.needsVerification);
  const notVerified = <span className="text-zinc-500">{t("notVerified")}</span>;
  // Show a value only if present and not flagged as unverified.
  const shown = (field: string) => !unverified.includes(field);

  return (
    <article>
      <JsonLd
        data={breadcrumbList([
          { name: tn("home"), url: canonicalUrl(SITE_URL, locale, "") },
          { name, url: canonicalUrl(SITE_URL, locale, `places/${slug}`) },
        ])}
      />
      <p className="text-sm text-zinc-500">{t(`kind.${place.kind}`)}</p>
      <h1 className="text-2xl font-bold">{name}</h1>
      {place.unescoSite && <p className="mt-1 text-sm">{t("unesco")}</p>}
      {pick(place.description, locale) && shown("description") && (
        <p className="mt-4">{pick(place.description, locale)}</p>
      )}

      {["cave_site", "temple", "fort", "monument", "nature"].includes(place.kind) && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t("facts")}</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt>{t("closedDays")}</dt>
            <dd>
              {place.closedDays && shown("closedDays")
                ? place.closedDays.map((d: Weekday) => tw(d)).join(", ")
                : notVerified}
            </dd>
            <dt>{t("openingHours")}</dt>
            <dd>
              {place.openingHours && shown("openingHours")
                ? `${place.openingHours.open}–${place.openingHours.close}`
                : notVerified}
            </dd>
            <dt>{t("entryFees")}</dt>
            <dd>
              {place.entryFeesPaise && shown("entryFeesPaise")
                ? Object.entries(place.entryFeesPaise).map(([k, v]) => `${k}: ${inr(v, locale)}`).join(" · ")
                : notVerified}
            </dd>
          </dl>
          {place.officialTicketUrl && (
            <a href={place.officialTicketUrl} rel="noopener" className="mt-2 inline-block underline">
              {t("officialTickets")}
            </a>
          )}
        </section>
      )}

      {unverified.length > 0 && (
        <p className="mt-6 rounded bg-amber-50 p-3 text-sm text-amber-900">{t("verificationPending")}</p>
      )}

      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t("routesHere", { name })}</h2>
          <ul className="mt-2 list-disc pl-5">
            {related.map(({ route, origin, destination }) => (
              <li key={route.id}>
                <Link href={`/routes/${route.slug}`} className="underline">
                  {pick(origin.name, locale)} → {pick(destination.name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {place.verifiedSource && (
        <p className="mt-8 text-xs text-zinc-500">
          {t("source")}: <a href={place.verifiedSource} rel="noopener nofollow" className="underline">{new URL(place.verifiedSource).hostname}</a>
        </p>
      )}
    </article>
  );
}
