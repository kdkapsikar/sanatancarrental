// Client side of the chat. Three transports, same events:
//  - same-site server:  POST /api/chat (Server-Sent Events), as Saathi's streamChat()
//  - remote server:     POST {NEXT_PUBLIC_API_URL}/api/chat (static site + Render API)
//  - in the browser:    the offline engine over the published snapshot (static site, no API)
import type { AssistantEvent, AssistantSnapshot } from "@cab/assistant/browser";
import { API_URL, IS_STATIC, withBase } from "@/lib/base";

/** In-browser mode: a static site with no API configured. */
export const LOCAL_ENGINE = IS_STATIC && !API_URL;
const apiUrl = (path: string) => (API_URL ? `${API_URL}${path}` : path);

let snapshot: Promise<AssistantSnapshot> | null = null;
function loadSnapshot() {
  snapshot ??= fetch(withBase("/assistant-data.json")).then((r) => {
    if (!r.ok) throw new Error(`snapshot HTTP ${r.status}`);
    return r.json() as Promise<AssistantSnapshot>;
  });
  return snapshot;
}

async function localChat(
  body: { message: string; locale: string; history: { role: "user" | "assistant"; text: string }[] },
  onEvent: (e: AssistantEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const [{ OfflineAssistant, SnapshotData }, snap] = await Promise.all([import("@cab/assistant/browser"), loadSnapshot()]);
  await new OfflineAssistant().respond({
    message: body.message,
    history: body.history,
    ctx: { data: new SnapshotData(snap), now: new Date(), locale: body.locale as "en" | "hi" | "mr", channel: "web_chat", ownerRef: null },
    emit: onEvent,
    signal: signal ?? new AbortController().signal,
  });
  onEvent({ type: "done", mode: "offline" });
}

export async function chatInfo(): Promise<{ mode: "claude" | "offline" }> {
  if (LOCAL_ENGINE) return { mode: "offline" };
  const r = await fetch(apiUrl("/api/chat/info"));
  return (await r.json()) as { mode: "claude" | "offline" };
}

export class ChatError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function streamChat(
  body: { message: string; locale: string; history: { role: "user" | "assistant"; text: string }[] },
  onEvent: (e: AssistantEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (LOCAL_ENGINE) return localChat(body, onEvent, signal);
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ChatError(0, "NETWORK", "network");
  }
  if (!res.ok || !res.body) {
    const e = ((await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null)?.error;
    throw new ChatError(res.status, e?.code ?? "HTTP_ERROR", e?.message ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (data) onEvent(JSON.parse(data) as AssistantEvent);
    }
    if (done) break;
  }
}

export async function resolveProposal(id: string, action: "confirm" | "cancel"): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(apiUrl(`/api/chat/proposals/${encodeURIComponent(id)}/${action}`), { method: "POST" });
  if (res.ok) return { ok: true };
  const e = ((await res.json().catch(() => null)) as { error?: { message: string } } | null)?.error;
  return { ok: false, ...(e?.message ? { message: e.message } : {}) };
}
