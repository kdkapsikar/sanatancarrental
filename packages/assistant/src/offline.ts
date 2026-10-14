import { allPlaces, findPlacesInText, runTool, CITY, type ProposalView, type ToolOutput } from "./tools";
import type { AssistantEngine, QuickReply, Turn, TurnResult } from "./types";
import { OFFLINE_STRINGS, replyLocale } from "./offline-strings";

/**
 * The assistant without an API key (or past the daily budget): keyword/intent matching in
 * English, Hindi and Marathi that calls the SAME tools as the Claude engine and words its answers
 * only from their results. It can't hold a real conversation, but it never makes facts up.
 * Replies follow the page language (en/hi/mr); see offline-strings.ts.
 */
export class OfflineAssistant implements AssistantEngine {
  readonly mode = "offline" as const;

  async respond(input: Turn): Promise<TurnResult> {
    // Tools (and the page links they return) use the reply language, not just the page language.
    const turn: Turn = { ...input, ctx: { ...input.ctx, locale: replyLocale(input.ctx.locale, input.message) } };
    const proposals: ProposalView[] = [];
    const call = async (name: string, input: Record<string, unknown>): Promise<ToolOutput> => {
      turn.emit({ type: "tool", name, status: "start" });
      const out = await runTool(name, input, turn.ctx);
      turn.emit({ type: "tool", name, status: out.isError ? "error" : "done" });
      if (out.proposal) {
        proposals.push(out.proposal);
        turn.emit({ type: "proposal", proposal: out.proposal });
      }
      return out;
    };

    const { text, quickReplies } = await answer(turn, call);
    for (const chunk of text.match(/\S+\s*/g) ?? [text]) turn.emit({ type: "text", delta: chunk });
    if (quickReplies.length) turn.emit({ type: "quick_replies", options: quickReplies });
    return { text, proposals, tokens: 0 };
  }
}

type Call = (name: string, input: Record<string, unknown>) => Promise<ToolOutput>;

const has = (t: string, re: RegExp) => re.test(t);
const INTENT = {
  greet: /\b(hi|hello|hey|namaste|namaskar)\b|नमस्ते|नमस्कार|राम राम|हॅलो|हेलो/i,
  callback: /call ?back|call me|callback|contact|speak to|talk to|book|booking|फोन|कॉल|संपर्क|बुक/i,
  fare: /fare|price|cost|rate|charges?|how much|quote|₹|rs\.?|rupees|भाडे|भाड़ा|किराया|दर|किंमत|कीमत|पैसे/i,
  closed: /closed|closing|open|timings?|hours|holiday|visit(ing)? time|बंद|सुट्टी|वेळ|समय|खुला|उघड/i,
  route: /distance|how far|km|kilomet|drive|travel time|how long|toll|अंतर|दूरी|दूर|लांब|किती वेळ|कितना समय|टोल/i,
  fareHow: /how (do|are) (fares|prices)|included|inclusive|exclusive|toll|parking|gst|कसे ठरते|कसं ठरतं|कैसे तय|शामिल|समाविष्ट/i,
  language: /language|marathi|hindi|english|भाषा|मराठी|हिंदी/i,
  cityName: /aurangabad|sambhajinagar|औरंगाबाद|संभाजीनगर/i,
};

type Fact = { status: "verified" | "not_verified" | "unknown"; value?: unknown; reason?: string };

function tomorrowMorningIst(now: Date): string {
  const ist = new Date(now.getTime() + 330 * 60_000 + 86_400_000);
  return `${ist.toISOString().slice(0, 10)}T08:00:00+05:30`;
}

