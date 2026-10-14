import { describe, expect, it } from "vitest";
import { FareError, quote, selectRule } from "./quote";
import type { FareRule, QuoteInput, QuoteLine } from "./types";

// Test fixture values only. They are not the client's prices and must never be seeded as active.
const OUT_SEDAN: FareRule = {
  id: "test-sedan-out",
  version: 1,
  vehicleClass: "sedan",
  tripType: "outstation_round_trip",
  perKmPaise: 1000,
  minKmPerDay: 250,
  driverAllowancePerDayPaise: 30000,
  nightHalt: { perNightPaise: 25000, windowStart: "22:00", windowEnd: "06:00" },
  toll: "at_actuals",
  parking: "at_actuals",
  borderTax: { GJ: 50000, KA: "at_actuals" },
  waiting: { freeMinutes: 30, blockMinutes: 30, perBlockPaise: 5000 },
  airportFeePaise: 10000,
  gstPercent: 5,
  homeState: "MH",
};
const ONE_WAY_SEDAN: FareRule = {
  ...OUT_SEDAN,
  id: "test-sedan-ow",
  tripType: "outstation_one_way",
  oneWayReturnPercent: 50,
};
const LOCAL_SEDAN: FareRule = {
  ...OUT_SEDAN,
  id: "test-sedan-local",
  tripType: "local",
  local: [
    { code: "8h80km", hours: 8, km: 80, pricePaise: 200000, extraKmPaise: 1200, extraHourPaise: 15000 },
  ],
};
const AIRPORT_SEDAN: FareRule = {
  ...OUT_SEDAN,
  id: "test-sedan-airport",
  tripType: "airport_transfer",
  airport: { basePaise: 60000, includedKm: 20, extraKmPaise: 1500 },
};

const amount = (lines: QuoteLine[], code: QuoteLine["code"]) =>
  lines.filter((l) => l.code === code).reduce((s, l) => s + l.amountPaise, 0);

type Case = {
  name: string;
  rule: FareRule;
  input: QuoteInput;
  expect: Partial<Record<QuoteLine["code"], number>> & {
    days?: number;
    nights?: number;
    billableKm?: number;
    subtotal?: number;
    total?: number;
  };
};

