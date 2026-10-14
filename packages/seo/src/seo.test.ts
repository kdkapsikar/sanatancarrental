import { describe, expect, it } from "vitest";
import { quote, type FareRule } from "@cab/fare-engine";
import {
  aggregateRating,
  breadcrumbList,
  buildSitemap,
  canonicalUrl,
  canonicalizePath,
  canonicalizeSlug,
  hreflangAlternates,
  localBusiness,
  offerFromQuote,
  taxiService,
  toScriptJson,
  touristTrip,
  type BusinessInfo,
} from "./index";

const SITE = "https://example.test";

describe("canonical city name", () => {
  it.each([
    ["aurangabad-to-ellora-caves", "chhatrapati-sambhajinagar-to-ellora-caves", true],
    ["sambhajinagar-to-shirdi", "chhatrapati-sambhajinagar-to-shirdi", true],
    ["Aurangabad-Airport", "chhatrapati-sambhajinagar-airport", true],
    ["chhatrapati-sambhajinagar-to-pune", "chhatrapati-sambhajinagar-to-pune", false],
    ["chhatrapati-sambhajinagar-airport", "chhatrapati-sambhajinagar-airport", false],
    ["pune-to-aurangabad", "pune-to-chhatrapati-sambhajinagar", true],
    // Only whole tokens are rewritten.
    ["aurangabadi-food", "aurangabadi-food", false],
  ])("%s → %s", (input, expected, changed) => {
    expect(canonicalizeSlug(input)).toEqual({ slug: expected, changed });
  });

  it("canonicalises every path segment", () => {
    expect(canonicalizePath("routes/aurangabad-to-nashik")).toEqual({
      path: "routes/chhatrapati-sambhajinagar-to-nashik",
      changed: true,
    });
  });

  it("canonical URL uses the canonical slug regardless of alias", () => {
    expect(canonicalUrl(SITE, "mr", "/routes/aurangabad-to-nashik")).toBe(
      `${SITE}/mr/routes/chhatrapati-sambhajinagar-to-nashik`,
    );
  });
});

describe("hreflang", () => {
  it("lists every locale plus x-default pointing at en", () => {
    expect(hreflangAlternates(SITE, "routes/x")).toEqual({
      en: `${SITE}/en/routes/x`,
      hi: `${SITE}/hi/routes/x`,
      mr: `${SITE}/mr/routes/x`,
      "x-default": `${SITE}/en/routes/x`,
    });
  });

  it("only lists locales that exist", () => {
    expect(Object.keys(hreflangAlternates(SITE, "", ["en", "mr"]))).toEqual(["en", "mr", "x-default"]);
  });
});

describe("sitemap", () => {
  const d = new Date("2026-10-14T00:00:00Z");
  const records = [
    { path: "places/ellora-caves", completenessScore: 0.4, lastModified: d },
    { path: "places/ajanta-caves", completenessScore: 0.8, lastModified: d },
    { path: "routes/aurangabad-to-shirdi", completenessScore: 0.95, lastModified: d, locales: ["en"] as const },
  ];

  it("excludes records below the completeness threshold", () => {
    const urls = buildSitemap(records, { siteUrl: SITE, threshold: 0.8 }).map((e) => e.url);
    expect(urls.some((u) => u.includes("ellora"))).toBe(false);
    expect(urls.filter((u) => u.includes("ajanta"))).toHaveLength(3);
  });

  it("emits canonical URLs and hreflang alternates only for translated locales", () => {
    const e = buildSitemap(records, { siteUrl: SITE, threshold: 0.8 }).filter((x) =>
      x.url.includes("shirdi"),
    );
    expect(e).toHaveLength(1);
    expect(e[0]!.url).toBe(`${SITE}/en/routes/chhatrapati-sambhajinagar-to-shirdi`);
    expect(Object.keys(e[0]!.alternates.languages)).toEqual(["en", "x-default"]);
  });

  it("is empty when nothing is complete (the current seed state)", () => {
    expect(buildSitemap(records, { siteUrl: SITE, threshold: 1 })).toEqual([]);
  });
});

const BIZ: BusinessInfo = {
  name: "Test Cabs",
  url: SITE,
  telephone: "+910000000000",
  address: {
    streetAddress: "1 Test Road",
    addressLocality: "Chhatrapati Sambhajinagar",
    addressRegion: "MH",
    postalCode: "431001",
    addressCountry: "IN",
  },
  areaServed: ["Chhatrapati Sambhajinagar", "Aurangabad"],
};

describe("AggregateRating", () => {
  it("is omitted with no reviews", () => {
    expect(aggregateRating([])).toBeUndefined();
    expect(localBusiness(BIZ, [])).not.toHaveProperty("aggregateRating");
    expect(localBusiness(BIZ)).not.toHaveProperty("aggregateRating");
  });

  it("ignores unpublished reviews", () => {
    expect(aggregateRating([{ rating: 5, status: "pending_moderation" }, { rating: 1, status: "hidden" }])).toBeUndefined();
  });

  it("is computed from published rows only", () => {
    const r = aggregateRating([
      { rating: 5, status: "published" },
      { rating: 4, status: "published" },
      { rating: 1, status: "hidden" },
    ]);
    expect(r).toEqual({ "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 2, bestRating: 5, worstRating: 1 });
  });

  it("rejects out-of-range ratings", () => {
    expect(() => aggregateRating([{ rating: 6, status: "published" }])).toThrow(RangeError);
  });
});

describe("JSON-LD builders", () => {
  it("TaxiService references the business and lists both city names", () => {
    const t = taxiService(BIZ, { name: "Outstation cabs", url: `${SITE}/en` });
    expect(t["provider"]).toEqual({ "@id": `${SITE}/#business` });
    expect(t["areaServed"]).toHaveLength(2);
    expect(t).not.toHaveProperty("aggregateRating");
  });

  it("Offer price comes from a fare-engine quote", () => {
    const rule: FareRule = {
      id: "t", version: 1, vehicleClass: "sedan", tripType: "outstation_one_way",
      perKmPaise: 1000, minKmPerDay: 0, oneWayReturnPercent: 0,
      toll: "at_actuals", parking: "at_actuals", gstPercent: 0, homeState: "MH",
    };
    const q = quote({ tripType: "outstation_one_way", vehicleClass: "sedan", start: "2026-11-01T06:00:00+05:30", routeKm: 123.4 }, rule);
    expect(offerFromQuote(q, { url: SITE })).toMatchObject({ priceCurrency: "INR", price: "1240.00" });
  });

  it("TouristTrip lists stops in order and requires at least one", () => {
    const t = touristTrip({ name: "Ellora day", url: SITE, provider: BIZ, stops: [{ name: "Daulatabad Fort" }, { name: "Ellora Caves" }] });
    const items = (t["itinerary"] as { itemListElement: Array<{ position: number }> }).itemListElement;
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(() => touristTrip({ name: "x", url: SITE, provider: BIZ, stops: [] })).toThrow();
  });

  it("BreadcrumbList positions start at 1", () => {
    const b = breadcrumbList([{ name: "Home", url: SITE }, { name: "Routes", url: `${SITE}/routes` }]);
    expect((b["itemListElement"] as Array<{ position: number }>)[1]!.position).toBe(2);
  });

  it("script serialisation cannot break out of the tag", () => {
    expect(toScriptJson({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
