import { describe, expect, it } from "vitest";
import { placeCompleteness, routeCompleteness, type PlaceLike, type RouteLike } from "./completeness";

const fullPlace: PlaceLike = {
  kind: "cave_site",
  name: { en: "X", hi: "X", mr: "X" },
  location: { lng: 75, lat: 20 },
  description: { en: "d", hi: "d", mr: "d" },
  closedDays: ["tue"],
  openingHours: { open: "06:00", close: "18:00" },
  entryFeesPaise: { indian: 100 },
  officialTicketUrl: null,
  verifiedSource: "https://example.org",
  needsVerification: {},
};

describe("completeness", () => {
  it("a fully sourced heritage place scores 1", () => {
    expect(placeCompleteness(fullPlace)).toEqual({ score: 1, missing: [] });
  });

  it("a field flagged in needs_verification counts as missing even if a value is present", () => {
    const r = placeCompleteness({ ...fullPlace, needsVerification: { closedDays: "sources conflict" } });
    expect(r.missing).toEqual(["closedDays"]);
    expect(r.score).toBeLessThan(1);
  });

  it("a flag on a parent field covers its localised sub-fields", () => {
    const r = placeCompleteness({ ...fullPlace, needsVerification: { name: "official name unverified" } });
    expect(r.missing).toEqual(["name.en", "name.hi", "name.mr"]);
  });

  it("TODO_TRANSLATE strings do not count as translated", () => {
    const r = placeCompleteness({ ...fullPlace, name: { en: "X", hi: "TODO_TRANSLATE: X", mr: "X" } });
    expect(r.missing).toContain("name.hi");
  });

  it("unknown closing days are missing, not 'open every day'", () => {
    expect(placeCompleteness({ ...fullPlace, closedDays: null }).missing).toContain("closedDays");
  });

  it("an empty route scores 0", () => {
    const empty: RouteLike = {
      distanceKm: null,
      driveMinutes: null,
      tollEstimatePaise: null,
      stopPlaceIds: null,
      bestSeason: null,
      notes: null,
      verifiedSource: null,
      needsVerification: {},
    };
    expect(routeCompleteness(empty).score).toBe(0);
  });
});
