import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { breadcrumbList, canonicalUrl, type Locale } from "@cab/seo";
import { Link } from "@/i18n/navigation";
import { getPlace, listPlaces, pick, routesTouching, toMapPlaces } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/settings";
import { inr } from "@/lib/format";
import { JsonLd } from "@/components/JsonLd";
import { KindIcon } from "@/components/KindIcon";
import { RegionMap } from "@/components/RegionMap";
import { StatusChip } from "@/components/StatusChip";
import { WeekStrip } from "@/components/WeekStrip";
import { AskButton } from "@/components/AskButton";
import { readAssistantConfig } from "@cab/config";

export const revalidate = 3600;

const CITY = "chhatrapati-sambhajinagar";
const VISITABLE = ["cave_site", "temple", "fort", "monument", "nature"];

type Params = { params: Promise<{ locale: Locale; slug: string }> };

/** Every destination page is built ahead of time (needed for the static GitHub Pages export). */
export async function generateStaticParams() {
  return (await listPlaces()).map((p) => ({ slug: p.slug }));
}

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
  const [t, tn, tm, ta] = await Promise.all([
    getTranslations("place"),
    getTranslations("site.nav"),
    getTranslations("map"),
    getTranslations("assistant"),
  ]);
  const botName = readAssistantConfig().ASSISTANT_NAME;
  const [related, all] = await Promise.all([routesTouching(place.id), listPlaces()]);
  const name = pick(place.name, locale)!;
  const altName = locale === "en" ? place.name.mr : place.name.en;
  const flags = place.needsVerification;
  const shown = (field: string) => !(field in flags);
  const conflict = /CONFLICT/.test(flags["closedDays"] ?? "");
  const visitable = VISITABLE.includes(place.kind);

  const Fact = ({ label, value }: { label: string; value: string | null }) => (
    <div className={`rounded-2xl p-4 ${value ? "bg-peacock-50" : "hatch bg-sand-100"}`}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-basalt-600">{label}</dt>
      <dd className={`mt-1 ${value ? "font-display text-lg text-basalt-950" : "text-sm text-basalt-600"}`}>{value ?? t("notVerified")}</dd>
    </div>
  );

  return (
    <article>
      <JsonLd
        data={breadcrumbList([
          { name: tn("home"), url: canonicalUrl(SITE_URL, locale, "") },
          { name, url: canonicalUrl(SITE_URL, locale, `places/${slug}`) },
        ])}
      />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -left-32 size-[28rem] rounded-full bg-kumkum-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-12 [&>*]:min-w-0 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="animate-rise">
            <Link href="/#destinations" className="text-sm font-medium text-basalt-600 hover:text-kumkum-600">
              ← {t("backToAll")}
            </Link>
            <div className="mt-6 flex items-center gap-3 text-kumkum-600">
              <ViewTransition name={`place-icon-${place.slug}`} share="morph" default="none">
                <span className="grid size-14 place-items-center rounded-2xl bg-white text-kumkum-600 shadow-sm">
                  <KindIcon kind={place.kind} className="h-8 w-10" />
                </span>
              </ViewTransition>
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">{t(`kind.${place.kind}`)}</span>
            </div>
            <ViewTransition name={`place-title-${place.slug}`} share="morph" default="none">
              <h1 className="font-display mt-3 text-4xl leading-tight text-basalt-950 sm:text-5xl">{name}</h1>
            </ViewTransition>
            {altName && <p className="mt-1 text-xl text-basalt-600">{altName}</p>}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {place.unescoSite && (
                <span className="rounded-full bg-basalt-900 px-3 py-1 text-xs font-semibold text-marigold-300">{t("unesco")}</span>
              )}
              <StatusChip score={place.completenessScore} />
            </div>
            <AskButton
              message={ta("askPlaceMessage", { place: name })}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-basalt-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-basalt-900/20 transition hover:bg-kumkum-700"
            >
              <span className="size-2 rounded-full bg-marigold-400" aria-hidden="true" />
              {ta("askAbout", { name: botName, place: name })}
            </AskButton>
            {pick(place.description, locale) && shown("description") ? (
              <p className="mt-6 text-lg text-basalt-600">{pick(place.description, locale)}</p>
            ) : (
              <p className="mt-6 max-w-lg rounded-2xl border border-marigold-400/40 bg-marigold-300/15 p-4 text-sm text-basalt-800">
                {t("verificationPending")}
              </p>
            )}
          </div>
          <div className="card animate-rise p-3 [animation-delay:150ms] sm:p-4">
            <RegionMap
              places={toMapPlaces(all, locale)}
              originSlug={CITY}
              highlight={[place.slug]}
              title={t("mapHeading")}
              caption={tm("caption")}
              insetTitle={tm("insetTitle")}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        {visitable && (
          <section className="card p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-kumkum-600">{t("planEyebrow")}</p>
            <h2 className="font-display mt-2 text-2xl">{t("facts")}</h2>
            <h3 className="mt-6 text-sm font-semibold text-basalt-800">{t("closedDays")}</h3>
            <div className="mt-3">
              <WeekStrip closedDays={shown("closedDays") ? place.closedDays : null} conflict={conflict} />
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <Fact
                label={t("openingHours")}
                value={place.openingHours && shown("openingHours") ? `${place.openingHours.open}–${place.openingHours.close}` : null}
              />
              <Fact
                label={t("entryFees")}
                value={
                  place.entryFeesPaise && shown("entryFeesPaise")
                    ? Object.entries(place.entryFeesPaise).map(([k, v]) => `${k}: ${inr(v, locale)}`).join(" · ")
                    : null
                }
              />
            </dl>
            {place.officialTicketUrl && (
              <a href={place.officialTicketUrl} rel="noopener" className="mt-5 inline-flex rounded-full bg-basalt-900 px-4 py-2 text-sm font-semibold text-white hover:bg-basalt-800">
                {t("officialTickets")} ↗
              </a>
            )}
          </section>
        )}

        {related.length > 0 && (
          <section className={`card p-6 sm:p-8 ${visitable ? "" : "lg:col-span-2"}`}>
            <h2 className="font-display text-2xl">{t("routesHere", { name })}</h2>
            <ul className="mt-5 space-y-3">
              {related.map(({ route, origin, destination }) => (
                <li key={route.id}>
                  <Link href={`/routes/${route.slug}`} className="group flex items-center gap-3 rounded-2xl border border-basalt-900/10 px-4 py-3 transition hover:border-kumkum-500/50 hover:bg-kumkum-50">
                    <span className="truncate text-sm text-basalt-600">{pick(origin.name, locale)}</span>
                    <span className="relative flex-1 border-t-2 border-dashed border-sand-300 group-hover:border-kumkum-500" aria-hidden="true" />
                    <span className="font-display truncate">{pick(destination.name, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {place.verifiedSource && (
        <p className="mx-auto mt-8 max-w-6xl px-4 text-xs text-basalt-600 sm:px-6">
          {t("source")}:{" "}
          <a href={place.verifiedSource} rel="noopener nofollow" className="underline decoration-dotted underline-offset-2">
            {new URL(place.verifiedSource).hostname}
          </a>
        </p>
      )}
    </article>
  );
}
