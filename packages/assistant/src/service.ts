import type { AssistantConfig } from "@cab/config";
import type { Db } from "@cab/db";
import { ClaudeAssistant } from "./claude";
import { DailyTokenBudget, HourlyLimiter } from "./limits";
import { OfflineAssistant } from "./offline";
import { DbData } from "./data-db";
import type { ToolContext } from "./tools";
import type { AssistantEngine, Channel, Emit, HistoryTurn, Locale } from "./types";

export interface ChatRequest {
  message: string;
  /** Recent turns: from the browser (web) or the stored thread (WhatsApp). */
  history: HistoryTurn[];
  locale: Locale;
  channel: Channel;
  /** WhatsApp sender id; null on the website. */
  ownerRef: string | null;
  emit: Emit;
  signal: AbortSignal;
}

export interface AssistantDeps {
  config: AssistantConfig;
  db: Db;
  /** Override for tests (e.g. a Claude engine with a mocked client). */
  engine?: AssistantEngine;
  now?: () => Date;
}

/** Same shape as Saathi's AssistantService: one entry point for every channel. */
export class AssistantService {
  readonly offline = new OfflineAssistant();
  readonly primary: AssistantEngine;
  private readonly limiter = new HourlyLimiter();
  readonly budget: DailyTokenBudget;

  constructor(private readonly deps: AssistantDeps) {
    const { config } = deps;
    this.primary = deps.engine ?? (config.ANTHROPIC_API_KEY ? new ClaudeAssistant(config) : this.offline);
    this.budget = new DailyTokenBudget(config.ASSISTANT_DAILY_TOKEN_CAP);
  }

  get mode(): "claude" | "offline" {
    return this.primary.mode;
  }

  get name(): string {
    return this.deps.config.ASSISTANT_NAME;
  }

  /** Checked before the response starts streaming, so a 429 can still be a normal reply. */
  admit(key: string): { code: "RATE_LIMITED"; message: string } | null {
    return this.limiter.allow(key, this.deps.config.ASSISTANT_IP_HOURLY_LIMIT)
      ? null
      : { code: "RATE_LIMITED", message: "You've sent a lot of messages this hour. Please try again a bit later." };
  }

  async chat(req: ChatRequest): Promise<{ text: string; mode: "claude" | "offline" }> {
    const { config, db } = this.deps;
    const history = req.history.filter((h) => h.text).slice(-config.ASSISTANT_HISTORY_TURNS * 2);
    const ctx: ToolContext = {
      data: new DbData(db),
      now: this.deps.now?.() ?? new Date(),
      locale: req.locale,
      channel: req.channel,
      ownerRef: req.ownerRef,
    };
    let engine = this.primary;
    if (engine.mode === "claude" && this.budget.exhausted()) {
      engine = this.offline;
      req.emit({ type: "notice", message: `${config.ASSISTANT_NAME} is in basic mode for the rest of today.` });
    }
    try {
      const result = await engine.respond({ message: req.message, history, ctx, emit: req.emit, signal: req.signal });
      this.budget.record(result.tokens);
      req.emit({ type: "done", mode: engine.mode });
      return { text: result.text, mode: engine.mode };
    } catch (err) {
      if (req.signal.aborted) return { text: "", mode: engine.mode };
      req.emit({ type: "error", message: "Sorry, I couldn't answer just now. Please try again in a moment." });
      throw err;
    }
  }
}
