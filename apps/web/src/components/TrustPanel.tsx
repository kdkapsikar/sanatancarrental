import { getTranslations } from "next-intl/server";
import { REQUIREMENTS } from "@cab/compliance";

/** Lists exactly the documents the compliance gate requires; generated from the same table. */
export async function TrustPanel() {
  const t = await getTranslations("trust");
  const groups = [
    { key: "vehicle", docs: REQUIREMENTS.vehicle },
    { key: "driver", docs: REQUIREMENTS.driver },
  ] as const;
  return (
    <div className="basalt-grain relative overflow-hidden rounded-[2rem] p-8 text-sand-50 sm:p-12">
      <div className="max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-marigold-300">{t("eyebrow")}</p>
        <h2 className="font-display mt-3 text-3xl leading-tight sm:text-4xl">{t("heading")}</h2>
        <p className="mt-4 text-sand-200/90">{t("body")}</p>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-marigold-300">{t(`group.${g.key}`)}</h3>
            <ul className="mt-3 space-y-2">
              {g.docs.map((d) => (
                <li key={d.type} className="flex items-center gap-3 text-sm">
                  <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-peacock-500" aria-hidden="true">
                    <circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.2" />
                    <path d="M6 10.5l2.5 2.5L14 7.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                  </svg>
                  {t(`doc.${d.type}`)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-sand-200/70">{t("footnote")}</p>
    </div>
  );
}
