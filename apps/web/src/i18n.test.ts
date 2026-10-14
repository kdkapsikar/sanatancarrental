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

  it("untranslated hi/mr strings are explicitly marked", () => {
    for (const [msgs] of [[hi], [mr]]) {
      for (const k of keys(msgs)) {
        if (k.startsWith("languages.")) continue;
        const v = get(msgs, k);
        if (v === get(en, k)) throw new Error(`${k} is an unmarked copy of English`);
      }
    }
  });
});
