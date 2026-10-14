import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  assistantProposals,
  fareRules,
  places,
  routes,
  vehicleClasses,
  type Db,
  type NeedsVerification,
} from "@cab/db";
import { FareError, quote, selectRule, type FareRule } from "@cab/fare-engine";
import type { Channel, Locale } from "./types";

/**
 * Everything a tool may use. Identity (the WhatsApp sender) comes from the channel only:
 * no tool takes it as input, so the model can't act for someone else.
 */
export interface ToolContext {
  db: Db;
  now: Date;
  locale: Locale;
  channel: Channel;
  /** WhatsApp wa_id of the sender; null on the website. */
  ownerRef: string | null;
}

export interface ProposalView {
  id: string;
  kind: "request_callback";
  summary: string;
  expiresAt: string;
}

export interface ToolOutput {
  /** Sent to the model as the tool result (JSON). */
  result: Record<string, unknown>;
  isError?: boolean;
  /** A write action awaiting the person's confirmation. */
  proposal?: ProposalView;
}

export interface AssistantTool {
  name: string;
  description: string;
  schema: z.ZodObject;
  run(input: never, ctx: ToolContext): Promise<ToolOutput>;
}

export const CITY = "chhatrapati-sambhajinagar";
export const PROPOSAL_TTL_MIN = 30;

type PlaceRow = typeof places.$inferSelect;
type RouteRow = typeof routes.$inferSelect;

/** Lowercase, strip punctuation/spaces, so "Chhatrapati Sambhajinagar" ≈ "chhatrapatisambhajinagar". */
export const norm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[\s\-_.,'’()]/g, "");

function names(p: PlaceRow): string[] {
  return [p.slug, p.name.en, p.name.hi, p.name.mr, ...p.aliases].filter((x): x is string => !!x);
}

/** A field's state for the model: verified value, not verified (with reason), or unknown. */
function fact<T>(value: T | null, field: string, needs: NeedsVerification) {
  if (field in needs) return { status: "not_verified", reason: needs[field] };
  if (value === null || value === undefined) return { status: "unknown" };
  return { status: "verified", value };
}

const pageUrl = (ctx: ToolContext, path: string) => `/${ctx.locale}/${path}`;

function placeSummary(p: PlaceRow, ctx: ToolContext) {
  return { slug: p.slug, kind: p.kind, name: p.name, page: pageUrl(ctx, `places/${p.slug}`) };
}

export async function allPlaces(db: Db): Promise<PlaceRow[]> {
  return db.select().from(places).orderBy(asc(places.slug));
}

/** Places mentioned in free text (any script), longest name first; the origin city last. */
export function findPlacesInText(text: string, list: PlaceRow[]): PlaceRow[] {
  const t = norm(text);
  const hits = list
    .map((p) => ({ p, len: Math.max(0, ...names(p).map(norm).filter((n) => n.length >= 3 && t.includes(n)).map((n) => n.length)) }))
    .filter((h) => h.len > 0)
    .sort((a, b) => Number(a.p.slug === CITY) - Number(b.p.slug === CITY) || b.len - a.len);
  return hits.map((h) => h.p);
}

function searchPlaces(query: string, list: PlaceRow[]): PlaceRow[] {
  const q = norm(query);
  if (!q) return [];
  const scored = list
    .map((p) => {
      const ns = names(p).map(norm);
      const score = ns.some((n) => n === q) ? 3 : ns.some((n) => n.startsWith(q)) ? 2 : ns.some((n) => n.includes(q) || (q.includes(n) && n.length >= 4)) ? 1 : 0;
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.p);
}

async function routeWithPlaces(db: Db, r: RouteRow) {
  const list = await allPlaces(db);
  return {
    route: r,
    origin: list.find((p) => p.id === r.originPlaceId)!,
    destination: list.find((p) => p.id === r.destinationPlaceId)!,
  };
}

async function findRoute(db: Db, input: { slug?: string | undefined; destination?: string | undefined; origin?: string | undefined }) {
  if (input.slug) {
    const [r] = await db.select().from(routes).where(eq(routes.slug, input.slug)).limit(1);
    return r ?? null;
  }
  if (!input.destination) return null;
  const list = await allPlaces(db);
  const dest = list.find((p) => p.slug === input.destination) ?? searchPlaces(input.destination, list)[0];
  const orig = list.find((p) => p.slug === (input.origin ?? CITY)) ?? searchPlaces(input.origin ?? CITY, list)[0];
  if (!dest || !orig) return null;
  const [r] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.originPlaceId, orig.id), eq(routes.destinationPlaceId, dest.id)))
    .limit(1);
  return r ?? null;
}

