import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import "../globals.css";

const latin = Noto_Sans({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-devanagari", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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
    <html lang={locale} className={`${latin.variable} ${deva.variable}`}>
      <body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
        {/* No client components read messages, so none are serialised to the browser. */}
        <NextIntlClientProvider messages={null}>
        <header className="border-b border-zinc-200">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="font-semibold">{brand}</Link>
            <nav className="flex gap-4 text-sm" aria-label={t("nav.language")}>
              {routing.locales.map((l) => (
                <Link key={l} href="/" locale={l} aria-current={l === locale ? "true" : undefined}
                  className={l === locale ? "font-semibold underline" : ""}>
                  {tl(l)}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 py-8 text-xs text-zinc-500">
          <p>{t("footer.cityNames")}</p>
          <p>{t("footer.pricesNote")}</p>
        </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
