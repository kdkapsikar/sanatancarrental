import { describe, expect, it } from "vitest";
import { PLACE_SEEDS, ROUTE_SEEDS, WIKI, routeGaps } from "./data";
import { EXAMPLE_FARE_RULES } from "./example-fare-rules";

describe("seed data guards", () => {
  it("has 15 destinations plus the origin city, each with a cited source", () => {
    expect(PLACE_SEEDS).toHaveLength(16);
    for (const p of PLACE_SEEDS) {
      const w = WIKI.find((x) => x.slug === p.slug);
      expect(w?.source, p.slug).toMatch(/^https:\/\/en\.wikipedia\.org\//);
    }
  });

  it("has 20 unique routes, all starting in Sambhajinagar (city or airport)", () => {
    expect(ROUTE_SEEDS).toHaveLength(20);
    expect(new Set(ROUTE_SEEDS.map((r) => `${r.origin}>${r.destination}`)).size).toBe(20);
    for (const r of ROUTE_SEEDS) {
      expect(["chhatrapati-sambhajinagar", "chhatrapati-sambhajinagar-airport"]).toContain(r.origin);
    }
  });

  it("every unsourced route fact is flagged for verification", () => {
    expect(Object.keys(routeGaps())).toEqual(
      expect.arrayContaining(["distanceKm", "driveMinutes", "tollEstimatePaise"]),
    );
  });

  it("records the Ellora closing-day conflict", () => {
    const ellora = PLACE_SEEDS.find((p) => p.slug === "ellora-caves")!;
    expect(ellora.needsVerification["closedDays"]).toMatch(/CONFLICT.*Tuesday.*Monday/);
  });

  it("example fare rules are never active", () => {
    for (const r of EXAMPLE_FARE_RULES) {
      expect(r.isExample).toBe(true);
      expect(r.isActive).toBe(false);
    }
  });
});
