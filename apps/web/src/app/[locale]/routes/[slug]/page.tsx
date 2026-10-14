import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { breadcrumbList, canonicalUrl, type Locale } from "@cab/seo";
import { getRoute, pick } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/settings";
import { sampleQuoteForRoute } from "@/lib/quotes";
import { JsonLd } from "@/components/JsonLd";
import { inr } from "@/lib/format";
import { QuoteBreakdown } from "@/components/QuoteBreakdown";

export const revalidate = 3600;

type Params = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Params) {
  const { locale, slug } = await params;
  const r = await getRoute(slug);
  if (!r) return {};
  const t = await getTranslations({ locale, namespace: "route" });
  const names = { origin: pick(r.origin.name, locale)!, destination: pick(r.destination.name, locale)! };
  return pageMetadata({
    locale,
    path: `routes/${slug}`,
    title: t("metaTitle", names),
    description: t("metaDescription", names),
    completenessScore: r.route.completenessScore,
  });
}

export default async function RoutePage({ params }: Params) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const r = await getRoute(slug);
  if (!r) notFound();
  const t = await getTranslations("route");
  const tp = await getTranslations("place");
  const tn = await getTranslations("site.nav");
  const names = { origin: pick(r.origin.name, locale)!, destination: pick(r.destination.name, locale)! };
  const { route } = r;
  const flagged = (f: string) => f in route.needsVerification;
  const notVerified = <span className="text-zinc-500">{tp("notVerified")}</span>;
  const quote = await sampleQuoteForRoute(route);
  const minutes = route.driveMinutes;

  return (
    <article>
      <JsonLd
        data={breadcrumbList([
          { name: tn("home"), url: canonicalUrl(SITE_URL, locale, "") },
          { name: t("heading", names), url: canonicalUrl(SITE_URL, locale, `routes/${slug}`) },
        ])}
      />
      <h1 className="text-2xl font-bold">{t("heading", names)}</h1>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt>{t("distance")}</dt>
        <dd>{route.distanceKm !== null && !flagged("distanceKm") ? t("kmValue", { km: route.distanceKm }) : notVerified}</dd>
        <dt>{t("driveTime")}</dt>
        <dd>
          {minutes !== null && !flagged("driveMinutes")
            ? t("minutesValue", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
            : notVerified}
        </dd>
        <dt>{t("toll")}</dt>
        <dd>{route.tollEstimatePaise !== null && !flagged("tollEstimatePaise") ? inr(route.tollEstimatePaise, locale) : notVerified}</dd>
      </dl>

      <section className="mt-6">
        {quote ? <QuoteBreakdown quote={quote} locale={locale} /> : <p className="rounded bg-zinc-50 p-3">{t("faresPending")}</p>}
      </section>

      {Object.keys(route.needsVerification).length > 0 && (
        <p className="mt-6 rounded bg-amber-50 p-3 text-sm text-amber-900">{tp("verificationPending")}</p>
      )}
    </article>
  );
}
