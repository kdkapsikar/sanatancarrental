import { z } from "zod";

const boolFromEnv = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

/**
 * Feature flags. Every flag defaults to the safe/off position.
 *
 * aggregatorMode: when false the platform operates as a tour operator / own-and-attached fleet
 * (plan §4, models B/C). Turning it on exposes third-party vehicle booking, which likely needs a
 * Maharashtra aggregator licence. Do not enable until the client's lawyer confirms in writing.
 */
export const flagsSchema = z.object({
  AGGREGATOR_MODE: boolFromEnv,
});

export type Flags = { aggregatorMode: boolean };

export function readFlags(env: Record<string, string | undefined> = process.env): Flags {
  const parsed = flagsSchema.parse({ AGGREGATOR_MODE: env["AGGREGATOR_MODE"] });
  return { aggregatorMode: parsed.AGGREGATOR_MODE };
}

export const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://localhost:5433/cab_platform"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  MAX_VEHICLE_AGE_YEARS: z.coerce.number().int().positive().default(9),
  INDEX_COMPLETENESS_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(env: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(env);
}

export const LOCALES = ["en", "hi", "mr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const TIME_ZONE = "Asia/Kolkata";

/** Assistant (e-Taxi) settings. Without an API key the offline engine answers. */
export const assistantConfigSchema = z
  .object({
    ASSISTANT_NAME: z.string().min(1).default("e-Taxi"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ASSISTANT_MODEL: z.string().min(1).optional(),
    ASSISTANT_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
    ASSISTANT_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
    ASSISTANT_MAX_TOOL_ROUNDS: z.coerce.number().int().min(1).max(10).default(5),
    // Server-side refusal fallback ("fallbacks": "default"); on unless explicitly "false".
    ASSISTANT_REFUSAL_FALLBACK: z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((v) => v === undefined || v === "true" || v === "1"),
    ASSISTANT_IP_HOURLY_LIMIT: z.coerce.number().int().positive().default(30),
    ASSISTANT_DAILY_TOKEN_CAP: z.coerce.number().int().positive().default(2_000_000),
    ASSISTANT_HISTORY_TURNS: z.coerce.number().int().min(0).max(30).default(8),
    WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
    WHATSAPP_APP_SECRET: z.string().min(1).optional(),
    WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
    WHATSAPP_GRAPH_VERSION: z.string().default("v23.0"),
    /** Override only for local testing against a mock Graph API. */
    WHATSAPP_API_BASE: z.string().url().default("https://graph.facebook.com"),
  })
  .superRefine((c, ctx) => {
    if (c.ANTHROPIC_API_KEY && !c.ASSISTANT_MODEL) {
      ctx.addIssue({ code: "custom", message: "ASSISTANT_MODEL is required when ANTHROPIC_API_KEY is set" });
    }
  });

export type AssistantConfig = z.infer<typeof assistantConfigSchema>;

export function readAssistantConfig(env: Record<string, string | undefined> = process.env): AssistantConfig {
  // Empty strings in .env mean "unset".
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== ""));
  return assistantConfigSchema.parse(cleaned);
}

/** WhatsApp is enabled only when every credential is present. */
export function whatsappEnabled(c: AssistantConfig): boolean {
  return !!(c.WHATSAPP_VERIFY_TOKEN && c.WHATSAPP_APP_SECRET && c.WHATSAPP_ACCESS_TOKEN && c.WHATSAPP_PHONE_NUMBER_ID);
}

/** The client's brand. Shown in Devanagari in every language; the Latin form is for search/metadata. */
export const BRAND = {
  name: "सनातन कार रेंटल",
  latin: "Sanatan Car Rental",
} as const;
