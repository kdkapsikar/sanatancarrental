import { ViewTransition } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { localBusiness, LOCALES, type Locale } from "@cab/seo";
import { Link } from "@/i18n/navigation";
import { listPlaces, listRoutes, pick, toMapPlaces } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { businessInfo, whatsappUrl } from "@/lib/settings";
import { JsonLd } from "@/components/JsonLd";
import { KindIcon } from "@/components/KindIcon";
import { RegionMap } from "@/components/RegionMap";
import { FareAnatomy } from "@/components/FareAnatomy";
import { TrustPanel } from "@/components/TrustPanel";
import { StatusChip } from "@/components/StatusChip";
import { TripFinder } from "@/components/TripFinder";
import { KindFilter } from "@/components/KindFilter";
import { kindGroup, toFinderPlaces } from "@/lib/content";

export const revalidate = 3600;

const CITY = "chhatrapati-sambhajinagar";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return pageMetadata({ locale, path: "", title: t("metaTitle"), description: t("metaDescription") });
}

function SectionHead({ eyebrow, heading, intro, id }: { eyebrow: string; heading: string; intro?: string; id?: string }) {
  return (
    <div id={id} className="reveal max-w-2xl scroll-mt-24">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-kumkum-600">{eyebrow}</p>
      <h2 className="font-display mt-3 text-3xl leading-tight text-basalt-950 sm:text-4xl">{heading}</h2>
      {intro && <p className="mt-3 text-basalt-600">{intro}</p>}
    </div>
  );
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tm = await getTranslations("map");
  const tt = await getTranslations("trips");
  const tk = await getTranslations("place.kind");
  const tf = await getTranslations("home.finder");
  const tfl = await getTranslations("home.filter");
  const [allPlaces, allRoutes] = await Promise.all([listPlaces(), listRoutes()]);
  const biz = businessInfo();
  const wa = whatsappUrl();
  const destinations = allPlaces.filter((p) => p.slug !== CITY);
  // A second name in the other script makes the bilingual city legible to every reader.
  const altName = (n: { en: string; mr?: string; hi?: string }) => (locale === "en" ? (n.mr ?? null) : n.en);

  const trips = [
    { key: "outstation", icon: "city" },
    { key: "airport", icon: "airport" },
    { key: "sightseeing", icon: "cave_site" },
    { key: "pilgrimage", icon: "temple" },
  ] as const;

  return (
    <>
      {/* No reviews are passed: AggregateRating appears only once real published reviews exist. */}
      {biz && <JsonLd data={localBusiness(biz)} />}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-kumkum-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 -left-32 size-[30rem] rounded-full bg-peacock-500/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-16 [&>*]:min-w-0 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-kumkum-600/20 bg-white/70 px-3 py-1 text-xs font-semibold text-kumkum-700">
              <span className="size-1.5 rounded-full bg-kumkum-500" />
              {t("eyebrow")}
            </p>
            <h1 className="font-display mt-5 text-4xl leading-[1.05] tracking-tight text-basalt-950 sm:text-5xl lg:text-6xl">
              {t("heading")}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-basalt-600">{t("intro")}</p>
            <TripFinder
              places={toFinderPlaces(allPlaces, allRoutes, locale)}
              originLabel={pick(allPlaces.find((x) => x.slug === CITY)?.name, locale) ?? ""}
              strings={{
                label: tf("label"),
                placeholder: tf("placeholder"),
                go: tf("go"),
                ask: tf("ask"),
                askMessage: tf.raw("askMessage") as string,
                noMatch: tf("noMatch"),
                from: tf("from"),
                kinds: Object.fromEntries(["city", "town", "airport", "cave_site", "temple", "fort", "monument", "nature"].map((k) => [k, tk(k)])),
              }}
            />
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
              {wa && (
                <a href={wa} rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-peacock-600 px-4 py-2 text-white shadow-lg shadow-peacock-600/25 transition hover:bg-peacock-700">
                  {t("ctaWhatsapp")}
                </a>
              )}
              <Link href="/#destinations" className="text-kumkum-700 hover:text-kumkum-600">{t("ctaDestinations")} →</Link>
              <Link href="/#fares" className="text-basalt-600 hover:text-basalt-950">{t("ctaFares")} →</Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-basalt-900/10 pt-6">
              {[
                [destinations.length, t("statPlaces")],
                [allRoutes.length, t("statRoutes")],
                [LOCALES.length, t("statLanguages")],
              ].map(([n, label]) => (
                <div key={String(label)}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="font-display text-3xl text-basalt-950">{n}</dd>
                  <dd className="text-xs text-basalt-600">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="animate-rise [animation-delay:150ms]">
            <div className="card p-3 sm:p-4">
              <RegionMap
                places={toMapPlaces(allPlaces, locale)}
                originSlug={CITY}
                title={tm("title")}
                caption={tm("caption")}
                insetTitle={tm("insetTitle")}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trip types */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SectionHead eyebrow={t("tripsEyebrow")} heading={t("tripsHeading")} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {trips.map((trip, i) => (
            <div key={trip.key} className="reveal card group relative overflow-hidden p-6 transition hover:-translate-y-1">
              <div className={`absolute inset-x-0 top-0 h-1 ${["bg-kumkum-500", "bg-peacock-500", "bg-marigold-400", "bg-basalt-800"][i]}`} />
              <KindIcon kind={trip.icon} className="h-9 w-12 text-kumkum-600" />
              <h3 className="font-display mt-4 text-xl">{tt(`${trip.key}.title`)}</h3>
              <p className="mt-2 text-sm text-basalt-600">{tt(`${trip.key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Destinations */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SectionHead id="destinations" eyebrow={t("destinationsEyebrow")} heading={t("destinationsHeading")} intro={t("destinationsIntro")} />
        <KindFilter
          targetId="destination-grid"
          groups={[
            { key: "all", label: tfl("all"), count: destinations.length },
            ...(["caves", "temples", "heritage", "cities", "nature"] as const)
              .map((g) => ({ key: g, label: tfl(g), count: destinations.filter((d) => kindGroup(d.kind) === g).length }))
              .filter((g) => g.count > 0),
          ]}
        />
        <ul id="destination-grid" data-filter="all" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((p) => (
            <li key={p.id} data-group={kindGroup(p.kind)} className="reveal">
              <Link href={`/places/${p.slug}`} className="card group flex h-full gap-4 p-5 transition hover:-translate-y-1 hover:shadow-xl">
                <ViewTransition name={`place-icon-${p.slug}`} share="morph" default="none">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sand-100 text-kumkum-600 transition group-hover:bg-kumkum-600 group-hover:text-white">
                    <KindIcon kind={p.kind} className="h-8 w-10" />
                  </span>
                </ViewTransition>
                <span className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-basalt-400">{tk(p.kind)}</span>
                  <ViewTransition name={`place-title-${p.slug}`} share="morph" default="none">
                    <span className="font-display block text-lg leading-snug text-basalt-950">{pick(p.name, locale)}</span>
                  </ViewTransition>
                  {altName(p.name) && <span className="block text-sm text-basalt-600">{altName(p.name)}</span>}
                  <span className="mt-3 block"><StatusChip score={p.completenessScore} /></span>
                </span>
                <span className="self-center text-basalt-400 transition group-hover:translate-x-1 group-hover:text-kumkum-600" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Routes */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SectionHead id="routes" eyebrow={t("routesEyebrow")} heading={t("routesHeading")} />
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {allRoutes.map(({ route, origin, destination }) => (
            <li key={route.id} className="reveal">
              <Link href={`/routes/${route.slug}`} className="group flex items-center gap-4 rounded-2xl border border-basalt-900/10 bg-white px-5 py-4 transition hover:border-kumkum-500/50 hover:shadow-lg">
                <span className="min-w-0 truncate text-sm font-medium text-basalt-600">{pick(origin.name, locale)}</span>
                <span className="relative flex-1 border-t-2 border-dashed border-sand-300 transition group-hover:border-kumkum-500" aria-hidden="true">
                  <span className="absolute -top-[5px] right-0 size-2 rounded-full bg-kumkum-500" />
                </span>
                <span className="font-display min-w-0 truncate text-base text-basalt-950">{pick(destination.name, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Fares */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <SectionHead id="fares" eyebrow={t("faresEyebrow")} heading={t("faresHeading")} intro={t("faresIntro")} />
        <div className="mt-8"><FareAnatomy /></div>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <TrustPanel />
        <p className="mt-6 text-xs text-basalt-600">{t("dataNote")}</p>
      </section>
    </>
  );
}
