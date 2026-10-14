/**
 * WhatsApp Cloud API channel for e-Taxi (stub-ready: runs only when all WHATSAPP_* credentials
 * are set). Inbound webhook → same AssistantService as the website → one reply per message.
 *
 * - Signature: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body), compared in
 *   constant time.
 * - Idempotent: webhooks are retried, so each message id is handled once (whatsapp_inbound).
 * - Replies are free-form messages inside the 24-hour customer-service window only: we never
 *   start a conversation or send templates/marketing from here.
 * - Proposals become Confirm/Cancel reply buttons; only the sender can confirm (ownerRef = wa_id).
 * - The thread (last few turns) is stored so the assistant has context; WhatsApp has no
 *   browser-side history. See README for the retention note.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import type { AssistantConfig } from "@cab/config";
import { conversationMessages, conversations, whatsappInbound, type Db } from "@cab/db";
import { cancelProposal, confirmProposal } from "../proposals";
import type { AssistantService } from "../service";
import type { ProposalView } from "../tools";
import type { HistoryTurn, Locale, QuickReply } from "../types";

export interface InboundMessage {
  id: string;
  /** Sender wa_id (digits, with country code). */
  from: string;
  profileName: string | null;
  text: string | null;
  /** Reply-button id, when the person tapped a button. */
  buttonId: string | null;
}

export interface WhatsAppSender {
  send(payload: Record<string, unknown>): Promise<void>;
}

export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(header.slice(7), "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET handshake: echo hub.challenge when the verify token matches. */
export function verifyHandshake(params: URLSearchParams, verifyToken: string): string | null {
  return params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken
    ? params.get("hub.challenge")
    : null;
}

type Webhook = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body?: string };
          interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
          button?: { text?: string; payload?: string };
        }>;
      };
    }>;
  }>;
};

export function parseInbound(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of (body as Webhook)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const names = new Map((change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));
      for (const m of change.value?.messages ?? []) {
        const reply = m.interactive?.button_reply;
        out.push({
          id: m.id,
          from: m.from,
          profileName: names.get(m.from) ?? null,
          text: m.type === "text" ? (m.text?.body ?? null) : (reply?.title ?? m.button?.text ?? null),
          buttonId: reply?.id ?? m.button?.payload ?? null,
        });
      }
    }
  }
  return out;
}

