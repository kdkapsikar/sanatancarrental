import { describe, expect, it } from "vitest";
import { searchFinder, type FinderPlace } from "./search";

const P = (slug: string, terms: string[]): FinderPlace => ({ slug, kind: "x", label: terms[0]!, alt: null, terms, href: `/en/${slug}` });
const places = [
  P("ellora-caves", ["Ellora Caves", "वेरूळ लेणी", "Verul", "Ellora"]),
  P("ajanta-caves", ["Ajanta Caves", "अजिंठा लेणी", "Ajintha"]),
  P("shirdi", ["Shirdi", "शिर्डी"]),
  P("shani-shingnapur", ["Shani Shingnapur", "शनि शिंगणापूर", "Shingnapur"]),
];

describe("searchFinder", () => {
  it("finds by old name and by Devanagari", () => {
    expect(searchFinder("verul", places)[0]?.slug).toBe("ellora-caves");
    expect(searchFinder("अजिंठा", places)[0]?.slug).toBe("ajanta-caves");
  });
  it("ranks prefix matches above substrings", () => {
    expect(searchFinder("shi", places).map((p) => p.slug)).toEqual(["shirdi", "shani-shingnapur"]);
  });
  it("matches later words in a name", () => {
    expect(searchFinder("caves", places).map((p) => p.slug)).toEqual(["ellora-caves", "ajanta-caves"]);
  });
  it("returns the first few when empty and nothing for nonsense", () => {
    expect(searchFinder("", places, 2)).toHaveLength(2);
    expect(searchFinder("zzzz", places)).toEqual([]);
  });
});
