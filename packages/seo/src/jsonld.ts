/**
 * JSON-LD builders. Every value comes from the caller's real data; nothing is defaulted.
 * - AggregateRating is built only from published review rows and omitted when there are none.
 * - Offer prices come only from a fare-engine Quote.
 * - No FAQPage builder: Google restricts FAQ rich results (plan §7.2.2).
 */
import type { Quote } from "@cab/fare-engine";

type Thing = Record<string, unknown>;

export interface BusinessInfo {
  name: string;
  url: string;
  telephone: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: "IN";
  };
  geo?: { lat: number; lng: number };
  logo?: string;
  sameAs?: string[];
  /** Names the business serves, e.g. both city names in all scripts. */
  areaServed?: string[];
}

export interface ReviewRow {
  rating: number;
  status: "pending_moderation" | "published" | "hidden";
}

/** Returns undefined unless there is at least one published review. */
export function aggregateRating(reviews: readonly ReviewRow[]): Thing | undefined {
  const published = reviews.filter((r) => r.status === "published");
  if (published.length === 0) return undefined;
  for (const r of published) {
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) {
      throw new RangeError(`invalid rating ${r.rating}`);
    }
  }
  const avg = published.reduce((s, r) => s + r.rating, 0) / published.length;
  return {
    "@type": "AggregateRating",
    ratingValue: Math.round(avg * 10) / 10,
    reviewCount: published.length,
    bestRating: 5,
    worstRating: 1,
  };
}

function postalAddress(a: BusinessInfo["address"]): Thing {
  return { "@type": "PostalAddress", ...a };
}

function withRating(obj: Thing, reviews?: readonly ReviewRow[]): Thing {
  const rating = reviews ? aggregateRating(reviews) : undefined;
  return rating ? { ...obj, aggregateRating: rating } : obj;
}

export function localBusiness(b: BusinessInfo, reviews?: readonly ReviewRow[]): Thing {
  return withRating(
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${b.url.replace(/\/$/, "")}/#business`,
      name: b.name,
      url: b.url,
      telephone: b.telephone,
      address: postalAddress(b.address),
      ...(b.geo
        ? { geo: { "@type": "GeoCoordinates", latitude: b.geo.lat, longitude: b.geo.lng } }
        : {}),
      ...(b.logo ? { logo: b.logo } : {}),
      ...(b.sameAs?.length ? { sameAs: b.sameAs } : {}),
    },
    reviews,
  );
}

export function taxiService(
  b: BusinessInfo,
  opts: { name: string; description?: string; url: string },
  reviews?: readonly ReviewRow[],
): Thing {
  return withRating(
    {
      "@context": "https://schema.org",
      "@type": "TaxiService",
      name: opts.name,
      url: opts.url,
      ...(opts.description ? { description: opts.description } : {}),
      provider: { "@id": `${b.url.replace(/\/$/, "")}/#business` },
      ...(b.areaServed?.length
        ? { areaServed: b.areaServed.map((n) => ({ "@type": "City", name: n })) }
        : {}),
    },
    reviews,
  );
}

export function offerFromQuote(
  q: Quote,
  opts: { url: string; validUntil?: string; name?: string },
): Thing {
  return {
    "@type": "Offer",
    ...(opts.name ? { name: opts.name } : {}),
    url: opts.url,
    priceCurrency: q.currency,
    // Rupees with paise, as a string to avoid float formatting surprises.
    price: (q.totalPaise / 100).toFixed(2),
    ...(opts.validUntil ? { priceValidUntil: opts.validUntil } : {}),
  };
}

export interface TripStop {
  name: string;
  url?: string;
}

export function touristTrip(opts: {
  name: string;
  description?: string;
  url: string;
  stops: readonly TripStop[];
  offer?: Thing;
  provider: BusinessInfo;
  touristType?: string[];
}): Thing {
  if (opts.stops.length === 0) throw new RangeError("a TouristTrip needs at least one stop");
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: opts.name,
    url: opts.url,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.touristType?.length ? { touristType: opts.touristType } : {}),
    itinerary: {
      "@type": "ItemList",
      itemListElement: opts.stops.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "TouristAttraction", name: s.name, ...(s.url ? { url: s.url } : {}) },
      })),
    },
    provider: { "@id": `${opts.provider.url.replace(/\/$/, "")}/#business` },
    ...(opts.offer ? { offers: opts.offer } : {}),
  };
}

export function breadcrumbList(items: ReadonlyArray<{ name: string; url: string }>): Thing {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/** Serialise for a <script type="application/ld+json"> tag, escaping "<" to prevent breakout. */
export function toScriptJson(data: Thing | Thing[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
