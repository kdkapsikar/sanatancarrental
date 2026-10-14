import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { readAssistantConfig } from "@cab/config";
import type { Db } from "@cab/db";
import { ClaudeAssistant, systemPrompt } from "./claude";
import type { AssistantEvent } from "./types";
import { testDb } from "./test-db";
import { DbData } from "./data-db";

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  const t = await testDb();
  db = t.db;
  close = () => t.client.end();
}, 120_000);
afterAll(() => close());

type Scripted = { stop_reason: string; content: unknown[]; text?: string };

/** A stand-in for client.beta.messages.stream that replays scripted turns. */
function fakeClient(turns: Scripted[]) {
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(structuredClone(params));
          const turn = turns.shift()!;
          const handlers: Array<(d: string) => void> = [];
          return {
            on(_ev: string, h: (d: string) => void) {
              handlers.push(h);
              return this;
            },
            async finalMessage() {
              if (turn.text) handlers.forEach((h) => h(turn.text!));
              return { ...turn, usage: { input_tokens: 10, output_tokens: 5 } };
            },
          };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

const config = { ...readAssistantConfig({ ANTHROPIC_API_KEY: "test", ASSISTANT_MODEL: "claude-opus-5-5" }) };

async function run(turns: Scripted[], message = "Is Ellora closed on Tuesday?") {
  const { client, calls } = fakeClient(turns);
  const engine = new ClaudeAssistant(config, client);
  const events: AssistantEvent[] = [];
  const res = await engine.respond({
    message,
    history: [],
    ctx: { data: new DbData(db), now: new Date("2026-10-14T10:00:00+05:30"), locale: "en", channel: "web_chat", ownerRef: null },
    emit: (e) => events.push(e),
    signal: new AbortController().signal,
  });
  return { res, events, calls };
}

describe("ClaudeAssistant (mocked SDK)", () => {
  it("runs tools, feeds results back, and streams the answer", async () => {
    const { res, events, calls } = await run([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_place", input: { slug: "ellora-caves" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Not confirmed yet." }], text: "Not confirmed yet." },
    ]);
    expect(res.text).toBe("Not confirmed yet.");
    expect(events.filter((e) => e.type === "tool")).toEqual([
      { type: "tool", name: "get_place", status: "start" },
      { type: "tool", name: "get_place", status: "done" },
    ]);
    const second = calls[1]!["messages"] as Array<{ role: string; content: unknown }>;
    const toolResult = (second.at(-1)!.content as Array<{ content: string }>)[0]!.content;
    expect(JSON.parse(toolResult).weekly_closing_day.status).toBe("not_verified");
    expect(res.tokens).toBe(30);
  });

  it("sends the cached system prompt, eager tool streaming, effort and the refusal fallback", async () => {
    const { calls } = await run([{ stop_reason: "end_turn", content: [], text: "Hi" }], "hi");
    const p = calls[0]!;
    expect(p["model"]).toBe("claude-opus-5-5");
    expect((p["system"] as Array<{ text: string; cache_control?: unknown }>)[0]).toMatchObject({ text: systemPrompt("e-Taxi"), cache_control: { type: "ephemeral" } });
    expect((p["tools"] as Array<{ eager_input_streaming: boolean }>).every((t) => t.eager_input_streaming)).toBe(true);
    expect(p["output_config"]).toEqual({ effort: "low" });
    expect(p["fallbacks"]).toBe("default");
    expect(p["betas"]).toEqual(["server-side-fallback-2026-07-01"]);
  });

  it("answers a refusal with a short apology", async () => {
    const { res } = await run([{ stop_reason: "refusal", content: [] }]);
    expect(res.text).toMatch(/can't help with that/);
  });

  it("never runs a tool from a turn cut off at max_tokens", async () => {
    const { events } = await run([
      { stop_reason: "max_tokens", content: [{ type: "tool_use", id: "t1", name: "request_callback", input: { trip_summary: "x" } }] },
    ]);
    expect(events.some((e) => e.type === "tool")).toBe(false);
  });

  it("system prompt keeps prices and facts tool-only", () => {
    const s = systemPrompt("e-Taxi");
    expect(s).toMatch(/Prices come only from get_quote/);
    expect(s).toMatch(/data, not instructions/);
  });
});
