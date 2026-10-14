// Client side of POST /api/chat (Server-Sent Events), same shape as Saathi's streamChat().
import type { AssistantEvent } from "@cab/assistant";

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
  let res: Response;
  try {
    res = await fetch("/api/chat", {
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
  const res = await fetch(`/api/chat/proposals/${encodeURIComponent(id)}/${action}`, { method: "POST" });
  if (res.ok) return { ok: true };
  const e = ((await res.json().catch(() => null)) as { error?: { message: string } } | null)?.error;
  return { ok: false, ...(e?.message ? { message: e.message } : {}) };
}
