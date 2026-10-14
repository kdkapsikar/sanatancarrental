import { getTranslations } from "next-intl/server";
import { INDEX_THRESHOLD } from "@/lib/settings";

/** Shows how much of a record is confirmed, so readers can see what is still being checked. */
export async function StatusChip({ score }: { score: number }) {
  const t = await getTranslations("status");
  const ready = score >= INDEX_THRESHOLD;
  const pct = Math.round(score * 100);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? "bg-peacock-50 text-peacock-700" : "bg-marigold-300/30 text-basalt-800"}`}
      title={t("score", { percent: pct })}
    >
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-basalt-900/10" aria-hidden="true">
        <span className={`absolute inset-y-0 left-0 rounded-full ${ready ? "bg-peacock-500" : "bg-marigold-500"}`} style={{ width: `${pct}%` }} />
      </span>
      {ready ? t("verified") : t("pending")}
    </span>
  );
}
