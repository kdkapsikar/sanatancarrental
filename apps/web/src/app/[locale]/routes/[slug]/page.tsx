import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { breadcrumbList, canonicalUrl, type Locale } from "@cab/seo";
import { Link } from "@/i18n/navigation";
import { getRoute, listPlaces, pick, toMapPlaces } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL, whatsappUrl } from "@/lib/settings";
import { sampleQuoteForRoute } from "@/lib/quotes";
import { inr } from "@/lib/format";
import { JsonLd } from "@/components/JsonLd";
import { KindIcon } from "@/components/KindIcon";
import { QuoteBreakdown } from "@/components/QuoteBreakdown";
import { RegionMap } from "@/components/RegionMap";
import { StatusChip } from "@/components/StatusChip";
import { WeekStrip } from "@/components/WeekStrip";
import { AskButton } from "@/components/AskButton";

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
  const [t, tp, tn, tm, th, ta] = await Promise.all([
    getTranslations("route"),
    getTranslations("place"),
    getTranslations("site.nav"),
    getTranslations("map"),
    getTranslations("home"),
    getTranslations("assistant"),
  ]);
  const { route, origin, destination } = r;
  const names = { origin: pick(origin.name, locale)!, destination: pick(destination.name, locale)! };
  const flagged = (f: string) => f in route.needsVerification;
  const [quote, all] = await Promise.all([sampleQuoteForRoute(route), listPlaces()]);
  const minutes = route.driveMinutes;
  const wa = whatsappUrl(t("heading", names));
  const destFlags = destination.needsVerification;
  const destVisitable = ["cave_site", "temple", "fort", "monument", "nature"].includes(destination.kind);

  const stats = [
    { label: t("distance"), value: route.distanceKm !== null && !flagged("distanceKm") ? t("kmValue", { km: route.distanceKm }) : null },
    {
      label: t("driveTime"),
      value: minutes !== null && !flagged("driveMinutes") ? t("minutesValue", { hours: Math.floor(minutes / 60), minutes: minutes % 60 }) : null,
    },
    { label: t("toll"), value: route.tollEstimatePaise !== null && !flagged("tollEstimatePaise") ? inr(route.tollEstimatePaise, locale) : null },
  ];

  return (
    <article>
      <JsonLd
        data={breadcrumbList([
          { name: tn("home"), url: canonicalUrl(SITE_URL, locale, "") },
          { name: t("heading", names), url: canonicalUrl(SITE_URL, locale, `routes/${slug}`) },
        ])}
      />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 right-0 size-[28rem] rounded-full bg-peacock-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pt-10 sm:px-6">
          <Link href="/#routes" className="text-sm font-medium text-basalt-600 hover:text-kumkum-600">← {th("routesHeading")}</Link>

          {/* Ticket */}
          <div className="card animate-rise relative mt-6 overflow-hidden">
            <div className="paithani-border" />
            <div className="grid gap-6 p-6 sm:p-10 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-basalt-400">{t("from")}</p>
                <p className="font-display mt-1 text-2xl text-basalt-950 sm:text-3xl">{names.origin}</p>
              </div>
              <div className="flex items-center gap-2 text-kumkum-600 md:w-56" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-kumkum-600" />
                <span className="flex-1 border-t-2 border-dashed border-kumkum-500/50" />
                <svg viewBox="0 0 32 16" className="h-5 w-9"><path d="M3 11h26M5 11l3-6h13l5 6M9 14a2 2 0 1 0 0-.1M23 14a2 2 0 1 0 0-.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="flex-1 border-t-2 border-dashed border-kumkum-500/50" />
                <span className="size-2.5 rounded-full border-2 border-kumkum-600" />
              </div>
              <div className="md:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-basalt-400">{t("to")}</p>
                <h1 className="font-display mt-1 text-2xl text-basalt-950 sm:text-3xl">{names.destination}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-sand-300 bg-sand-50 px-6 py-4 sm:px-10">
              <StatusChip score={route.completenessScore} />
              <div className="flex flex-wrap gap-2">
              <AskButton
                message={ta("askTripMessage", { from: names.origin, to: names.destination })}
                className="rounded-full bg-basalt-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-kumkum-700"
              >
                {ta("askTrip")}
              </AskButton>
              {wa && (
                <a href={wa} rel="noopener" className="rounded-full bg-peacock-600 px-4 py-2 text-sm font-semibold text-white hover:bg-peacock-700">
                  {th("ctaWhatsapp")}
                </a>
              )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-8 grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <div className="space-y-6">
          <section>
            <h2 className="font-display text-2xl">{t("factsHeading")}</h2>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className={`rounded-2xl p-4 ${s.value ? "card" : "hatch bg-sand-100"}`}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-basalt-600">{s.label}</dt>
                  <dd className={`mt-2 ${s.value ? "font-display text-2xl text-basalt-950" : "text-sm text-basalt-600"}`}>{s.value ?? tp("notVerified")}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="font-display text-2xl">{t("fareHeading")}</h2>
            <div className="mt-4">
              {quote ? (
                <QuoteBreakdown quote={quote} locale={locale} />
              ) : (
                <div className="card relative overflow-hidden p-6">
                  <div className="absolute inset-y-0 left-0 w-1.5 bg-marigold-400" />
                  <p className="text-basalt-800">{t("faresPending")}</p>
                  <Link href="/#fares" className="mt-3 inline-block text-sm font-semibold text-kumkum-600 hover:text-kumkum-700">
                    {th("ctaFares")} →
                  </Link>
                </div>
              )}
            </div>
          </section>

          {destVisitable && (
            <section className="card p-6">
              <Link href={`/places/${destination.slug}`} className="group flex items-center gap-3">
                <KindIcon kind={destination.kind} className="h-7 w-9 text-kumkum-600" />
                <span className="font-display text-xl group-hover:text-kumkum-600">{names.destination}</span>
                <span className="text-basalt-400 group-hover:text-kumkum-600" aria-hidden="true">→</span>
              </Link>
              <h3 className="mt-4 text-sm font-semibold text-basalt-800">{tp("closedDays")}</h3>
              <div className="mt-3">
                <WeekStrip
                  closedDays={"closedDays" in destFlags ? null : destination.closedDays}
                  conflict={/CONFLICT/.test(destFlags["closedDays"] ?? "")}
                />
              </div>
            </section>
          )}
        </div>

        <div className="card h-fit p-3 sm:p-4 lg:sticky lg:top-24">
          <RegionMap
            places={toMapPlaces(all, locale)}
            originSlug={origin.slug}
            highlight={[destination.slug]}
            title={t("heading", names)}
            caption={tm("routeCaption")}
            insetTitle={tm("insetTitle")}
          />
        </div>
      </div>
    </article>
  );
}
