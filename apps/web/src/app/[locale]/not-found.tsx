import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SteeringWheel } from "@/components/assistant/SteeringWheel";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <SteeringWheel size={150} />
      <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-kumkum-600 uppercase">{t("eyebrow")}</p>
      <h1 className="font-display mt-3 text-4xl text-basalt-950">{t("title")}</h1>
      <p className="mt-4 max-w-lg text-basalt-600">{t("body")}</p>
      <Link href="/#destinations" className="mt-8 rounded-full bg-kumkum-600 px-6 py-3 font-semibold text-white hover:bg-kumkum-700">
        {t("home")}
      </Link>
    </section>
  );
}
