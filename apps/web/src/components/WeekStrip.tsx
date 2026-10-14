import { getTranslations } from "next-intl/server";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Seven-day strip for a sight's weekly closing day. Unknown is drawn hatched and labelled,
 * never shown as "open every day".
 */
export async function WeekStrip({ closedDays, conflict }: { closedDays: string[] | null; conflict: boolean }) {
  const t = await getTranslations("weekStrip");
  const tw = await getTranslations("weekdayShort");
  const known = closedDays !== null && !conflict;
  return (
    <div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label={t("label")}>
        {DAYS.map((d) => {
          const closed = known && closedDays!.includes(d);
          return (
            <li
              key={d}
              className={[
                "flex h-16 flex-col items-center justify-center rounded-xl text-xs font-semibold",
                !known
                  ? "hatch bg-sand-100 text-basalt-600"
                  : closed
                    ? "bg-kumkum-600 text-white"
                    : "bg-peacock-50 text-peacock-700",
              ].join(" ")}
            >
              <span>{tw(d)}</span>
              <span className="mt-1 text-[10px] font-normal opacity-80">
                {!known ? "?" : closed ? t("closed") : t("open")}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-basalt-600">
        {conflict ? t("conflict") : known ? t("knownNote") : t("unknown")}
      </p>
    </div>
  );
}
