import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Fraunces, Mukta, Tiro_Devanagari_Marathi } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import "../globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display-latin", display: "swap", axes: ["opsz", "SOFT"] });
const displayDeva = Tiro_Devanagari_Marathi({ subsets: ["devanagari", "latin"], weight: "400", variable: "--font-display-deva", display: "swap" });
const body = Mukta({ subsets: ["devanagari", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function BrandMark() {
  // A chaitya arch (Ellora/Ajanta) over a road line.
  return (
    <svg viewBox="0 0 40 40" className="size-9" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="var(--color-kumkum-600)" />
      <path d="M10 29V20a10 10 0 0 1 20 0v9" fill="none" stroke="var(--color-marigold-300)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M15 29v-8a5 5 0 0 1 10 0v8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 32h26" stroke="white" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
    </svg>
  );
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("site");
  const tl = await getTranslations("languages");
  const brand = process.env["BUSINESS_NAME"] ?? t("defaultBrand");

  return (
    <html lang={locale} className={`${display.variable} ${displayDeva.variable} ${body.variable}`}>
      <body className="min-h-screen bg-sand-50 font-sans text-basalt-900 antialiased">
        {/* No client components read messages, so none are serialised to the browser. */}
        <NextIntlClientProvider messages={null}>
          <header className="sticky top-0 z-30 border-b border-basalt-900/5 bg-sand-50/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-3">
                <BrandMark />
                <span className="font-display hidden text-lg leading-none font-semibold sm:inline">{brand}</span>
              </Link>
              <nav className="hidden items-center gap-6 text-sm font-medium text-basalt-600 md:flex">
                <Link href="/#destinations" className="hover:text-kumkum-600">{t("nav.places")}</Link>
                <Link href="/#routes" className="hover:text-kumkum-600">{t("nav.routes")}</Link>
                <Link href="/#fares" className="hover:text-kumkum-600">{t("nav.fares")}</Link>
              </nav>
              <nav aria-label={t("nav.language")} className="flex rounded-full bg-sand-200/70 p-1 text-sm">
                {routing.locales.map((l) => (
                  <Link
                    key={l}
                    href="/"
                    locale={l}
                    aria-current={l === locale ? "true" : undefined}
                    className={`rounded-full px-2.5 py-1 transition sm:px-3 ${l === locale ? "bg-white font-semibold text-kumkum-700 shadow-sm" : "text-basalt-600 hover:text-basalt-900"}`}
                  >
                    <span className="sm:hidden">{tl(`short.${l}`)}</span>
                    <span className="hidden sm:inline">{tl(l)}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          <main>{children}</main>

          <footer className="mt-24">
            <div className="paithani-border" />
            <div className="basalt-grain text-sand-200">
              <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
                <div>
                  <div className="flex items-center gap-3">
                    <BrandMark />
                    <span className="font-display text-lg text-sand-50">{brand}</span>
                  </div>
                  <p className="mt-3 text-sm text-sand-200/80">{t("tagline")}</p>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-marigold-300">{t("footer.cityNames")}</p>
                  <p className="mt-2 text-sand-200/80">{t("footer.pricesNote")}</p>
                </div>
                <div className="text-sm text-sand-200/80">
                  <p>{t("footer.sourcesNote")}</p>
                </div>
              </div>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
