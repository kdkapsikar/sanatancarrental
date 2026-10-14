import type { ProposalView, ToolContext } from "./tools";

export type Locale = "en" | "hi" | "mr";
export type Channel = "web_chat" | "whatsapp";

export interface QuickReply {
  /** Shown on the chip / WhatsApp button (≤20 chars for WhatsApp). */
  label: string;
  /** Sent as the user's message when tapped. */
  message: string;
}

export type AssistantEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "start" | "done" | "error" }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "quick_replies"; options: QuickReply[] }
  | { type: "notice"; message: string }
  | { type: "done"; mode: "claude" | "offline" }
  | { type: "error"; message: string };

export type Emit = (event: AssistantEvent) => void;

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface Turn {
  message: string;
  history: HistoryTurn[];
  ctx: ToolContext;
  emit: Emit;
  signal: AbortSignal;
}

export interface TurnResult {
  text: string;
  proposals: ProposalView[];
  /** Input + output tokens billed (0 offline). */
  tokens: number;
}

export interface AssistantEngine {
  readonly mode: "claude" | "offline";
  respond(turn: Turn): Promise<TurnResult>;
}