const cases: Case[] = [
  {
    name: "round trip under minimum km is billed at min km × days",
    rule: OUT_SEDAN,
    input: {
      tripType: "outstation_round_trip",
      vehicleClass: "sedan",
      start: "2026-11-01T07:00:00+05:30",
      end: "2026-11-01T19:00:00+05:30",
      routeKm: 30,
    },
    expect: {
      days: 1,
      nights: 0,
      billableKm: 250,
      base_km: 60 * 1000,
      minimum_km_applied: 190 * 1000,
      driver_allowance: 30000,
      subtotal: 250 * 1000 + 30000,
      gst: Math.round((250 * 1000 + 30000) * 0.05),
    },
  },
  {
    name: "round trip over minimum km bills actual km, no minimum line",
    rule: OUT_SEDAN,
    input: {
      tripType: "outstation_round_trip",
      vehicleClass: "sedan",
      start: "2026-11-01T05:00:00+05:30",
      end: "2026-11-01T21:00:00+05:30",
      routeKm: 233,
    },
    expect: { billableKm: 466, base_km: 466000, minimum_km_applied: 0 },
  },
  {
    name: "two-day round trip: min km doubles, one night halt, two allowances",
    rule: OUT_SEDAN,
    input: {
      tripType: "outstation_round_trip",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      end: "2026-11-02T20:00:00+05:30",
      routeKm: 180,
      extraKm: 40,
    },
    expect: {
      days: 2,
      nights: 1,
      billableKm: 500,
      base_km: 400000,
      minimum_km_applied: 100000,
      driver_allowance: 60000,
      night_halt: 25000,
    },
  },
  {
    name: "late return before 06:00 does not count as a night halt (window not fully spanned)",
    rule: OUT_SEDAN,
    input: {
      tripType: "outstation_round_trip",
      vehicleClass: "sedan",
      start: "2026-11-01T08:00:00+05:30",
      end: "2026-11-02T01:30:00+05:30",
      routeKm: 300,
    },
    expect: { days: 2, nights: 0, night_halt: 0 },
  },
  {
    name: "one-way bills 50% of the empty return leg",
    rule: ONE_WAY_SEDAN,
    input: {
      tripType: "outstation_one_way",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      routeKm: 343,
    },
    expect: { billableKm: 343 + 172, base_km: 343000, one_way_return: 172000, minimum_km_applied: 0 },
  },
  {
    name: "one-way short trip tops up to the daily minimum",
    rule: ONE_WAY_SEDAN,
    input: {
      tripType: "outstation_one_way",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      routeKm: 100,
    },
    expect: { billableKm: 250, base_km: 100000, one_way_return: 50000, minimum_km_applied: 100000 },
  },
  {
    name: "fractional km is rounded up to whole km",
    rule: ONE_WAY_SEDAN,
    input: {
      tripType: "outstation_one_way",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      routeKm: 300.2,
    },
    expect: { base_km: 301000, one_way_return: 151000 },
  },
  {
    name: "border tax: fixed for GJ, KA stays an exclusion, home state ignored",
    rule: OUT_SEDAN,
    input: {
      tripType: "outstation_round_trip",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      end: "2026-11-01T22:00:00+05:30",
      routeKm: 387,
      statesEntered: ["GJ", "KA", "MH", "GJ"],
    },
    expect: { border_tax: 50000 },
  },
  {
    name: "waiting: 30 free minutes, then per started 30-min block",
    rule: OUT_SEDAN,
    input: {
      tripType: "outstation_round_trip",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      end: "2026-11-01T22:00:00+05:30",
      routeKm: 200,
      expectedWaitingMinutes: 61,
    },
    expect: { waiting: 10000 },
  },
  {
    name: "airport fee once per airport end and not taxed",
    rule: AIRPORT_SEDAN,
    input: {
      tripType: "airport_transfer",
      vehicleClass: "sedan",
      start: "2026-11-01T06:00:00+05:30",
      routeKm: 26,
      pickupIsAirport: true,
    },
    expect: {
      airport_base: 60000,
      airport_extra_km: 6 * 1500,
      airport_fee: 10000,
      gst: Math.round((60000 + 9000) * 0.05),
    },
  },
  {
    name: "local package with extra km and a started extra hour",
    rule: LOCAL_SEDAN,
    input: {
      tripType: "local",
      vehicleClass: "sedan",
      start: "2026-11-01T09:00:00+05:30",
      end: "2026-11-01T18:30:00+05:30",
      localPackage: "8h80km",
      usedKm: 95,
      usedHours: 8.5,
    },
    expect: { local_package: 200000, local_extra_km: 15 * 1200, local_extra_hours: 15000 },
  },
];

describe("quote (table-driven)", () => {
  it.each(cases)("$name", ({ rule, input, expect: e }) => {
    const q = quote(input, rule);
    const { days, nights, billableKm, subtotal, total, ...lineExpectations } = e;
    if (days !== undefined) expect(q.days).toBe(days);
    if (nights !== undefined) expect(q.nights).toBe(nights);
    if (billableKm !== undefined) expect(q.billableKm).toBe(billableKm);
    if (subtotal !== undefined) expect(q.subtotalPaise).toBe(subtotal);
    if (total !== undefined) expect(q.totalPaise).toBe(total);
    for (const [code, value] of Object.entries(lineExpectations)) {
      expect(amount(q.lines, code as QuoteLine["code"]), code).toBe(value);
    }
  });
});

