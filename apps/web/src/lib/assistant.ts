import "server-only";
import { readAssistantConfig } from "@cab/config";
import { AssistantService } from "@cab/assistant";
import { db } from "./db";

const g = globalThis as unknown as { __cabAssistant?: AssistantService };
/** One assistant per server process, so limits and the daily budget are shared. */
export const assistant: AssistantService =
  g.__cabAssistant ?? (g.__cabAssistant = new AssistantService({ config: readAssistantConfig(), db }));

/** Client IP for rate limiting (first x-forwarded-for hop behind a proxy). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
