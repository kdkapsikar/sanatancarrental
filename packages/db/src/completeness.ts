import type { LocalisedText, NeedsVerification } from "./schema/types";

/**
 * Completeness = share of required fields that are present AND not flagged in
 * needs_verification. Pages below the index threshold are noindex and left out of the sitemap
 * (plan §7.2.4). Unknown is never treated as complete.
 */
export interface CompletenessResult {
  score: number;
  missing: string[];
}

const TODO = "TODO_TRANSLATE";
const translated = (t: LocalisedText | null | undefined, l: "en" | "hi" | "mr") =>
  !!t?.[l] && !t[l]!.startsWith(TODO);

type Check = [field: string, present: boolean, weight?: number];

function score(checks: Check[], needs: NeedsVerification): CompletenessResult {
  let total = 0;
  let have = 0;
  const missing: string[] = [];
  for (const [field, present, weight = 1] of checks) {
    total += weight;
    // A flag on "name" also covers "name.en" etc.
    const flagged = field in needs || field.split(".")[0]! in needs;
    const ok = present && !flagged;
    if (ok) have += weight;
    else missing.push(field);
  }
  return { score: total ? Math.round((have / total) * 1000) / 1000 : 0, missing };
}

const HERITAGE = new Set(["cave_site", "temple", "fort", "monument"]);

export interface PlaceLike {
  kind: string;
  name: LocalisedText;
  location: { lng: number; lat: number } | null;
  description: LocalisedText | null;
  closedDays: string[] | null;
  openingHours: { open: string; close: string } | null;
  entryFeesPaise: Record<string, number> | null;
  officialTicketUrl: string | null;
  verifiedSource: string | null;
  needsVerification: NeedsVerification;
}

export function placeCompleteness(p: PlaceLike): CompletenessResult {
  const checks: Check[] = [
    ["name.en", translated(p.name, "en")],
    ["name.hi", translated(p.name, "hi")],
    ["name.mr", translated(p.name, "mr")],
    ["location", p.location !== null, 2],
    ["description.en", translated(p.description, "en"), 2],
    ["description.hi", translated(p.description, "hi")],
    ["description.mr", translated(p.description, "mr")],
    ["verifiedSource", !!p.verifiedSource],
  ];
  if (HERITAGE.has(p.kind)) {
    checks.push(
      ["closedDays", p.closedDays !== null, 2],
      ["openingHours", p.openingHours !== null, 2],
      ["entryFeesPaise", p.entryFeesPaise !== null],
    );
  }
  return score(checks, p.needsVerification);
}

export interface RouteLike {
  distanceKm: number | null;
  driveMinutes: number | null;
  tollEstimatePaise: number | null;
  stopPlaceIds: string[] | null;
  bestSeason: LocalisedText | null;
  notes: LocalisedText | null;
  verifiedSource: string | null;
  needsVerification: NeedsVerification;
}

export function routeCompleteness(r: RouteLike): CompletenessResult {
  return score(
    [
      ["distanceKm", r.distanceKm !== null, 3],
      ["driveMinutes", r.driveMinutes !== null, 2],
      ["tollEstimatePaise", r.tollEstimatePaise !== null, 2],
      ["stopPlaceIds", !!r.stopPlaceIds?.length],
      ["bestSeason.en", translated(r.bestSeason, "en")],
      ["notes.en", translated(r.notes, "en"), 2],
      ["notes.hi", translated(r.notes, "hi")],
      ["notes.mr", translated(r.notes, "mr")],
      ["verifiedSource", !!r.verifiedSource],
    ],
    r.needsVerification,
  );
}

export const computeCompleteness = { place: placeCompleteness, route: routeCompleteness };
