import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { readAssistantConfig } from "@cab/config";
import { assistantProposals, consents, conversations, customers, fareRules, routes, type Db } from "@cab/db";
import { AssistantService } from "./service";
import { OfflineAssistant } from "./offline";
import { cancelProposal, confirmProposal } from "./proposals";
import { normalisePhone, runTool, type ToolContext } from "./tools";
import type { AssistantEvent } from "./types";
import { testDb } from "./test-db";

let db: Db;
let close: () => Promise<void>;
const now = new Date("2026-10-14T10:00:00+05:30");
const ctx = (over: Partial<ToolContext> = {}): ToolContext => ({ db, now, locale: "en", channel: "web_chat", ownerRef: null, ...over });

beforeAll(async () => {
  const t = await testDb();
  db = t.db;
  close = () => t.client.end();
  await db.execute(sql`truncate assistant_proposals, consents, conversations, customers cascade`);
}, 120_000);
afterAll(() => close());

async function ask(message: string, over: Partial<ToolContext> = {}) {
  const events: AssistantEvent[] = [];
  const engine = new OfflineAssistant();
  const res = await engine.respond({ message, history: [], ctx: ctx(over), emit: (e) => events.push(e), signal: new AbortController().signal });
  return { ...res, events };
}

describe("tools", () => {
  it("finds places by old name and Devanagari", async () => {
    const a = await runTool("search_places", { query: "Verul" }, ctx());
    expect((a.result["matches"] as { slug: string }[])[0]?.slug).toBe("ellora-caves");
    const b = await runTool("search_places", { query: "अजिंठा" }, ctx());
    expect((b.result["matches"] as { slug: string }[])[0]?.slug).toBe("ajanta-caves");
    const c = await runTool("search_places", { query: "Aurangabad" }, ctx());
    expect((c.result["matches"] as { slug: string }[])[0]?.slug).toBe("chhatrapati-sambhajinagar");
  });

  it("reports flagged facts as not_verified, never as values", async () => {
    const out = await runTool("get_place", { slug: "ellora-caves" }, ctx());
    expect(out.result["weekly_closing_day"]).toMatchObject({ status: "not_verified" });
    expect(String((out.result["weekly_closing_day"] as { reason: string }).reason)).toMatch(/CONFLICT/);
  });

  it("get_quote is unavailable while distances are unverified", async () => {
    const out = await runTool("get_quote", { destination: "shirdi", start: "2026-11-01T08:00:00+05:30" }, ctx());
    expect(out.result["unavailable"]).toBe("distance_not_verified");
  });

  it("get_quote is unavailable without an active rule, and prices only from an active one", async () => {
    await db.update(routes).set({ distanceKm: 120, needsVerification: {} }).where(eq(routes.slug, "chhatrapati-sambhajinagar-to-shirdi"));
    const none = await runTool("get_quote", { destination: "shirdi", start: "2026-11-01T08:00:00+05:30" }, ctx());
    expect(none.result["unavailable"]).toBe("fares_not_published");

    // Test-only active rule (never in seed data).
    await db.insert(fareRules).values({
      vehicleClassCode: "sedan", tripType: "outstation_one_way", version: 99, isActive: true, approvedBy: "test",
      rule: { perKmPaise: 1000, minKmPerDay: 0, oneWayReturnPercent: 0, toll: "at_actuals", parking: "at_actuals", gstPercent: 0, homeState: "MH" },
    });
    try {
      const q = await runTool("get_quote", { destination: "shirdi", start: "2026-11-01T08:00:00+05:30" }, ctx());
      expect(q.result["total_inr"]).toBe(1200);
    } finally {
      await db.delete(fareRules).where(eq(fareRules.version, 99));
      await db.update(routes).set({ distanceKm: null, needsVerification: { distanceKm: "test reset" } }).where(eq(routes.slug, "chhatrapati-sambhajinagar-to-shirdi"));
    }
  });

  it("rejects invalid tool input without throwing", async () => {
    const out = await runTool("get_place", { slug: 5 }, ctx());
    expect(out.isError).toBe(true);
    expect(out.result["error"]).toBe("INVALID_INPUT");
  });

  it("normalises Indian mobile numbers", () => {
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
    expect(normalisePhone("+91-9876543210")).toBe("+919876543210");
    expect(normalisePhone("12345")).toBeNull();
  });
});

