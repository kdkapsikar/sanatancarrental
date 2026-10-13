import { calendarDays, nightsSpanned, toIstMinutes } from "./time.js";
import type { FareRule, Paise, Quote, QuoteInput, QuoteLine, QuoteNote } from "./types.js";

export class FareError extends Error {
  constructor(
    readonly code:
      | "rule_mismatch"
      | "missing_input"
      | "invalid_input"
      | "missing_rule_field"
      | "unknown_package",
    message: string,
  ) {
    super(message);
    this.name = "FareError";
  }
}

function req<T>(v: T | undefined, code: FareError["code"], what: string): T {
  if (v === undefined || v === null) throw new FareError(code, `${what} is required`);
  return v;
}

function assertNonNegInt(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new FareError("invalid_input", `${what} must be a non-negative integer (paise)`);
  }
}

/** Distances are billed in whole km, rounded up. */
const ceilKm = (km: number) => Math.ceil(km - 1e-9);

/** GST and percentage maths round half-up to whole paise. */
const pct = (amount: Paise, percent: number) => Math.round((amount * percent) / 100);

function line(
  code: QuoteLine["code"],
  quantity: number,
  unitPaise: Paise,
  taxable: boolean,
  params?: QuoteLine["params"],
): QuoteLine {
  return {
    code,
    quantity,
    unitPaise,
    amountPaise: quantity * unitPaise,
    taxable,
    ...(params ? { params } : {}),
  };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Build an itemised quote. Pure and deterministic: same input + same rule version → same quote.
 * This is the only place a fare is computed. UI, bot and invoices call this.
 */
export function quote(input: QuoteInput, rule: FareRule): Quote {
  if (rule.tripType !== input.tripType || rule.vehicleClass !== input.vehicleClass) {
    throw new FareError(
      "rule_mismatch",
      `rule ${rule.id} is for ${rule.vehicleClass}/${rule.tripType}, not ${input.vehicleClass}/${input.tripType}`,
    );
  }

  const lines: QuoteLine[] = [];
  const inclusions: QuoteNote[] = [];
  const exclusions: QuoteNote[] = [];
  let billableKm: number | null = null;

  const startMin = toIstMinutes(input.start);
  const endMin = input.end ? toIstMinutes(input.end) : startMin;
  if (endMin < startMin) throw new FareError("invalid_input", "end is before start");
  const days = calendarDays(startMin, endMin);
  const nights = rule.nightHalt
    ? nightsSpanned(startMin, endMin, rule.nightHalt.windowStart, rule.nightHalt.windowEnd)
    : 0;

  switch (input.tripType) {
    case "outstation_one_way":
    case "outstation_round_trip": {
      const perKm = req(rule.perKmPaise, "missing_rule_field", "rule.perKmPaise");
      const minPerDay = req(rule.minKmPerDay, "missing_rule_field", "rule.minKmPerDay");
      const routeKm = req(input.routeKm, "missing_input", "routeKm");
      if (routeKm <= 0) throw new FareError("invalid_input", "routeKm must be positive");
      if (input.tripType === "outstation_round_trip" && !input.end) {
        throw new FareError("missing_input", "end is required for a round trip");
      }

      let actualKm: number;
      let returnKm = 0;
      if (input.tripType === "outstation_one_way") {
        const returnPct = req(rule.oneWayReturnPercent, "missing_rule_field", "rule.oneWayReturnPercent");
        returnKm = ceilKm((routeKm * returnPct) / 100);
        actualKm = ceilKm(routeKm);
      } else {
        actualKm = ceilKm(routeKm * 2 + (input.extraKm ?? 0));
      }
      const minimumKm = minPerDay * days;
      const chargedTravelKm = actualKm + returnKm;
      billableKm = Math.max(chargedTravelKm, minimumKm);

      lines.push(line("base_km", actualKm, perKm, true, { km: actualKm }));
      if (returnKm > 0) {
        lines.push(
          line("one_way_return", returnKm, perKm, true, { percent: rule.oneWayReturnPercent ?? 0 }),
        );
      }
      if (minimumKm > chargedTravelKm) {
        lines.push(
          line("minimum_km_applied", minimumKm - chargedTravelKm, perKm, true, {
            minKmPerDay: minPerDay,
            days,
          }),
        );
      }
      inclusions.push({ code: "minimum_km_rule", params: { minKmPerDay: minPerDay, days } });
      exclusions.push({ code: "extra_km_beyond_estimate", params: { perKmPaise: perKm } });

      if (rule.driverAllowancePerDayPaise) {
        lines.push(line("driver_allowance", days, rule.driverAllowancePerDayPaise, true));
        inclusions.push({ code: "driver_allowance_included", params: { days } });
      }
      if (rule.nightHalt && nights > 0) {
        lines.push(line("night_halt", nights, rule.nightHalt.perNightPaise, true));
        inclusions.push({ code: "night_halt_included", params: { nights } });
      }
      break;
    }

    case "local": {
      const code = req(input.localPackage, "missing_input", "localPackage");
      const pkg = rule.local?.find((p) => p.code === code);
      if (!pkg) throw new FareError("unknown_package", `no local package ${code} in rule ${rule.id}`);
      lines.push(line("local_package", 1, pkg.pricePaise, true, { hours: pkg.hours, km: pkg.km }));
      const extraKm = Math.max(0, ceilKm(input.usedKm ?? 0) - pkg.km);
      const extraHours = Math.max(0, Math.ceil((input.usedHours ?? 0) - pkg.hours - 1e-9));
      if (extraKm > 0) lines.push(line("local_extra_km", extraKm, pkg.extraKmPaise, true));
      if (extraHours > 0) lines.push(line("local_extra_hours", extraHours, pkg.extraHourPaise, true));
      billableKm = Math.max(pkg.km, ceilKm(input.usedKm ?? 0));
      exclusions.push({ code: "extra_km_beyond_estimate", params: { perKmPaise: pkg.extraKmPaise } });
      break;
    }

    case "airport_transfer": {
      const a = req(rule.airport, "missing_rule_field", "rule.airport");
      const routeKm = req(input.routeKm, "missing_input", "routeKm");
      lines.push(line("airport_base", 1, a.basePaise, true, { includedKm: a.includedKm }));
      const extra = Math.max(0, ceilKm(routeKm) - a.includedKm);
      if (extra > 0) lines.push(line("airport_extra_km", extra, a.extraKmPaise, true));
      billableKm = Math.max(a.includedKm, ceilKm(routeKm));
      break;
    }
  }

  // Waiting
  if (rule.waiting && (input.expectedWaitingMinutes ?? 0) > 0) {
    const over = Math.max(0, (input.expectedWaitingMinutes ?? 0) - rule.waiting.freeMinutes);
    const blocks = Math.ceil(over / rule.waiting.blockMinutes);
    if (blocks > 0) {
      lines.push(
        line("waiting", blocks, rule.waiting.perBlockPaise, true, {
          blockMinutes: rule.waiting.blockMinutes,
          freeMinutes: rule.waiting.freeMinutes,
        }),
      );
    }
  }
  if (rule.waiting) {
    exclusions.push({
      code: "waiting_beyond_estimate",
      params: {
        freeMinutes: rule.waiting.freeMinutes,
        blockMinutes: rule.waiting.blockMinutes,
        perBlockPaise: rule.waiting.perBlockPaise,
      },
    });
  }

  // Airport fee (entry/parking levy at the airport), once per airport end.
  const airportEnds = Number(!!input.pickupIsAirport) + Number(!!input.dropIsAirport);
  if (rule.airportFeePaise && airportEnds > 0) {
    lines.push(line("airport_fee", airportEnds, rule.airportFeePaise, false));
  }

  // Tolls and parking: included as a stated amount, or excluded and paid at actuals.
  if (rule.toll === "included") {
    const t = req(input.tollEstimatePaise, "missing_input", "tollEstimatePaise (toll is included)");
    assertNonNegInt(t, "tollEstimatePaise");
    if (t > 0) lines.push(line("toll", 1, t, false));
    inclusions.push({ code: "toll_included" });
  } else {
    exclusions.push({ code: "toll_at_actuals" });
  }
  if (rule.parking === "included") {
    const p = req(input.parkingEstimatePaise, "missing_input", "parkingEstimatePaise (parking is included)");
    assertNonNegInt(p, "parkingEstimatePaise");
    if (p > 0) lines.push(line("parking", 1, p, false));
    inclusions.push({ code: "parking_included" });
  } else {
    exclusions.push({ code: "parking_at_actuals" });
  }

  // Border tax per state entered.
  const states = [...new Set(input.statesEntered ?? [])].filter((s) => s !== rule.homeState).sort();
  for (const state of states) {
    const tax = rule.borderTax?.[state];
    if (typeof tax === "number") {
      lines.push(line("border_tax", 1, tax, false, { state }));
    } else {
      exclusions.push({ code: "border_tax_at_actuals", params: { state } });
    }
  }

  const taxable = lines.filter((l) => l.taxable).reduce((s, l) => s + l.amountPaise, 0);
  const subtotalPaise = lines.reduce((s, l) => s + l.amountPaise, 0);
  const gstPaise = pct(taxable, rule.gstPercent);
  if (gstPaise > 0) {
    lines.push({
      code: "gst",
      quantity: 1,
      unitPaise: gstPaise,
      amountPaise: gstPaise,
      taxable: false,
      params: { percent: rule.gstPercent },
    });
    inclusions.push({ code: "gst_included", params: { percent: rule.gstPercent } });
  }

  for (const l of lines) assertNonNegInt(l.amountPaise, `line ${l.code}`);

  return {
    currency: "INR",
    ruleId: rule.id,
    ruleVersion: rule.version,
    lines,
    inclusions,
    exclusions,
    billableKm,
    days,
    nights,
    subtotalPaise,
    gstPaise,
    totalPaise: subtotalPaise + gstPaise,
    fingerprint: stable({ input, rule: { id: rule.id, version: rule.version } }),
  };
}

/** Pick the active rule for a trip; throws if zero or more than one match (ambiguous pricing). */
export function selectRule(
  rules: readonly FareRule[],
  vehicleClass: string,
  tripType: FareRule["tripType"],
): FareRule {
  const matches = rules.filter((r) => r.vehicleClass === vehicleClass && r.tripType === tripType);
  if (matches.length === 0) {
    throw new FareError("rule_mismatch", `no fare rule for ${vehicleClass}/${tripType}`);
  }
  const top = Math.max(...matches.map((r) => r.version));
  const latest = matches.filter((r) => r.version === top);
  if (latest.length > 1) {
    throw new FareError("rule_mismatch", `ambiguous fare rules for ${vehicleClass}/${tripType}`);
  }
  return latest[0]!;
}
