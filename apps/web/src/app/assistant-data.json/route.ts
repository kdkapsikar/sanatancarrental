import { buildSnapshot } from "@cab/assistant";
import { db } from "@/lib/db";

// Public data for the in-browser assistant (places, routes, vehicle classes, approved fares).
// Built into a static file on GitHub Pages; served (and refreshed hourly) on a server deployment.
export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  return Response.json(await buildSnapshot(db));
}
