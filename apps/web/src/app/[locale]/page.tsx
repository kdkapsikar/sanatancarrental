import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@cab/seo";
import { Link } from "@/i18n/navigation";
import { listPlaces, listRoutes, pick } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { businessInfo } from "@/lib/settings";
import { localBusiness } from "@cab/seo";
import { JsonLd } from "@/components/JsonLd";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return pageMetadata({ locale, path: "", title: t("metaTitle"), description: t("metaDescription") });
}

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tk = await getTranslations("place.kind");
  const [allPlaces, allRoutes] = await Promise.all([listPlaces(), listRoutes()]);
  const biz = businessInfo();

  return (
    <>
      {/* No reviews are passed: AggregateRating appears only once real published reviews exist. */}
      {biz && <JsonLd data={localBusiness(biz)} />}
      <h1 className="text-2xl font-bold">{t("heading")}</h1>
      <p className="mt-2 text-zinc-700">{t("intro")}</p>

      <h2 className="mt-8 text-lg font-semibold">{t("destinationsHeading")}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {allPlaces.filter((p) => p.slug !== "chhatrapati-sambhajinagar").map((p) => (
          <li key={p.id}>
            <Link href={`/places/${p.slug}`} className="underline">{pick(p.name, locale)}</Link>
            <span className="ml-2 text-xs text-zinc-500">{tk(p.kind)}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">{t("routesHeading")}</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {allRoutes.map(({ route, origin, destination }) => (
          <li key={route.id}>
            <Link href={`/routes/${route.slug}`} className="underline">
              {pick(origin.name, locale)} → {pick(destination.name, locale)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-xs text-zinc-500">{t("dataNote")}</p>
    </>
  );
}
