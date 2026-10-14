// Repo guard: no fare amounts outside the fare engine (CLAUDE.md non-negotiable).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCAN = ["apps/web/src", "packages/seo/src", "packages/db/src", "packages/jobs/src", "packages/compliance/src", "packages/assistant/src"];
// Allowed: tests, the inactive example fare rules, and seed data.ts (which quotes unverified
// monument entry-fee figures inside needs_verification notes; those are not fares).
const ALLOW = [
  /\.test\.tsx?$/,
  /packages\/db\/src\/seed\/example-fare-rules\.ts$/,
  /packages\/db\/src\/seed\/data\.ts$/,
];
const PRICE = [/₹\s?\d/, /\bRs\.?\s?\d/i, /\b(perKmPaise|pricePaise|basePaise|perNightPaise|driverAllowancePerDayPaise)\s*:\s*\d/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|json)$/.test(p) ? [p] : [];
  });
}

describe("no hardcoded fares", () => {
  it("only the fare engine (and its test fixtures) contain prices", () => {
    const offenders: string[] = [];
    for (const d of SCAN) {
      for (const f of files(path.join(ROOT, d))) {
        const rel = path.relative(ROOT, f);
        if (ALLOW.some((a) => a.test(rel))) continue;
        const text = readFileSync(f, "utf8");
        for (const re of PRICE) if (re.test(text)) offenders.push(`${rel} (${re})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
