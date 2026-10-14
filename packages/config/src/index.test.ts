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
