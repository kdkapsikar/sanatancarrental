import { assistant } from "@/lib/assistant";
import { preflight, withCors } from "@/lib/cors";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return withCors(req, Response.json({ mode: assistant.mode, name: assistant.name }));
}

export const OPTIONS = preflight;
