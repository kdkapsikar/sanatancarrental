import { z } from "zod";
import { cancelProposal } from "@cab/assistant";
import { db } from "@/lib/db";
import { preflight, withCors } from "@/lib/cors";

export const OPTIONS = preflight;

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withCors(req, await handle(ctx));
}

async function handle({ params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = z.uuid().safeParse((await params).id);
  const ok = id.success && (await cancelProposal(db, id.data, { ownerRef: null }));
  if (!ok) return Response.json({ error: { code: "NOT_FOUND", message: "Nothing to cancel." } }, { status: 404 });
  return new Response(null, { status: 204 });
}
