import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { readAssistantConfig } from "@cab/config";
import { consents, type Db } from "@cab/db";
import { AssistantService } from "../service";
import { testDb } from "../test-db";
import { handleInbound, parseInbound, threadMessages, verifyHandshake, verifySignature, type WhatsAppSender } from "./whatsapp";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  const t = await testDb();
  db = t.db;
  close = () => t.client.end();
  await db.execute(sql`truncate whatsapp_inbound, assistant_proposals, consents, conversations, customers cascade`);
}, 120_000);
afterAll(() => close());

const SECRET = "app-secret";
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

const webhook = (id: string, from: string, msg: Record<string, unknown>) => ({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ field: "messages", value: { contacts: [{ wa_id: from, profile: { name: "Asha" } }], messages: [{ id, from, ...msg }] } }] }],
});

function recorder() {
  const sent: Array<Record<string, unknown>> = [];
  const sender: WhatsAppSender = { send: async (p) => void sent.push(p) };
  return { sent, sender };
}
const service = () => new AssistantService({ config: readAssistantConfig({}), db });

describe("signature and handshake", () => {
  const body = JSON.stringify(webhook("m1", "919800000001", { type: "text", text: { body: "hi" } }));
  it("accepts a valid signature", () => expect(verifySignature(body, sign(body), SECRET)).toBe(true));
  it("rejects a tampered body", () => expect(verifySignature(body + " ", sign(body), SECRET)).toBe(false));
  it("rejects a missing or malformed header", () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, "sha1=abc", SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=zz", SECRET)).toBe(false);
  });
  it("echoes the challenge only with the right verify token", () => {
    const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "t", "hub.challenge": "42" });
    expect(verifyHandshake(ok, "t")).toBe("42");
    expect(verifyHandshake(ok, "wrong")).toBeNull();
  });
});

describe("parseInbound", () => {
  it("reads text messages and button replies, ignores status updates", () => {
    const msgs = parseInbound({
      entry: [
        { changes: [{ field: "messages", value: { contacts: [{ wa_id: "91a", profile: { name: "A" } }], messages: [{ id: "1", from: "91a", type: "text", text: { body: "hello" } }] } }] },
        { changes: [{ field: "messages", value: { messages: [{ id: "2", from: "91b", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "confirm:x", title: "Confirm" } } }] } }] },
        { changes: [{ field: "messages", value: { statuses: [{ id: "s" }] } }] },
      ],
    });
    expect(msgs).toEqual([
      { id: "1", from: "91a", profileName: "A", text: "hello", buttonId: null },
      { id: "2", from: "91b", profileName: null, text: "Confirm", buttonId: "confirm:x" },
    ]);
  });
});

describe("handleInbound", () => {
  it("answers once per message id (webhook retries are ignored)", async () => {
    const { sent, sender } = recorder();
    const deps = { db, service: service(), sender, siteUrl: "https://example.test/" };
    const [m] = parseInbound(webhook("wamid.A", "919800000002", { type: "text", text: { body: "Is Ellora closed on Tuesday?" } }));
    expect(await handleInbound(deps, m!)).toBe("answered");
    expect(await handleInbound(deps, m!)).toBe("duplicate");
    expect(sent).toHaveLength(1);
    // Quick replies arrive as reply buttons carrying the message to send.
    const interactive = sent[0]!["interactive"] as { action: { buttons: Array<{ reply: { id: string; title: string } }> } };
    expect(interactive.action.buttons[0]!.reply.id).toMatch(/^say:/);
    expect((sent[0]!["interactive"] as { body: { text: string } }).body.text).toContain("https://example.test/en/places/ellora-caves");
    expect(interactive.action.buttons.every((b) => b.reply.title.length <= 20)).toBe(true);
    const thread = await threadMessages(db, "919800000002");
    expect(thread.map((t) => t.role)).toEqual(["customer", "bot"]);
  });

  it("call back uses the sender's number, and only the sender can confirm", async () => {
    const { sent, sender } = recorder();
    const deps = { db, service: service(), sender };
    const [m] = parseInbound(webhook("wamid.B", "919800000003", { type: "text", text: { body: "Please call me back about a Shirdi trip" } }));
    await handleInbound(deps, m!);
    const buttons = (sent[0]!["interactive"] as { action: { buttons: Array<{ reply: { id: string } }> } }).action.buttons;
    const confirmId = buttons.find((b) => b.reply.id.startsWith("confirm:"))!.reply.id;

    // Someone else tapping the same id gets nothing confirmed.
    const [other] = parseInbound(webhook("wamid.C", "919800000099", { type: "interactive", interactive: { button_reply: { id: confirmId, title: "Confirm" } } }));
    await handleInbound(deps, other!);
    expect(await db.select().from(consents).where(eq(consents.phone, "+919800000003"))).toHaveLength(0);

    const [mine] = parseInbound(webhook("wamid.D", "919800000003", { type: "interactive", interactive: { button_reply: { id: confirmId, title: "Confirm" } } }));
    expect(await handleInbound(deps, mine!)).toBe("confirmed");
    const rows = await db.select().from(consents).where(eq(consents.phone, "+919800000003"));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("whatsapp");
    expect((sent.at(-1)!["text"] as { body: string }).body).toMatch(/call you back/);
  });
});
