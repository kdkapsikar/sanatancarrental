import { allPlaces, findPlacesInText, runTool, CITY, type ProposalView, type ToolOutput } from "./tools";
import type { AssistantEngine, QuickReply, Turn, TurnResult } from "./types";

/**
 * The assistant without an API key (or past the daily budget): keyword/intent matching in
 * English, Hindi and Marathi that calls the SAME tools as the Claude engine and words its answers
 * only from their results. It can't hold a real conversation, but it never makes facts up.
 * Replies are in English for now; hi/mr wording is TODO_TRANSLATE like the rest of the UI.
 */
export class OfflineAssistant implements AssistantEngine {
  readonly mode = "offline" as const;

  async respond(turn: Turn): Promise<TurnResult> {
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
  route: /distance|how far|km|kilomet|drive|travel time|how long|toll|अंतर|दूरी|किती वेळ|कितना समय|टोल/i,
  fareHow: /how (do|are) (fares|prices)|included|inclusive|exclusive|toll|parking|gst/i,
  language: /language|marathi|hindi|english|भाषा|मराठी|हिंदी/i,
  cityName: /aurangabad|sambhajinagar|औरंगाबाद|संभाजीनगर/i,
};

const DAY: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

const MENU: QuickReply[] = [
  { label: "Ellora closing day", message: "Is Ellora closed on Tuesday?" },
  { label: "Fare to Shirdi", message: "What is the fare to Shirdi?" },
  { label: "How fares work", message: "How do fares work?" },
  { label: "Call me back", message: "Please call me back" },
];

type Fact = { status: "verified" | "not_verified" | "unknown"; value?: unknown; reason?: string };

const pendingWhy = (f: Fact) =>
  /CONFLICT/.test(f.reason ?? "")
    ? "published sources disagree, so it is being confirmed with the authority"
    : "it has not been confirmed with an official source yet";

function tomorrowMorningIst(now: Date): string {
  const ist = new Date(now.getTime() + 330 * 60_000 + 86_400_000);
  return `${ist.toISOString().slice(0, 10)}T08:00:00+05:30`;
}

/** "my name is Ravi", "I am Ravi", "मी रवी", "नाम रवि" → Ravi (best effort, optional). */
function nameIn(text: string): string | undefined {
  const m = /(?:my name is|i am|i'm|this is|name[:\s]+|नाव|नाम|मी)\s+([A-Za-zऀ-ॿ][A-Za-zऀ-ॿ .]{0,40})/i.exec(text);
  return m?.[1]?.split(/[.,!?;\n]/)[0]?.replace(/\s+(and|on|my|phone|number|call).*$/i, "").trim() || undefined;
}
const PHONE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;
const phoneIn = (text: string) => PHONE.exec(text)?.[0];

/** What the trip is about, without the phone number, name or "call me back" boilerplate. */
function tripGist(text: string): string {
  return text
    .replace(PHONE, "")
    .replace(/(?:my name is|i am|i'm|this is|नाव|नाम)\s+[^.,!?]+/gi, "")
    .replace(/\b(please|pls|kindly)?\s*(call me back|call back|callback|call me)\b(\s+on)?/gi, "")
    .replace(/\s*[.,]\s*[.,]+/g, ".")
    .replace(/^[\s.,:-]+|[\s.,:-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 200);
}

async function answer(turn: Turn, call: Call): Promise<{ text: string; quickReplies: QuickReply[] }> {
  const t = turn.message.trim();
  const list = await allPlaces(turn.ctx.db);
  const mentioned = findPlacesInText(t, list).filter((p) => p.slug !== CITY);
  const place = mentioned[0];
  const placeName = place ? place.name.en : null;

  // Call back: propose only (Confirm card), never store directly.
  if (has(t, INTENT.callback) || phoneIn(t)) {
    const phone = phoneIn(t);
    if (!phone && !(turn.ctx.channel === "whatsapp" && turn.ctx.ownerRef)) {
      return {
        text: "Happy to arrange a call back from our team. Please send your name and 10-digit mobile number, for example: “Call me on 98xxxxxxxx, my name is Ravi”.",
        quickReplies: [],
      };
    }
    const name = nameIn(t);
    const out = await call("request_callback", {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      trip_summary: [placeName ? `Trip to ${placeName}` : null, tripGist(t) || null].filter(Boolean).join(" · ") || "Call back requested",
      preferred_language: turn.ctx.locale,
    });
    if (out.isError) return { text: "That number doesn't look like a 10-digit Indian mobile number. Could you send it again?", quickReplies: [] };
    return { text: "I've prepared a call-back request. Please check the card below and press Confirm to send it. Nothing is saved until you do.", quickReplies: [] };
  }

  // Fares: only the fare engine (via get_quote) may produce a number.
  if (has(t, INTENT.fare) && !has(t, INTENT.fareHow)) {
    if (!place) {
      const out = await call("explain_fares", {});
      const r = out.result as { built_into_price: string[]; paid_at_actual_cost: string[] };
      return {
        text: `Every quote is itemised. Built into the price: ${r.built_into_price.join(", ")}. Paid at actual cost: ${r.paid_at_actual_cost.join(", ")}. Tell me where you're going and I'll check the fare.`,
        quickReplies: MENU.slice(1, 2),
      };
    }
    const out = await call("get_quote", { destination: place.slug, start: tomorrowMorningIst(turn.ctx.now) });
    const r = out.result;
    if (typeof r["total_inr"] === "number") {
      return { text: `A one-way sedan from Chhatrapati Sambhajinagar to ${placeName} comes to ₹${r["total_inr"]} including the listed items. Tolls and parking are paid at actual cost.`, quickReplies: [{ label: "Call me back", message: "Please call me back" }] };
    }
    return {
      text: `Fares to ${placeName} aren't published yet${r["unavailable"] === "distance_not_verified" ? " (the road distance is still being verified)" : ""}. I can ask our team to call you with a quote.`,
      quickReplies: [{ label: "Call me back", message: `Please call me back about a trip to ${placeName}` }],
    };
  }

  if (has(t, INTENT.fareHow)) {
    const out = await call("explain_fares", {});
    const r = out.result as { built_into_price: string[]; paid_at_actual_cost: string[]; promise: string };
    return {
      text: `Built into the price: ${r.built_into_price.join(", ")}. Paid at actual cost: ${r.paid_at_actual_cost.join(", ")}. ${r.promise}`,
      quickReplies: MENU.slice(1, 2),
    };
  }

  // Route facts.
  if (place && has(t, INTENT.route)) {
    const out = await call("get_route", { destination: place.slug });
    if (out.isError) return { text: `I don't have a route to ${placeName} yet.`, quickReplies: MENU };
    const r = out.result as Record<string, Fact | string>;
    const km = r["road_distance_km"] as Fact;
    const mins = r["drive_minutes"] as Fact;
    const parts = [
      km.status === "verified" ? `The road distance is ${km.value} km.` : "The road distance is still being verified.",
      mins.status === "verified" ? `Typical drive time is about ${Math.round(Number(mins.value) / 6) / 10} hours.` : "Drive time is still being verified.",
    ];
    return { text: `${parts.join(" ")} Details: ${r["page"]}`, quickReplies: [{ label: `Fare to ${placeName}`.slice(0, 20), message: `What is the fare to ${placeName}?` }] };
  }

  // Closing day / timings, or a place mentioned on its own.
  if (place) {
    const out = await call("get_place", { slug: place.slug });
    const r = out.result as Record<string, unknown>;
    const closed = r["weekly_closing_day"] as Fact;
    const hours = r["opening_hours"] as Fact;
    const lines: string[] = [];
    if (closed.status === "verified" && Array.isArray(closed.value)) {
      lines.push(closed.value.length ? `${placeName} is closed every ${closed.value.map((d) => DAY[d as string]).join(" and ")}.` : `${placeName} has no weekly closing day.`);
    } else if (["cave_site", "temple", "fort", "monument", "nature"].includes(place.kind)) {
      lines.push(`The weekly closing day for ${placeName} isn't confirmed: ${pendingWhy(closed)}. Please check before you travel.`);
    }
    if (has(t, INTENT.closed)) {
      if (hours.status === "verified") {
        const h = hours.value as { open: string; close: string };
        lines.push(`Opening hours: ${h.open}–${h.close}.`);
      } else if (place.kind !== "city" && place.kind !== "town") lines.push("Opening hours are still being verified.");
    }
    if (r["unesco_world_heritage"]) lines.push("It is a UNESCO World Heritage Site.");
    lines.push(`More: ${r["page"]}`);
    return {
      text: lines.join(" "),
      quickReplies: [
        { label: `Fare to ${placeName}`.slice(0, 20), message: `What is the fare to ${placeName}?` },
        { label: "How far is it?", message: `How far is ${placeName}?` },
      ],
    };
  }

  if (has(t, INTENT.language)) {
    const out = await call("site_help", { topic: "languages" });
    return { text: String(out.result["text"]), quickReplies: MENU };
  }
  if (has(t, INTENT.cityName)) {
    const out = await call("site_help", { topic: "city_names" });
    return { text: String(out.result["text"]), quickReplies: MENU };
  }
  if (has(t, INTENT.greet) || t.length < 3) {
    return {
      text: "Namaste! I can tell you about destinations around Chhatrapati Sambhajinagar, how our fares work, and arrange a call back from our team.",
      quickReplies: MENU,
    };
  }
  return {
    text: "I'm in basic mode and didn't catch that. Try asking about a place (like Ellora or Shirdi), fares, or a call back.",
    quickReplies: MENU,
  };
}