/** "my name is Ravi", "माझे नाव रवी", "मेरा नाम रवि" → Ravi (best effort, optional). */
const NAME = /(?:my name is|i am|i'm|this is|name[:\s]+|माझे नाव|माझं नाव|मेरा नाम|नाव|नाम)\s+([A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F .]{0,40})/i;
function nameIn(text: string): string | undefined {
  const m = NAME.exec(text);
  return (
    m?.[1]
      ?.split(/[.,!?;\n।]/)[0]
      ?.replace(/\s+(and|on|my|phone|number|call|आहे|है)(\s.*)?$/i, "")
      .trim() || undefined
  );
}
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;
const phoneIn = (text: string) => PHONE.exec(text)?.[0];

/** What the trip is about, without the phone number, name or "call me back" boilerplate. */
function tripGist(text: string): string {
  return text
    .replace(PHONE, "")
    .replace(/(?:my name is|i am|i'm|this is|माझे नाव|माझं नाव|मेरा नाम|नाव|नाम)\s+[^.,!?।]+/gi, "")
    .replace(/\b(please|pls|kindly)?\s*(call me back|call back|callback|call me)\b(\s+on)?/gi, "")
    .replace(/\s*[.,]\s*[.,]+/g, ".")
    .replace(/^[\s.,:-]+|[\s.,:-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 200);
}

const VISITABLE = ["cave_site", "temple", "fort", "monument", "nature"];

async function answer(turn: Turn, call: Call): Promise<{ text: string; quickReplies: QuickReply[] }> {
  const t = turn.message.trim();
  const lang = replyLocale(turn.ctx.locale, t);
  const L = OFFLINE_STRINGS[lang];
  const list = await allPlaces(turn.ctx.db);
  const place = findPlacesInText(t, list).filter((p) => p.slug !== CITY)[0];
  const placeName = place ? (place.name[lang] ?? place.name.en) : null;

  // Call back: propose only (Confirm card), never store directly.
  if (has(t, INTENT.callback) || phoneIn(t)) {
    const phone = phoneIn(t);
    if (!phone && !(turn.ctx.channel === "whatsapp" && turn.ctx.ownerRef)) return { text: L.askPhone, quickReplies: [] };
    const name = nameIn(t);
    const out = await call("request_callback", {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      // The ops team reads English summaries; the person's own words follow.
      trip_summary: [place ? `Trip to ${place.name.en}` : null, tripGist(t) || null].filter(Boolean).join(" · ") || "Call back requested",
      preferred_language: lang,
    });
    if (out.isError) return { text: L.badPhone, quickReplies: [] };
    return { text: L.callbackReady, quickReplies: [] };
  }

  // Fares: only the fare engine (via get_quote) may produce a number.
  if (has(t, INTENT.fare) && !has(t, INTENT.fareHow)) {
    if (!place || !placeName) {
      await call("explain_fares", {});
      return { text: `${L.fareExplain(L.join(L.builtIn), L.join(L.actuals))} ${L.fareAskWhere}`, quickReplies: L.menu.slice(1, 2) };
    }
    const out = await call("get_quote", { destination: place.slug, start: tomorrowMorningIst(turn.ctx.now) });
    const r = out.result;
    if (typeof r["total_inr"] === "number") {
      const total = new Intl.NumberFormat(`${lang}-IN`, { style: "currency", currency: "INR" }).format(r["total_inr"]);
      return { text: L.fareQuote(placeName, total), quickReplies: [L.callMe(placeName)] };
    }
    return { text: L.fareNotPublished(placeName, r["unavailable"] === "distance_not_verified"), quickReplies: [L.callMe(placeName)] };
  }

  if (has(t, INTENT.fareHow)) {
    await call("explain_fares", {});
    return { text: `${L.fareExplain(L.join(L.builtIn), L.join(L.actuals))} ${L.promise}`, quickReplies: L.menu.slice(1, 2) };
  }

  // Route facts.
  if (place && placeName && has(t, INTENT.route)) {
    const out = await call("get_route", { destination: place.slug });
    if (out.isError) return { text: L.noRoute(placeName), quickReplies: L.menu };
    const r = out.result as Record<string, Fact | string>;
    const km = r["road_distance_km"] as Fact;
    const mins = r["drive_minutes"] as Fact;
    const parts = [
      km.status === "verified" ? L.distance(km.value) : L.distancePending,
      mins.status === "verified" ? L.driveTime(Math.round(Number(mins.value) / 6) / 10) : L.drivePending,
      L.details(String(r["page"])),
    ];
    return { text: parts.join(" "), quickReplies: [L.fareTo(placeName)] };
  }

  // Closing day / timings, or a place mentioned on its own.
  if (place && placeName) {
    const out = await call("get_place", { slug: place.slug });
    const r = out.result as Record<string, unknown>;
    const closed = r["weekly_closing_day"] as Fact;
    const hours = r["opening_hours"] as Fact;
    const lines: string[] = [];
    if (closed.status === "verified" && Array.isArray(closed.value)) {
      lines.push(closed.value.length ? L.closedEvery(placeName, L.join(closed.value.map((d) => L.days[d as string] ?? String(d)))) : L.noClosingDay(placeName));
    } else if (VISITABLE.includes(place.kind)) {
      lines.push(L.closingUnconfirmed(placeName, /CONFLICT/.test(closed.reason ?? "")));
    }
    if (has(t, INTENT.closed)) {
      if (hours.status === "verified") {
        const h = hours.value as { open: string; close: string };
        lines.push(L.hours(h.open, h.close));
      } else if (VISITABLE.includes(place.kind)) lines.push(L.hoursPending);
    }
    if (r["unesco_world_heritage"]) lines.push(L.unesco);
    lines.push(L.more(String(r["page"])));
    return { text: lines.join(" "), quickReplies: [L.fareTo(placeName), L.howFar(placeName)] };
  }

  if (has(t, INTENT.language)) {
    await call("site_help", { topic: "languages" });
    return { text: L.languages, quickReplies: L.menu };
  }
  if (has(t, INTENT.cityName)) {
    await call("site_help", { topic: "city_names" });
    return { text: L.cityName, quickReplies: L.menu };
  }
  if (has(t, INTENT.greet) || t.length < 3) return { text: L.greeting, quickReplies: L.menu };
  return { text: L.fallback, quickReplies: L.menu };
}
