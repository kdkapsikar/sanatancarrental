import { z } from "zod";
import type { AssistantEvent } from "@cab/assistant";
import { assistant, clientIp } from "@/lib/assistant";
import { corsHeaders, preflight, withCors } from "@/lib/cors";

export const OPTIONS = preflight;

export const dynamic = "force-dynamic";

const chatBody = z.object({
  message: z.string().trim().min(1, "Type a message").max(2000),
  locale: z.enum(["en", "hi", "mr"]).default("en"),
  /** Website chats are not stored on the server: recent turns come from the browser. */
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(30)
    .default([]),
});

/** POST /api/chat: the reply streams back as Server-Sent Events (same protocol as Saathi). */
export async function POST(req: Request) {
  const parsed = chatBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return withCors(req, Response.json({ error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Invalid request" } }, { status: 400 }));
  }
  const rejection = assistant.admit(`ip:${clientIp(req)}`);
  if (rejection) return withCors(req, Response.json({ error: rejection }, { status: 429 }));

  const encoder = new TextEncoder();
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(out) {
      const emit = (e: AssistantEvent) => {
        try {
          out.enqueue(encoder.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          // client went away
        }
      };
      try {
        await assistant.chat({
          message: parsed.data.message,
          history: parsed.data.history,
          locale: parsed.data.locale,
          channel: "web_chat",
          ownerRef: null,
          emit,
          signal: controller.signal,
        });
      } catch (err) {
        console.error("Assistant turn failed", err);
      } finally {
        try {
          out.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...corsHeaders(req),
    },
  });
}