describe("quote invariants", () => {
  const base: QuoteInput = {
    tripType: "outstation_round_trip",
    vehicleClass: "sedan",
    start: "2026-11-01T06:00:00+05:30",
    end: "2026-11-02T20:00:00+05:30",
    routeKm: 210,
    statesEntered: ["GJ", "KA"],
    expectedWaitingMinutes: 45,
  };

  it("total equals the sum of line items", () => {
    const q = quote(base, OUT_SEDAN);
    expect(q.lines.reduce((s, l) => s + l.amountPaise, 0)).toBe(q.totalPaise);
    expect(q.subtotalPaise + q.gstPaise).toBe(q.totalPaise);
  });

  it("all amounts are integer paise", () => {
    const q = quote({ ...base, routeKm: 123.45 }, { ...OUT_SEDAN, gstPercent: 5 });
    for (const l of q.lines) expect(Number.isInteger(l.amountPaise)).toBe(true);
  });

  it("GST is not charged on pass-through costs", () => {
    const q = quote(base, OUT_SEDAN);
    const taxable = q.lines.filter((l) => l.taxable).reduce((s, l) => s + l.amountPaise, 0);
    expect(q.gstPaise).toBe(Math.round(taxable * 0.05));
    expect(q.lines.find((l) => l.code === "border_tax")?.taxable).toBe(false);
  });

  it("is deterministic and fingerprints input + rule version", () => {
    const a = quote(base, OUT_SEDAN);
    const b = quote({ ...base }, OUT_SEDAN);
    expect(a).toEqual(b);
    const c = quote(base, { ...OUT_SEDAN, version: 2 });
    expect(c.fingerprint).not.toBe(a.fingerprint);
  });

  it("lists at-actuals items as exclusions, never as zero lines", () => {
    const q = quote(base, OUT_SEDAN);
    expect(q.exclusions.map((x) => x.code)).toEqual(
      expect.arrayContaining(["toll_at_actuals", "parking_at_actuals", "border_tax_at_actuals"]),
    );
    expect(q.lines.some((l) => l.code === "toll")).toBe(false);
    expect(q.exclusions.find((x) => x.code === "border_tax_at_actuals")?.params).toEqual({
      state: "KA",
    });
  });

  it("included tolls require a stated amount and appear as an inclusion", () => {
    const rule: FareRule = { ...OUT_SEDAN, toll: "included" };
    expect(() => quote(base, rule)).toThrow(FareError);
    const q = quote({ ...base, tollEstimatePaise: 74000 }, rule);
    expect(amount(q.lines, "toll")).toBe(74000);
    expect(q.inclusions.map((x) => x.code)).toContain("toll_included");
    expect(q.exclusions.map((x) => x.code)).not.toContain("toll_at_actuals");
  });

  // Regression for the competitor pattern seen in the audit: two vehicle classes with
  // different per-km rates must never produce the same fare for the same trip.
  it("different per-km rates give different fares for the same trip", () => {
    const suv: FareRule = { ...OUT_SEDAN, id: "suv", vehicleClass: "suv", perKmPaise: 1600 };
    const muv: FareRule = { ...OUT_SEDAN, id: "muv", vehicleClass: "muv", perKmPaise: 1400 };
    const s = quote({ ...base, vehicleClass: "suv" }, suv);
    const m = quote({ ...base, vehicleClass: "muv" }, muv);
    expect(s.totalPaise).toBeGreaterThan(m.totalPaise);
  });

  it("longer distance never costs less on the same rule", () => {
    let prev = 0;
    for (const km of [10, 50, 100, 180, 209, 299, 400]) {
      const t = quote({ ...base, routeKm: km }, OUT_SEDAN).totalPaise;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
});

describe("validation", () => {
  const input: QuoteInput = {
    tripType: "outstation_round_trip",
    vehicleClass: "sedan",
    start: "2026-11-01T06:00:00+05:30",
    end: "2026-11-01T20:00:00+05:30",
    routeKm: 100,
  };
  it.each([
    ["rule for another vehicle", { ...input, vehicleClass: "suv" }, OUT_SEDAN, "rule_mismatch"],
    ["round trip without end", { ...input, end: undefined }, OUT_SEDAN, "missing_input"],
    ["missing distance", { ...input, routeKm: undefined }, OUT_SEDAN, "missing_input"],
    ["negative distance", { ...input, routeKm: -5 }, OUT_SEDAN, "invalid_input"],
    ["end before start", { ...input, end: "2026-10-31T06:00:00+05:30" }, OUT_SEDAN, "invalid_input"],
    [
      "rule without per-km",
      input,
      { ...OUT_SEDAN, perKmPaise: undefined } as unknown as FareRule,
      "missing_rule_field",
    ],
  ] as const)("%s", (_n, i, r, code) => {
    try {
      quote(i as QuoteInput, r);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(FareError);
      expect((e as FareError).code).toBe(code);
    }
  });

  it("rejects datetimes without an offset", () => {
    expect(() => quote({ ...input, start: "2026-11-01T06:00:00" }, OUT_SEDAN)).toThrow(RangeError);
  });
});

describe("selectRule", () => {
  it("picks the highest version", () => {
    const r = selectRule([OUT_SEDAN, { ...OUT_SEDAN, version: 3 }], "sedan", "outstation_round_trip");
    expect(r.version).toBe(3);
  });
  it("refuses ambiguous rules", () => {
    expect(() =>
      selectRule([OUT_SEDAN, { ...OUT_SEDAN, id: "dup" }], "sedan", "outstation_round_trip"),
    ).toThrow(FareError);
  });
  it("refuses when no rule exists", () => {
    expect(() => selectRule([OUT_SEDAN], "tempo", "local")).toThrow(FareError);
  });
});
