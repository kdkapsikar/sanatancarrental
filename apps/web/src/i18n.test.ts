import { describe, expect, it } from "vitest";
import { QUOTE_LINE_CODES, QUOTE_NOTE_CODES } from "@cab/fare-engine";
import en from "../messages/en.json" with { type: "json" };
import hi from "../messages/hi.json" with { type: "json" };
import mr from "../messages/mr.json" with { type: "json" };

function keys(o: unknown, prefix = ""): string[] {
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
function get(o: unknown, path: string): string {
  return path.split(".").reduce((x, k) => (x as Record<string, unknown>)[k], o) as string;
}

describe("i18n messages", () => {
  const enKeys = keys(en).sort();

  it.each([["hi", hi], ["mr", mr]])("%s has exactly the same keys as en", (_l, msgs) => {
    expect(keys(msgs).sort()).toEqual(enKeys);
  });

  it.each([["hi", hi], ["mr", mr]])("%s keeps every ICU placeholder", (_l, msgs) => {
    for (const k of enKeys) expect(placeholders(get(msgs, k)), k).toEqual(placeholders(get(en, k)));
  });

  it("every fare-engine line and note code has an English label", () => {
    for (const c of QUOTE_LINE_CODES) expect(enKeys, c).toContain(`quote.line.${c}`);
    for (const c of QUOTE_NOTE_CODES) expect(enKeys, c).toContain(`quote.note.${c}`);
  });

  it.each([["hi", hi], ["mr", mr]])("%s is fully translated into Devanagari", (_l, msgs) => {
    // Brand names that stay in Latin script.
    const LATIN_OK = new Set(["languages.en", "languages.short.en", "mobileBar.whatsapp"]);
    for (const k of keys(msgs)) {
      const v = get(msgs, k);
      expect(v, k).not.toMatch(/TODO_TRANSLATE/);
      if (!LATIN_OK.has(k)) expect(v, k).toMatch(/[\u0900-\u097F]/);
    }
  });

  it("no visible copy uses the old city name", () => {
    for (const msgs of [en, hi, mr]) {
      for (const k of keys(msgs)) expect(get(msgs, k), k).not.toMatch(/aurangabad|औरंगाबाद/i);
    }
  });
});