const INDIAN_MOBILE = /^(?:\+?91[\s-]?)?([6-9]\d{9})$/;
export function normalisePhone(raw: string): string | null {
  const m = INDIAN_MOBILE.exec(raw.replace(/[\s-]/g, ""));
  return m ? `+91${m[1]}` : null;
}

const slug = z.string().min(2).max(80).describe("Place slug, e.g. 'ellora-caves' (from search_places)");

export const callbackPayload = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  trip_summary: z.string().trim().min(3).max(300),
  preferred_language: z.enum(["en", "hi", "mr"]).optional(),
  preferred_time: z.string().trim().max(60).optional(),
});

const TOOLS: AssistantTool[] = [
  {
    name: "search_places",
    description:
      "Find destinations by name in any language or old name (Aurangabad, संभाजीनगर, Verul, अजिंठा…). Use before other place tools when you are unsure of the slug.",
    schema: z.object({ query: z.string().min(1).max(80) }),
    async run(input: { query: string }, ctx) {
      const found = searchPlaces(input.query, await allPlaces(ctx.db)).slice(0, 5);
      return { result: { matches: found.map((p) => placeSummary(p, ctx)) } };
    },
  },
  {
    name: "get_place",
    description:
      "Visiting facts for one place: weekly closing day, opening hours, entry fees, UNESCO status. Each fact has a status: verified (state it), not_verified (say it is still being confirmed, and why), or unknown.",
    schema: z.object({ slug }),
    async run(input: { slug: string }, ctx) {
      const [p] = await ctx.db.select().from(places).where(eq(places.slug, input.slug)).limit(1);
      if (!p) return { result: { error: "not_found", slug: input.slug }, isError: true };
      const n = p.needsVerification;
      return {
        result: {
          ...placeSummary(p, ctx),
          unesco_world_heritage: p.unescoSite === true ? true : null,
          weekly_closing_day: fact(p.closedDays, "closedDays", n),
          opening_hours: fact(p.openingHours, "openingHours", n),
          entry_fees_paise: fact(p.entryFeesPaise, "entryFeesPaise", n),
          description: fact(p.description?.[ctx.locale] ?? p.description?.en ?? null, "description", n),
          official_ticket_url: p.officialTicketUrl,
          source: p.verifiedSource,
          completeness: p.completenessScore,
        },
      };
    },
  },
  {
    name: "list_routes",
    description: "Routes we serve, optionally from one origin slug (default: all).",
    schema: z.object({ from: slug.optional() }),
    async run(input: { from?: string }, ctx) {
      const list = await allPlaces(ctx.db);
      const rs = await ctx.db.select().from(routes).orderBy(asc(routes.slug));
      const origin = input.from ? list.find((p) => p.slug === input.from) : null;
      const out = rs
        .filter((r) => !origin || r.originPlaceId === origin.id)
        .map((r) => ({
          slug: r.slug,
          from: list.find((p) => p.id === r.originPlaceId)?.name.en,
          to: list.find((p) => p.id === r.destinationPlaceId)?.name.en,
          page: pageUrl(ctx, `routes/${r.slug}`),
        }));
      return { result: { routes: out } };
    },
  },
  {
    name: "get_route",
    description:
      "Trip facts for a route: road distance, drive time, toll estimate, each with a verification status. Give a route slug, or a destination (origin defaults to Chhatrapati Sambhajinagar).",
    schema: z.object({ slug: z.string().max(120).optional(), destination: z.string().max(80).optional(), origin: z.string().max(80).optional() }),
    async run(input: { slug?: string; destination?: string; origin?: string }, ctx) {
      const r = await findRoute(ctx.db, input);
      if (!r) return { result: { error: "not_found", hint: "Use list_routes to see the routes we serve." }, isError: true };
      const { origin, destination } = await routeWithPlaces(ctx.db, r);
      const n = r.needsVerification;
      return {
        result: {
          slug: r.slug,
          from: origin.name,
          to: destination.name,
          road_distance_km: fact(r.distanceKm, "distanceKm", n),
          drive_minutes: fact(r.driveMinutes, "driveMinutes", n),
          toll_estimate_paise: fact(r.tollEstimatePaise, "tollEstimatePaise", n),
          page: pageUrl(ctx, `routes/${r.slug}`),
        },
      };
    },
  },
  {
    name: "list_vehicle_classes",
    description: "Vehicle classes offered (code, name, seats, luggage). Needed for get_quote.",
    schema: z.object({}),
    async run(_input: never, ctx) {
      const vc = await ctx.db.select().from(vehicleClasses).orderBy(asc(vehicleClasses.sortOrder));
      return { result: { classes: vc.map((v) => ({ code: v.code, name: v.name.en, seats: v.seats, luggage_bags: v.luggageBags })) } };
    },
  },
  {
    name: "get_quote",
    description:
      "The ONLY source of prices. Returns an itemised quote from the fare engine, or unavailable with a reason (fares not yet published, distance not verified). Never state a price that did not come from this tool in this turn.",
    schema: z.object({
      route_slug: z.string().max(120).optional(),
      destination: z.string().max(80).optional(),
      vehicle_class: z.string().max(40).default("sedan"),
      trip_type: z.enum(["outstation_one_way", "outstation_round_trip"]).default("outstation_one_way"),
      start: z.iso.datetime({ offset: true }).describe("ISO 8601 with offset, e.g. 2026-11-02T07:00:00+05:30"),
      end: z.iso.datetime({ offset: true }).optional().describe("Required for round trips"),
    }),
    async run(
      input: { route_slug?: string; destination?: string; vehicle_class: string; trip_type: "outstation_one_way" | "outstation_round_trip"; start: string; end?: string },
      ctx,
    ) {
      const r = await findRoute(ctx.db, { slug: input.route_slug, destination: input.destination });
      if (!r) return { result: { error: "route_not_found" }, isError: true };
      if (r.distanceKm === null || "distanceKm" in r.needsVerification) {
        return { result: { unavailable: "distance_not_verified", message: "No price yet: the road distance for this route is still being verified. Offer a call back." } };
      }
      const rows = await ctx.db.select().from(fareRules).where(eq(fareRules.isActive, true));
      const rules: FareRule[] = rows.map((row) => ({ ...row.rule, id: row.id, version: row.version, vehicleClass: row.vehicleClassCode, tripType: row.tripType }) as FareRule);
      let rule: FareRule;
      try {
        rule = selectRule(rules, input.vehicle_class, input.trip_type);
      } catch {
        return { result: { unavailable: "fares_not_published", message: "No price yet: fares for this vehicle and trip type have not been published. Offer a call back." } };
      }
      try {
        const q = quote(
          {
            tripType: input.trip_type,
            vehicleClass: input.vehicle_class,
            start: input.start,
            ...(input.end ? { end: input.end } : {}),
            routeKm: r.distanceKm,
            statesEntered: r.statesEntered ?? [],
            ...(rule.toll === "included" && r.tollEstimatePaise !== null ? { tollEstimatePaise: r.tollEstimatePaise } : {}),
          },
          rule,
        );
        const inr = (p: number) => Math.round(p) / 100;
        return {
          result: {
            total_inr: inr(q.totalPaise),
            lines: q.lines.map((l) => ({ code: l.code, amount_inr: inr(l.amountPaise), ...l.params })),
            included: q.inclusions.map((x) => ({ code: x.code, ...x.params })),
            not_included: q.exclusions.map((x) => ({ code: x.code, ...x.params })),
            billable_km: q.billableKm,
            days: q.days,
            rule_version: q.ruleVersion,
            quote_fingerprint: q.fingerprint,
          },
        };
      } catch (e) {
        if (e instanceof FareError) return { result: { error: e.code, message: e.message }, isError: true };
        throw e;
      }
    },
  },
  {
    name: "explain_fares",
    description: "How a fare is built: what is in the price and what is paid at actual cost. No amounts.",
    schema: z.object({}),
    async run() {
      return {
        result: {
          built_into_price: ["distance driven (whole km)", "daily minimum distance top-up", "driver allowance per day", "night halt when the trip spans the night", "GST as its own line"],
          paid_at_actual_cost: ["tolls", "parking", "state entry tax outside Maharashtra"],
          promise: "The bill is checked against the saved quote and only changes if the trip itself changes.",
        },
      };
    },
  },
  {
    name: "site_help",
    description: "Help about this service: how booking works, languages, city names, privacy, how facts are verified.",
    schema: z.object({ topic: z.enum(["booking", "languages", "city_names", "privacy", "verification"]) }),
    async run(input: { topic: string }) {
      const HELP: Record<string, string> = {
        booking:
          "Trips are outstation, airport transfers and sightseeing from Chhatrapati Sambhajinagar. Online booking and payment are not open yet; a person from the team calls back with a quote.",
        languages: "The site and assistant work in English, Hindi and Marathi.",
        city_names: "The city is Chhatrapati Sambhajinagar, Maharashtra. Always use this name. Searches with the old name still find the city.",
        privacy:
          "The assistant does not save a phone number unless the person confirms a call-back request. Website chats are not stored on the server.",
        verification:
          "Facts like closing days, timings, fees and distances are shown only after they are confirmed with an official source. Unconfirmed facts are marked as being verified.",
      };
      return { result: { topic: input.topic, text: HELP[input.topic] } };
    },
  },
  {
    name: "request_callback",
    description:
      "PROPOSE a call back from the team (for quotes, bookings, anything you cannot answer). This only creates a card the person must Confirm; nothing is saved until they do. On WhatsApp the sender's number is used if phone is omitted.",
    schema: callbackPayload,
    async run(input: z.infer<typeof callbackPayload>, ctx) {
      const phone = input.phone ? normalisePhone(input.phone) : ctx.channel === "whatsapp" && ctx.ownerRef ? normalisePhone(ctx.ownerRef) : null;
      if (!phone) {
        return { result: { error: "phone_required", message: "Ask for a 10-digit Indian mobile number." }, isError: true };
      }
      const expiresAt = new Date(ctx.now.getTime() + PROPOSAL_TTL_MIN * 60_000);
      const payload = { ...input, phone, preferred_language: input.preferred_language ?? ctx.locale };
      const [row] = await ctx.db
        .insert(assistantProposals)
        .values({ kind: "request_callback", channel: ctx.channel, payload, ownerRef: ctx.ownerRef, expiresAt })
        .returning({ id: assistantProposals.id });
      const masked = phone.replace(/^(\+91)(\d{2})\d{5}(\d{3})$/, "$1 $2xxxxx$3");
      const summary = `Call back ${input.name ? `${input.name} ` : ""}on ${masked} about: ${input.trip_summary}`;
      const proposal: ProposalView = { id: row!.id, kind: "request_callback", summary, expiresAt: expiresAt.toISOString() };
      return {
        result: { status: "awaiting_confirmation", summary, message: "Tell the person to press Confirm on the card. Nothing is saved until then." },
        proposal,
      };
    },
  },
];

export function availableTools(): AssistantTool[] {
  return TOOLS;
}

/** Runs a tool by name with untrusted (model- or script-supplied) input. Never throws. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutput> {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { result: { error: `Tool ${name} is not available.` }, isError: true };
  const parsed = t.schema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      result: { error: "INVALID_INPUT", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      isError: true,
    };
  }
  try {
    return await t.run(parsed.data as never, ctx);
  } catch {
    return { result: { error: "The tool failed unexpectedly. Do not guess the answer." }, isError: true };
  }
}

/** JSON Schema for the API's tool definitions. */
export function toolJsonSchema(t: AssistantTool): Record<string, unknown> {
  const { $schema: _drop, ...schema } = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
  return schema;
}
