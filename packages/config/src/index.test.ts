import { describe, expect, it } from "vitest";
import { readEnv, readFlags } from "./index";

describe("flags", () => {
  it("aggregator mode is off when unset", () => {
    expect(readFlags({}).aggregatorMode).toBe(false);
  });
  it("aggregator mode is off when explicitly false or empty", () => {
    expect(readFlags({ AGGREGATOR_MODE: "false" }).aggregatorMode).toBe(false);
    expect(readFlags({ AGGREGATOR_MODE: "" }).aggregatorMode).toBe(false);
  });
  it("aggregator mode only turns on with an explicit true", () => {
    expect(readFlags({ AGGREGATOR_MODE: "true" }).aggregatorMode).toBe(true);
  });
  it("rejects ambiguous values instead of guessing", () => {
    expect(() => readFlags({ AGGREGATOR_MODE: "yes" })).toThrow();
  });
});

describe("env", () => {
  it("has safe defaults", () => {
    const env = readEnv({});
    expect(env.MAX_VEHICLE_AGE_YEARS).toBe(9);
    expect(env.INDEX_COMPLETENESS_THRESHOLD).toBe(0.8);
  });
});

import { readAssistantConfig, whatsappEnabled } from "./index";

describe("assistant config", () => {
  it("runs offline by default and is named e-Taxi", () => {
    const c = readAssistantConfig({});
    expect(c.ANTHROPIC_API_KEY).toBeUndefined();
    expect(c.ASSISTANT_NAME).toBe("e-Taxi");
    expect(c.ASSISTANT_REFUSAL_FALLBACK).toBe(true);
    expect(readAssistantConfig({ ASSISTANT_REFUSAL_FALLBACK: "false" }).ASSISTANT_REFUSAL_FALLBACK).toBe(false);
  });
  it("requires a model when a key is set", () => {
    expect(() => readAssistantConfig({ ANTHROPIC_API_KEY: "k" })).toThrow(/ASSISTANT_MODEL/);
  });
  it("WhatsApp needs every credential", () => {
    expect(whatsappEnabled(readAssistantConfig({ WHATSAPP_VERIFY_TOKEN: "a" }))).toBe(false);
    expect(
      whatsappEnabled(
        readAssistantConfig({ WHATSAPP_VERIFY_TOKEN: "a", WHATSAPP_APP_SECRET: "b", WHATSAPP_ACCESS_TOKEN: "c", WHATSAPP_PHONE_NUMBER_ID: "d" }),
      ),
    ).toBe(true);
  });
});
