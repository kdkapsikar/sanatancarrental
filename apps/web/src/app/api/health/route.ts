import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Render's health check: the app is up and the database answers. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