describe("offline engine", () => {
  it("answers Ellora's closing day honestly (sources disagree)", async () => {
    const r = await ask("Is Ellora closed on Tuesday?");
    expect(r.text).toMatch(/isn't confirmed/);
    expect(r.text).toMatch(/disagree/);
    expect(r.text).not.toMatch(/closed every/);
  });

  it("answers a Marathi question in Marathi, even on the English page", async () => {
    const r = await ask("वेरूळ लेणी कधी बंद असते?");
    expect(r.text).toMatch(/वेरूळ लेणी/);
    expect(r.text).toMatch(/सुट्टीचा दिवस अजून निश्चित नाही/);
  });

  it("follows the page language", async () => {
    const hi = await ask("Is Ellora closed on Tuesday?", { locale: "hi" });
    expect(hi.text).toMatch(/एलोरा/);
    expect(hi.text).toMatch(/बंद का दिन अभी पक्का नहीं/);
  });

  it.each(["hi", "mr"] as const)("understands its own %s quick replies", async (locale) => {
    const { OFFLINE_STRINGS } = await import("./offline-strings");
    const L = OFFLINE_STRINGS[locale];
    for (const q of [...L.menu.slice(0, 3), L.fareTo("Ellora Caves"), L.howFar("Ellora Caves")]) {
      const r = await ask(q.message, { locale });
      expect(r.text, q.message).not.toBe(L.fallback);
      expect(r.text, q.message).toMatch(/[\u0900-\u097F]/);
    }
  });

  it("never uses the old city name", async () => {
    for (const locale of ["en", "hi", "mr"] as const) {
      const r = await ask("Is this Aurangabad?", { locale });
      expect(r.text).not.toMatch(/aurangabad|औरंगाबाद/i);
      expect(r.text).toMatch(/Chhatrapati Sambhajinagar|छत्रपति संभाजीनगर|छत्रपती संभाजीनगर/);
    }
  });

  it("never invents a fare", async () => {
    const r = await ask("What is the fare to Shirdi?");
    expect(r.text).toMatch(/aren't published yet/);
    expect(r.text).not.toMatch(/₹\s?\d|\d+\s?(rs|rupees|\/km)/i);
    expect(r.events.some((e) => e.type === "quick_replies")).toBe(true);
  });

  it("asks for a number before proposing a call back", async () => {
    const r = await ask("please call me back");
    expect(r.proposals).toHaveLength(0);
    expect(r.text).toMatch(/mobile number/);
  });
});

describe("call-back proposals", () => {
  it("stores nothing until confirmed, then customer + consent + conversation once", async () => {
    const before = await db.select().from(customers);
    const r = await ask("Call me on 98765 43210, my name is Ravi, trip to Ajanta");
    expect(r.proposals).toHaveLength(1);
    expect(await db.select().from(customers)).toHaveLength(before.length);

    const id = r.proposals[0]!.id;
    const ok = await confirmProposal(db, id, { ownerRef: null, now });
    expect(ok.ok).toBe(true);
    const [cust] = await db.select().from(customers).where(eq(customers.phone, "+919876543210"));
    expect(cust?.fullName).toBe("Ravi");
    expect(await db.select().from(consents).where(eq(consents.phone, "+919876543210"))).toHaveLength(1);
    const [conv] = await db.select().from(conversations).where(eq(conversations.externalThreadId, `callback-${id}`));
    expect(conv?.handedOffToHuman).toBe(true);
    expect(conv?.handoffNote).toMatch(/^Trip to Ajanta Caves · trip to Ajanta/);
    expect(r.proposals[0]!.summary).not.toMatch(/9876543210/); // masked on the card

    expect(await confirmProposal(db, id, { ownerRef: null, now })).toEqual({ ok: false, code: "already_handled" });
  });

  it("rejects expired proposals and other owners", async () => {
    const r = await ask("call me back on 9123456789", { channel: "whatsapp", ownerRef: "919123456789" });
    const id = r.proposals[0]!.id;
    expect(await confirmProposal(db, id, { ownerRef: "919000000000", now })).toEqual({ ok: false, code: "not_found" });
    const later = new Date(now.getTime() + 31 * 60_000);
    expect(await confirmProposal(db, id, { ownerRef: "919123456789", now: later })).toEqual({ ok: false, code: "expired" });
  });

  it("can be cancelled once by its owner", async () => {
    const r = await ask("call me back on 9988776655");
    const id = r.proposals[0]!.id;
    expect(await cancelProposal(db, id, { ownerRef: null })).toBe(true);
    expect(await cancelProposal(db, id, { ownerRef: null })).toBe(false);
    const [p] = await db.select().from(assistantProposals).where(eq(assistantProposals.id, id));
    expect(p?.status).toBe("cancelled");
  });
});

describe("service", () => {
  it("runs offline without an API key and rate-limits", async () => {
    const svc = new AssistantService({ config: readAssistantConfig({ ASSISTANT_IP_HOURLY_LIMIT: "2" }), db, now: () => now });
    expect(svc.mode).toBe("offline");
    expect(svc.admit("ip:1")).toBeNull();
    expect(svc.admit("ip:1")).toBeNull();
    expect(svc.admit("ip:1")?.code).toBe("RATE_LIMITED");
    const events: AssistantEvent[] = [];
    await svc.chat({ message: "hello", history: [], locale: "en", channel: "web_chat", ownerRef: null, emit: (e) => events.push(e), signal: new AbortController().signal });
    expect(events.at(-1)).toEqual({ type: "done", mode: "offline" });
  });
});
