import { z } from "zod";
import { cancelProposal } from "@cab/assistant";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  const ok = id.success && (await cancelProposal(db, id.data, { ownerRef: null }));
  if (!ok) return Response.json({ error: { code: "NOT_FOUND", message: "Nothing to cancel." } }, { status: 404 });
  return new Response(null, { status: 204 });
}
