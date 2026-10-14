import { assistant } from "@/lib/assistant";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ mode: assistant.mode, name: assistant.name });
}
