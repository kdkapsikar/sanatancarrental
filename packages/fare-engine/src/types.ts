/** All money is integer paise (₹1 = 100 paise). All distances are kilometres. */
export type Paise = number;

export type TripType = "outstation_one_way" | "outstation_round_trip" | "local" | "airport_transfer";

/** How a pass-through cost is handled. "included" means a fixed amount is in the quote. */
export type PassThrough = "included" | "at_actuals";

export interface WaitingRule {
  freeMinutes: number;
  blockMinutes: number;
  perBlockPaise: Paise;
}

export interface NightHaltRule {
  perNightPaise: Paise;
  /** Night window in IST wall-clock "HH:MM". A night counts when the trip spans the whole window. */
  windowStart: string;
  windowEnd: string;
}

export interface LocalPackage {
  code: string; // e.g. "8h80km"
  hours: number;
  km: number;
  pricePaise: Paise;
  extraKmPaise: Paise;
  extraHourPaise: Paise;
}

export interface AirportTransferRule {
  basePaise: Paise;
  includedKm: number;
  extraKmPaise: Paise;
}

/**
 * One versioned fare rule for one vehicle class and trip type.
 * Rules are data (DB rows); the engine never contains a rupee amount.
 */
export interface FareRule {
  id: string;
  version: number;
  vehicleClass: string;
  tripType: TripType;
  /** Outstation only. */
  perKmPaise?: Paise;
  minKmPerDay?: number;
  /**
   * Outstation one-way only: share of the empty return distance billed to the customer,
   * 0 (true one-way rate) to 100 (customer pays full return).
   */
  oneWayReturnPercent?: number;
  driverAllowancePerDayPaise?: Paise;
  nightHalt?: NightHaltRule;
  local?: LocalPackage[];
  airport?: AirportTransferRule;
  toll: PassThrough;
  parking: PassThrough;
  /** Per state code (e.g. "GJ"): fixed paise in the quote, or "at_actuals". Missing = at actuals. */
  borderTax?: Record<string, Paise | "at_actuals">;
  waiting?: WaitingRule;
  /** Charged once per airport end (pickup and/or drop) when set. */
  airportFeePaise?: Paise;
  /**
   * GST on taxable lines. Pass-through costs (tolls, parking, border tax) are not taxed here.
   * Rate and treatment must be confirmed with the client's CA before going live.
   */
  gstPercent: number;
  /** State the operator is based in; crossing into other states may attract border tax. */
  homeState: string;
}

export interface QuoteInput {
  tripType: TripType;
  vehicleClass: string;
  /** ISO 8601 with offset. */
  start: string;
  /** ISO 8601 with offset. Required for round trips and local; optional for one-way. */
  end?: string;
  /** One-way road distance between origin and destination. */
  routeKm?: number;
  /** Round trip: extra km expected at destination (local running). */
  extraKm?: number;
  /** Local: package code and expected usage. */
  localPackage?: string;
  usedKm?: number;
  usedHours?: number;
  pickupIsAirport?: boolean;
  dropIsAirport?: boolean;
  /** States entered other than home state, e.g. ["GJ"]. */
  statesEntered?: string[];
  expectedWaitingMinutes?: number;
  /** Required when toll/parking are "included": the amount built into the quote. */
  tollEstimatePaise?: Paise;
  parkingEstimatePaise?: Paise;
}

/** Line and note codes are i18n keys (messages: quote.line.* / quote.note.*). */
export const QUOTE_LINE_CODES = [
  "base_km",
  "minimum_km_applied",
  "one_way_return",
  "driver_allowance",
  "night_halt",
  "toll",
  "parking",
  "border_tax",
  "waiting",
  "airport_fee",
  "local_package",
  "local_extra_km",
  "local_extra_hours",
  "airport_base",
  "airport_extra_km",
  "gst",
] as const;
export type QuoteLineCode = (typeof QUOTE_LINE_CODES)[number];

export const QUOTE_NOTE_CODES = [
  "toll_at_actuals",
  "parking_at_actuals",
  "border_tax_at_actuals",
  "toll_included",
  "parking_included",
  "driver_allowance_included",
  "night_halt_included",
  "minimum_km_rule",
  "waiting_beyond_estimate",
  "extra_km_beyond_estimate",
  "gst_included",
] as const;
export type QuoteNoteCode = (typeof QUOTE_NOTE_CODES)[number];

/** i18n-ready line: UI renders `code` via messages with `params`; never a free-text label. */
export interface QuoteLine {
  code: QuoteLineCode;
  quantity: number;
  unitPaise: Paise;
  amountPaise: Paise;
  taxable: boolean;
  params?: Record<string, string | number>;
}

export interface QuoteNote {
  code: QuoteNoteCode;
  params?: Record<string, string | number>;
}

export interface Quote {
  currency: "INR";
  ruleId: string;
  ruleVersion: number;
  lines: QuoteLine[];
  inclusions: QuoteNote[];
  exclusions: QuoteNote[];
  billableKm: number | null;
  days: number;
  nights: number;
  subtotalPaise: Paise;
  gstPaise: Paise;
  totalPaise: Paise;
  /** Stable hash input of (input, rule id+version): an invoice must match the quote with this fingerprint. */
  fingerprint: string;
}