export function graphSender(config: AssistantConfig, fetchImpl: typeof fetch = fetch): WhatsAppSender {
  const url = `${config.WHATSAPP_API_BASE}/${config.WHATSAPP_GRAPH_VERSION}/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  return {
    async send(payload) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      });
      if (!res.ok) throw new Error(`WhatsApp send failed: HTTP ${res.status}`);
    },
  };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const detectLocale = (text: string): Locale => (/[ऀ-ॿ]/.test(text) ? "mr" : "en");

function textMessage(to: string, body: string) {
  return { to, type: "text", text: { body: clip(body, 4096), preview_url: false } };
}

function buttonsMessage(to: string, body: string, buttons: Array<{ id: string; title: string }>) {
  return {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: clip(body, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: clip(b.id, 256), title: clip(b.title, 20) } })) },
    },
  };
}

export interface WhatsAppDeps {
  db: Db;
  service: AssistantService;
  sender: WhatsAppSender;
  historyTurns?: number;
  /** Absolute site origin: tool links are relative and must be absolute on WhatsApp. */
  siteUrl?: string;
}

export type HandleResult = "duplicate" | "rate_limited" | "confirmed" | "cancelled" | "answered" | "ignored";

export async function handleInbound(deps: WhatsAppDeps, msg: InboundMessage): Promise<HandleResult> {
  const { db, service, sender } = deps;
  const inserted = await db.insert(whatsappInbound).values({ messageId: msg.id }).onConflictDoNothing().returning();
  if (inserted.length === 0) return "duplicate";
  if (!msg.text && !msg.buttonId) return "ignored";

  const rejection = service.admit(`wa:${msg.from}`);
  if (rejection) {
    await sender.send(textMessage(msg.from, rejection.message));
    return "rate_limited";
  }

  // Confirm / Cancel buttons on a proposal card.
  const action = /^(confirm|cancel):([0-9a-f-]{36})$/.exec(msg.buttonId ?? "");
  if (action) {
    const [, verb, id] = action;
    if (verb === "confirm") {
      const r = await confirmProposal(db, id!, { ownerRef: msg.from });
      await sender.send(
        textMessage(msg.from, r.ok ? "Sent. Our team will call you back." : "That request has expired or was already handled. Ask again and I'll prepare a new one."),
      );
      return "confirmed";
    }
    await cancelProposal(db, id!, { ownerRef: msg.from });
    await sender.send(textMessage(msg.from, "Cancelled. Nothing was saved."));
    return "cancelled";
  }

  // Quick-reply buttons carry the message to send in their id.
  const userText = msg.buttonId?.startsWith("say:") ? msg.buttonId.slice(4) : (msg.text ?? "");

  const [conv] = await db
    .insert(conversations)
    .values({ channel: "whatsapp", externalThreadId: msg.from, locale: detectLocale(userText) })
    .onConflictDoUpdate({ target: [conversations.channel, conversations.externalThreadId], set: { locale: detectLocale(userText) } })
    .returning({ id: conversations.id });
  const recent = await db
    .select()
    .from(conversationMessages)
    .where(and(eq(conversationMessages.conversationId, conv!.id)))
    .orderBy(desc(conversationMessages.createdAt))
    .limit((deps.historyTurns ?? 8) * 2);
  const history: HistoryTurn[] = recent
    .reverse()
    .filter((m) => m.role === "customer" || m.role === "bot")
    .map((m) => ({ role: m.role === "customer" ? "user" : "assistant", text: m.body }));
  await db.insert(conversationMessages).values({ conversationId: conv!.id, role: "customer", body: userText });

  let text = "";
  const proposals: ProposalView[] = [];
  let quick: QuickReply[] = [];
  await service.chat({
    message: userText,
    history,
    locale: detectLocale(userText),
    channel: "whatsapp",
    ownerRef: msg.from,
    signal: new AbortController().signal,
    emit: (e) => {
      if (e.type === "text") text += e.delta;
      else if (e.type === "proposal") proposals.push(e.proposal);
      else if (e.type === "quick_replies") quick = e.options;
      else if (e.type === "error") text = text || e.message;
    },
  });
  text = text.trim() || "Sorry, I couldn't answer just now.";
  if (deps.siteUrl) {
    const origin = deps.siteUrl.replace(/\/$/, "");
    text = text.replace(/(^|\s)(\/(?:en|hi|mr)(?:\/[\w-]+)+)/g, (_m, pre: string, path: string) => `${pre}${origin}${path}`);
  }
  await db.insert(conversationMessages).values({ conversationId: conv!.id, role: "bot", body: text });

  const p = proposals[0];
  if (p) {
    await sender.send(
      buttonsMessage(msg.from, `${text}\n\n${p.summary}`, [
        { id: `confirm:${p.id}`, title: "Confirm" },
        { id: `cancel:${p.id}`, title: "Cancel" },
      ]),
    );
  } else if (quick.length) {
    await sender.send(buttonsMessage(msg.from, text, quick.map((q) => ({ id: `say:${q.message}`, title: q.label }))));
  } else {
    await sender.send(textMessage(msg.from, text));
  }
  return "answered";
}

/** Oldest-first transcript of a WhatsApp thread (for the ops console later). */
export async function threadMessages(db: Db, waId: string) {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.channel, "whatsapp"), eq(conversations.externalThreadId, waId)))
    .limit(1);
  if (!conv) return [];
  return db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, conv.id)).orderBy(asc(conversationMessages.createdAt));
}
