/** Client-safe place search for the trip finder (names in all scripts + aliases). */
export interface FinderPlace {
  slug: string;
  kind: string;
  label: string;
  alt: string | null;
  /** Every searchable name: en/hi/mr, aliases, slug. */
  terms: string[];
  href: string;
}

export const normTerm = (s: string) => s.toLowerCase().normalize("NFC").replace(/[\s\-_.,'’()]/g, "");

/** Exact > prefix > word-prefix > substring; ties keep the input order. */
export function searchFinder(query: string, places: FinderPlace[], limit = 6): FinderPlace[] {
  const q = normTerm(query);
  if (!q) return places.slice(0, limit);
  const words = query.toLowerCase().trim().split(/\s+/);
  return places
    .map((p, i) => {
      const ts = p.terms.map(normTerm);
      const score = ts.some((t) => t === q)
        ? 4
        : ts.some((t) => t.startsWith(q))
          ? 3
          : p.terms.some((t) => t.toLowerCase().split(/[\s-]+/).some((w) => words.some((x) => x && w.startsWith(x))))
            ? 2
            : ts.some((t) => t.includes(q))
              ? 1
              : 0;
      return { p, score, i };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}
