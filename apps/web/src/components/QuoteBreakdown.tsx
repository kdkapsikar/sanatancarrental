import { getTranslations } from "next-intl/server";
import type { Quote } from "@cab/fare-engine";
import { inr } from "@/lib/format";


/** Renders a fare-engine quote. All amounts come from the Quote; labels from i18n. */
export async function QuoteBreakdown({ quote, locale }: { quote: Quote; locale: string }) {
  const t = await getTranslations("quote");
  const params = (p?: Record<string, string | number>) =>
    Object.fromEntries(
      Object.entries(p ?? {}).map(([k, v]) => [k, k.endsWith("Paise") && typeof v === "number" ? inr(v, locale) : v]),
    );
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <table className="w-full text-sm">
        <tbody>
          {quote.lines.map((l, i) => (
            <tr key={i} className="border-b border-zinc-100">
              <td className="py-1">{t(`line.${l.code}`, params(l.params))}</td>
              <td className="py-1 text-right tabular-nums">{inr(l.amountPaise, locale)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="pt-2">{t("total")}</td>
            <td className="pt-2 text-right tabular-nums">{inr(quote.totalPaise, locale)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <h3 className="font-medium">{t("includes")}</h3>
          <ul className="list-disc pl-5">
            {quote.inclusions.map((n, i) => <li key={i}>{t(`note.${n.code}`, params(n.params))}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-medium">{t("excludes")}</h3>
          <ul className="list-disc pl-5">
            {quote.exclusions.map((n, i) => <li key={i}>{t(`note.${n.code}`, params(n.params))}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
