import { readEnv } from "@cab/config";
import type { BusinessInfo } from "@cab/seo";

export const env = readEnv();
export const SITE_URL = env.SITE_URL;
export const INDEX_THRESHOLD = env.INDEX_COMPLETENESS_THRESHOLD;

/**
 * Business identity for LocalBusiness/TaxiService JSON-LD. Returns null until the client's
 * real name, phone and address are configured; we never emit made-up business details.
 */
export function businessInfo(): BusinessInfo | null {
  const e = process.env;
  const required = ["BUSINESS_NAME", "BUSINESS_PHONE", "BUSINESS_STREET", "BUSINESS_POSTCODE"] as const;
  if (required.some((k) => !e[k])) return null;
  return {
    name: e["BUSINESS_NAME"]!,
    url: SITE_URL,
    telephone: e["BUSINESS_PHONE"]!,
    address: {
      streetAddress: e["BUSINESS_STREET"]!,
      addressLocality: "Chhatrapati Sambhajinagar",
      addressRegion: "Maharashtra",
      postalCode: e["BUSINESS_POSTCODE"]!,
      addressCountry: "IN",
    },
    areaServed: ["Chhatrapati Sambhajinagar", "Aurangabad", "छत्रपती संभाजीनगर", "औरंगाबाद"],
  };
}

/** wa.me click-to-chat link, only when the client's WhatsApp number is configured. */
export function whatsappUrl(text?: string): string | null {
  const digits = (process.env["BUSINESS_WHATSAPP"] ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
