import { after } from "next/server";
import { readAssistantConfig, whatsappEnabled } from "@cab/config";
import { graphSender, handleInbound, parseInbound, verifyHandshake, verifySignature } from "@cab/assistant/whatsapp";
import { assistant } from "@/lib/assistant";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/settings";

export const dynamic = "force-dynamic";

const config = readAssistantConfig();

/** Meta's subscription handshake. Off (404) until every WHATSAPP_* credential is configured. */
export function GET(req: Request) {
  if (!whatsappEnabled(config)) return new Response("Not found", { status: 404 });
  const challenge = verifyHandshake(new URL(req.url).searchParams, config.WHATSAPP_VERIFY_TOKEN!);
  return challenge ? new Response(challenge, { status: 200 }) : new Response("Forbidden", { status: 403 });
}

/**
 * Inbound messages. The signature is checked on the raw body, the webhook is acknowledged at
 * once (Meta retries slow responses), and replies are sent after the response.
 */
export async function POST(req: Request) {
  if (!whatsappEnabled(config)) return new Response("Not found", { status: 404 });
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), config.WHATSAPP_APP_SECRET!)) {
    return new Response("Invalid signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const messages = parseInbound(body);
  const deps = { db, service: assistant, sender: graphSender(config), historyTurns: config.ASSISTANT_HISTORY_TURNS, siteUrl: SITE_URL };
  after(async () => {
    for (const m of messages) {
      try {
        await handleInbound(deps, m);
      } catch (err) {
        console.error("WhatsApp message failed", m.id, err);
      }
    }
  });
  return new Response("OK", { status: 200 });
}
