import { z } from "zod";
import { confirmProposal } from "@cab/assistant";
import { db } from "@/lib/db";
import { preflight, withCors } from "@/lib/cors";

export const OPTIONS = preflight;

export const dynamic = "force-dynamic";

const MESSAGES = {
  not_found: "That request has expired or was already handled.",
  expired: "That request expired. Ask again and I'll prepare a new one.",
  invalid: "That request is no longer valid.",
  already_handled: "That request was already handled.",
} as const;

/** Confirming a call-back card is the consent event; see confirmProposal(). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withCors(req, await handle(ctx));
}

async function handle({ params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return Response.json({ error: { code: "NOT_FOUND", message: MESSAGES.not_found } }, { status: 404 });
  const r = await confirmProposal(db, id.data, { ownerRef: null });
  if (!r.ok) {
    const status = r.code === "not_found" ? 404 : r.code === "already_handled" ? 409 : 400;
    return Response.json({ error: { code: r.code.toUpperCase(), message: MESSAGES[r.code] } }, { status });
  }
  return Response.json({ result: r.result });
}
