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
