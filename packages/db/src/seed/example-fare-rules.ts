/**
 * EXAMPLE fare rules for local development only.
 *
 * These numbers are placeholders chosen to exercise the engine. They are NOT the client's
 * prices, are not derived from competitor pages, and are stored with is_example = true, which a
 * database CHECK prevents from ever being activated. Real rules must be entered by the client
 * as new rows with approved_by set.
 */
import type { fareRules } from "../schema/index.js";

const common = {
  toll: "at_actuals" as const,
  parking: "at_actuals" as const,
  borderTax: {},
  // GST rate/treatment for passenger transport must be confirmed with the client's CA.
  gstPercent: 0,
  homeState: "MH",
};

export const EXAMPLE_FARE_RULES: Array<typeof fareRules.$inferInsert> = [
  {
    vehicleClassCode: "sedan",
    tripType: "outstation_round_trip",
    version: 1,
    isExample: true,
    isActive: false,
    notes: "EXAMPLE ONLY — placeholder values, not client pricing.",
    rule: {
      ...common,
      perKmPaise: 1000,
      minKmPerDay: 250,
      driverAllowancePerDayPaise: 30000,
      nightHalt: { perNightPaise: 30000, windowStart: "22:00", windowEnd: "06:00" },
      waiting: { freeMinutes: 30, blockMinutes: 30, perBlockPaise: 5000 },
    },
  },
  {
    vehicleClassCode: "sedan",
    tripType: "outstation_one_way",
    version: 1,
    isExample: true,
    isActive: false,
    notes: "EXAMPLE ONLY — placeholder values, not client pricing.",
    rule: {
      ...common,
      perKmPaise: 1000,
      minKmPerDay: 250,
      oneWayReturnPercent: 50,
      driverAllowancePerDayPaise: 30000,
    },
  },
];
