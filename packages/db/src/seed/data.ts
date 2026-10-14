/**
 * Seed content. Rules (plan §10, session brief):
 * - Only facts we can cite. Coordinates and hi/mr names come from Wikipedia (secondary source,
 *   fetched 2026-10-14 into wikipedia-2026-10-14.json). Nothing else is filled in.
 * - Distances, drive times, tolls, opening days/hours and fees are NULL and listed in
 *   needs_verification. Never fill them from memory or competitor pages.
 * - verified_source names where the non-null fields came from; it is not a human sign-off.
 */
import type { NeedsVerification } from "../schema/types.js";
import wiki from "./wikipedia-2026-10-14.json" with { type: "json" };

export const SOURCE_FETCHED_AT = "2026-10-14T00:00:00+05:30";

const HERITAGE_GAPS: NeedsVerification = {
  closedDays: "Weekly closing day not verified with the managing authority.",
  openingHours: "Visiting hours not verified with the managing authority.",
  entryFeesPaise: "Entry fees not verified with the managing authority.",
  description: "Needs the client's first-hand content (plan §6.3 local expert notes).",
};
const TEMPLE_GAPS: NeedsVerification = {
  closedDays: "Temple schedule (darshan timings, closures) not verified with the temple trust.",
  openingHours: "Darshan timings not verified with the temple trust.",
  entryFeesPaise: "Entry is typically free but special-darshan charges are unverified.",
  description: "Needs the client's first-hand content.",
};

type PlaceSeed = {
  slug: string;
  aliases: string[];
  nameEn?: string;
  nameHi?: string;
  district?: string | null;
  unescoSite?: boolean | null;
  needsVerification: NeedsVerification;
};

