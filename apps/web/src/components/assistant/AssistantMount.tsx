import { getTranslations } from "next-intl/server";
import { BRAND, readAssistantConfig } from "@cab/config";
import { AssistantWidget, type WidgetStrings } from "./AssistantWidget";

const TOOLS = ["search_places", "get_place", "list_routes", "get_route", "list_vehicle_classes", "get_quote", "explain_fares", "site_help", "request_callback", "default"] as const;
const CHIPS = ["ellora", "shirdi", "fares", "callback"] as const;

/** Server wrapper: resolves the widget's strings for the current locale. */
export async function AssistantMount({ locale }: { locale: string }) {
  const t = await getTranslations("assistant");
  const name = readAssistantConfig().ASSISTANT_NAME;
  const strings: WidgetStrings = {
    name,
    tagline: t("tagline"),
    teaserTitle: t("teaserTitle"),
    teaser: t("teaser"),
    open: t("open", { name }),
    close: t("close"),
    placeholder: t("placeholder"),
    send: t("send"),
    intro: t("intro", { name, brand: BRAND.name }),
    basicMode: t("basicMode"),
    privacy: t("privacy"),
    confirm: t("confirm"),
    cancel: t("cancel"),
    confirmed: t("confirmed"),
    cancelled: t("cancelled"),
    proposalTitle: t("proposalTitle"),
    mic: t("mic"),
    listening: t("listening"),
    readAloud: t("readAloud"),
    newChat: t("newChat"),
    beep: t("beep"),
    openPage: t("openPage"),
    error: t("error"),
    rateLimited: t("rateLimited"),
    tools: Object.fromEntries(TOOLS.map((k) => [k, t(`tools.${k}`)])),
    chips: CHIPS.map((k) => ({ label: t(`chips.${k}.label`), message: t(`chips.${k}.message`) })),
  };
  return <AssistantWidget key={locale} locale={locale} strings={strings} />;
}
