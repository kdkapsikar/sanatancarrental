import { getTranslations } from "next-intl/server";

/**
 * Explains how a quote is built, using the same line/note vocabulary the fare engine emits.
 * Shows no amounts: prices appear only in real quotes from approved rules.
 */
export async function FareAnatomy() {
  const t = await getTranslations("fares");
  const tq = await getTranslations("quote");
  const built = ["base_km", "minimum_km_applied", "driver_allowance", "night_halt", "gst"] as const;
  const actuals = ["toll_at_actuals", "parking_at_actuals", "border_tax_at_actuals"] as const;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative card overflow-hidden p-6">
        <div className="paithani-border absolute inset-x-0 top-0" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-kumkum-600">{t("receiptTitle")}</p>
        <ul className="mt-4 divide-y divide-dashed divide-sand-300">
          {built.map((c, i) => (
            <li key={c} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full bg-peacock-50 text-[11px] font-bold text-peacock-700">{i + 1}</span>
                {t(`line.${c}`)}
              </span>
              <span className="h-2 w-16 rounded-full bg-sand-200" aria-hidden="true" />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t-2 border-basalt-900 pt-3 font-semibold">
          <span>{tq("total")}</span>
          <span className="h-2.5 w-24 rounded-full bg-basalt-900/80" aria-hidden="true" />
        </div>
        <p className="mt-4 text-xs text-basalt-600">{t("noAmounts")}</p>
      </div>
      <div className="space-y-4">
        <div className="card p-5">
          <h3 className="font-semibold text-peacock-700">{t("builtInTitle")}</h3>
          <p className="mt-1 text-sm text-basalt-600">{t("builtInBody")}</p>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-kumkum-600">{t("actualsTitle")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-basalt-600">
            {actuals.map((c) => (
              <li key={c} className="flex gap-2">
                <span className="text-kumkum-500" aria-hidden="true">◆</span>
                {t(`note.${c}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">{t("sameBillTitle")}</h3>
          <p className="mt-1 text-sm text-basalt-600">{t("sameBillBody")}</p>
        </div>
      </div>
    </div>
  );
}