/** 1 origin city + 15 destinations. Kind, coordinates and hi/mr names come from the JSON source. */
export const PLACE_SEEDS: PlaceSeed[] = [
  {
    slug: "chhatrapati-sambhajinagar",
    nameEn: "Chhatrapati Sambhajinagar",
    // Wikipedia's hi title is still "Aurangabad"; this is the official renamed form.
    nameHi: "छत्रपति संभाजीनगर",
    aliases: ["Aurangabad", "Sambhajinagar", "औरंगाबाद", "संभाजीनगर", "छत्रपती संभाजीनगर", "छत्रपति संभाजीनगर"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: {
      description: "Needs the client's first-hand content.",
      railwayStationCode:
        "One travel guide says the station code changed to CPSN on 25 Oct 2025; not verified with Indian Railways.",
    },
  },
  {
    slug: "sambhajinagar-airport",
    aliases: ["Aurangabad Airport", "IXU", "Chikkalthana Airport", "Chhatrapati Sambhajinagar Airport"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: {
      name: "Wikipedia lists 'Aurangabad Airport'; current official name after the city rename is unverified.",
      description: "Needs the client's first-hand content.",
    },
  },
  {
    slug: "ajanta-caves",
    aliases: ["Ajanta", "Ajintha", "अजिंठा", "अजंता"],
    district: "Chhatrapati Sambhajinagar",
    unescoSite: true,
    needsVerification: {
      ...HERITAGE_GAPS,
      closedDays:
        "Two travel guides (travelindiasmart.com, indiamapped.in) say closed Monday; not verified with ASI.",
    },
  },
  {
    slug: "ellora-caves",
    aliases: ["Ellora", "Verul", "वेरूळ", "एलोरा"],
    district: "Chhatrapati Sambhajinagar",
    unescoSite: true,
    needsVerification: {
      ...HERITAGE_GAPS,
      closedDays:
        "CONFLICT: travel guides (travelindiasmart.com, indiamapped.in) say closed Tuesday; " +
        "an ASI page snippet (asimustsee.nic.in/ellora-caves.php) says Monday; other secondary sites disagree with each other. " +
        "asimustsee.nic.in did not resolve from our network on 2026-10-14. Verify with ASI before publishing.",
      entryFeesPaise:
        "Plan cites ASI page: Indian ₹40 cash / ₹35 online, other foreign ₹600 cash / ₹550 online. Not re-verified (ASI site unreachable).",
    },
  },
  {
    slug: "grishneshwar-temple",
    aliases: ["Grishneshwar", "Ghrishneshwar", "Ghushmeshwar", "घृष्णेश्वर"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: TEMPLE_GAPS,
  },
  {
    slug: "daulatabad-fort",
    aliases: ["Daulatabad", "Devagiri", "Deogiri", "दौलताबाद", "देवगिरी"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: HERITAGE_GAPS,
  },
  {
    slug: "bibi-ka-maqbara",
    aliases: ["Bibi ka Maqbara", "Mini Taj", "बीबी का मकबरा"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: HERITAGE_GAPS,
  },
  {
    slug: "khuldabad",
    aliases: ["Khultabad", "खुलताबाद"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: { description: "Needs the client's first-hand content." },
  },
  {
    slug: "shirdi",
    aliases: ["Shirdi Sai Baba", "शिर्डी"],
    district: null,
    needsVerification: {
      district: "District name after the Ahmednagar → Ahilyanagar rename not verified.",
      description: "Needs the client's first-hand content.",
    },
  },
  {
    slug: "shani-shingnapur",
    aliases: ["Shingnapur", "Shani Shinganapur", "शनि शिंगणापूर"],
    district: null,
    needsVerification: {
      district: "District name after the Ahmednagar → Ahilyanagar rename not verified.",
      description: "Needs the client's first-hand content.",
    },
  },
  {
    slug: "nashik",
    aliases: ["Nasik", "नाशिक"],
    district: "Nashik",
    needsVerification: {
      description: "Needs the client's first-hand content (Kumbh 2026–28 hub).",
    },
  },
  {
    slug: "trimbakeshwar-temple",
    aliases: ["Trimbakeshwar", "Trimbak", "त्र्यंबकेश्वर"],
    district: "Nashik",
    needsVerification: TEMPLE_GAPS,
  },
  {
    slug: "pune",
    aliases: ["Poona", "पुणे"],
    district: "Pune",
    needsVerification: { description: "Needs the client's first-hand content." },
  },
  {
    slug: "mumbai",
    aliases: ["Bombay", "मुंबई"],
    district: null,
    needsVerification: { description: "Needs the client's first-hand content." },
  },
  {
    slug: "lonar-crater",
    aliases: ["Lonar", "Lonar Lake", "लोणार"],
    district: "Buldhana",
    needsVerification: {
      ...HERITAGE_GAPS,
      kind: "Seeded as 'nature'; visiting rules (forest/ASI temples around the lake) unverified.",
    },
  },
  {
    slug: "paithan",
    aliases: ["Pratishthan", "पैठण"],
    district: "Chhatrapati Sambhajinagar",
    needsVerification: { description: "Needs the client's first-hand content (Paithani weaving: client to confirm)." },
  },
];

export const WIKI = wiki as Array<{
  slug: string;
  kind: string;
  wikipediaTitle: string;
  source: string;
  lat: number | null;
  lng: number | null;
  hi: string | null;
  mr: string | null;
}>;

const ROUTE_GAPS: NeedsVerification = {
  distanceKm: "Road distance not sourced. Measure with the chosen maps provider; do not copy competitor figures.",
  driveMinutes: "Drive time not sourced.",
  tollEstimatePaise: "Toll estimate not sourced (NHAI / FASTag calculator).",
  stopPlaceIds: "Suggested stops need the client's route knowledge.",
  bestSeason: "Season advice needs the client's input.",
  notes: "Needs the client's first-hand content.",
};

/** 20 routes: 15 from the city, 5 airport transfers to the main sights. */
export const ROUTE_SEEDS: Array<{
  origin: string;
  destination: string;
  statesEntered?: string[];
  extraGaps?: NeedsVerification;
}> = [
  { origin: "chhatrapati-sambhajinagar", destination: "sambhajinagar-airport" },
  { origin: "chhatrapati-sambhajinagar", destination: "ajanta-caves" },
  {
    origin: "chhatrapati-sambhajinagar",
    destination: "ellora-caves",
    extraGaps: { closedDayWarning: "Depends on unresolved Ellora closing-day conflict." },
  },
  { origin: "chhatrapati-sambhajinagar", destination: "grishneshwar-temple" },
  { origin: "chhatrapati-sambhajinagar", destination: "daulatabad-fort" },
  { origin: "chhatrapati-sambhajinagar", destination: "bibi-ka-maqbara" },
  { origin: "chhatrapati-sambhajinagar", destination: "khuldabad" },
  { origin: "chhatrapati-sambhajinagar", destination: "shirdi" },
  { origin: "chhatrapati-sambhajinagar", destination: "shani-shingnapur" },
  { origin: "chhatrapati-sambhajinagar", destination: "nashik" },
  { origin: "chhatrapati-sambhajinagar", destination: "trimbakeshwar-temple" },
  { origin: "chhatrapati-sambhajinagar", destination: "pune" },
  { origin: "chhatrapati-sambhajinagar", destination: "mumbai" },
  { origin: "chhatrapati-sambhajinagar", destination: "lonar-crater" },
  { origin: "chhatrapati-sambhajinagar", destination: "paithan" },
  { origin: "sambhajinagar-airport", destination: "ajanta-caves" },
  { origin: "sambhajinagar-airport", destination: "ellora-caves" },
  { origin: "sambhajinagar-airport", destination: "grishneshwar-temple" },
  { origin: "sambhajinagar-airport", destination: "shirdi" },
  { origin: "sambhajinagar-airport", destination: "lonar-crater" },
].map((r) => ({ ...r, statesEntered: [] as string[] }));

export const routeGaps = (extra?: NeedsVerification): NeedsVerification => ({ ...ROUTE_GAPS, ...extra });

/**
 * Vehicle classes are our own product definitions (not claims about any vendor's fleet).
 * Seat counts exclude the driver.
 */
export const VEHICLE_CLASSES = [
  { code: "sedan", name: { en: "Sedan", hi: "TODO_TRANSLATE: Sedan", mr: "TODO_TRANSLATE: Sedan" }, seats: 4, luggageBags: 2, exampleModels: ["Maruti Dzire", "Toyota Etios", "Honda Amaze"], sortOrder: 1 },
  { code: "muv", name: { en: "MUV (6–7 seats)", hi: "TODO_TRANSLATE: MUV", mr: "TODO_TRANSLATE: MUV" }, seats: 6, luggageBags: 3, exampleModels: ["Maruti Ertiga", "Kia Carens"], sortOrder: 2 },
  { code: "suv", name: { en: "SUV", hi: "TODO_TRANSLATE: SUV", mr: "TODO_TRANSLATE: SUV" }, seats: 6, luggageBags: 3, exampleModels: ["Mahindra Scorpio"], sortOrder: 3 },
  { code: "muv_premium", name: { en: "Premium MUV", hi: "TODO_TRANSLATE: Premium MUV", mr: "TODO_TRANSLATE: Premium MUV" }, seats: 6, luggageBags: 4, exampleModels: ["Toyota Innova Crysta", "Toyota Innova Hycross"], sortOrder: 4 },
  { code: "tempo_traveller", name: { en: "Tempo Traveller", hi: "TODO_TRANSLATE: Tempo Traveller", mr: "TODO_TRANSLATE: Tempo Traveller" }, seats: 12, luggageBags: 8, exampleModels: ["Force Tempo Traveller"], sortOrder: 5 },
];
