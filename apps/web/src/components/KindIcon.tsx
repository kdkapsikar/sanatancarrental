/**
 * Line glyphs per place kind. Used instead of stock photography until the client's own photos
 * exist, so nothing on the page implies a picture of a specific vehicle or site we haven't taken.
 */
const PATHS: Record<string, string> = {
  // Rock-cut cave facade: arched chaitya window over pillars.
  cave_site: "M4 28h40M8 28V16a16 16 0 0 1 32 0v12M16 28v-9M24 28v-9M32 28v-9M14 16a10 10 0 0 1 20 0",
  // Temple shikhara with kalash.
  temple: "M6 30h36M12 30v-8h24v8M15 22l3-9h12l3 9M18 13l6-8 6 8M24 5V2M22 30v-5h4v5",
  // Fort battlements on a hill.
  fort: "M2 32c8-6 14-8 22-8s14 2 22 8M10 26V12h4v3h4v-3h4v3h4v-3h4v3h4v-3h4v14M20 26v-6h8v6",
  // Domed mausoleum with minarets.
  monument: "M4 30h40M14 30V18h20v12M14 18c0-7 4-11 10-13 6 2 10 6 10 13M24 5V2M7 30V14M41 30V14M7 14l-1.5-3h3zM41 14l-1.5-3h3z",
  // City skyline.
  city: "M2 30h44M5 30V16h7v14M12 30V9h8v21M20 30V19h6v11M26 30V5h8v25M34 30V14h9v16M15 13h2M15 18h2M29 10h2M29 15h2M29 20h2",
  // Small town: houses and a tree.
  town: "M3 30h42M6 30V20l7-6 7 6v10M10 30v-5h6v5M22 30V22l6-5 6 5v8M38 30v-8M38 22a4 4 0 1 1 0-8 4 4 0 0 1 0 8z",
  // Airport: plane over runway.
  airport: "M4 31h40M10 31h4M22 31h4M34 31h4M6 18l14 2 10-11h4l-5 12 10 1 3-4h3l-2 7 2 7h-3l-3-4-10 1 5 12h-4L20 30 6 32z",
  // Crater lake ringed by forest.
  nature: "M4 22c0-7 9-12 20-12s20 5 20 12-9 10-20 10S4 29 4 22zM11 22c0-4 6-7 13-7s13 3 13 7-6 6-13 6-13-2-13-6zM16 21c3 1 6 1 9 0M27 23c2 1 4 1 6 0",
};

export function KindIcon({ kind, className = "" }: { kind: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 36"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[kind] ?? PATHS["town"]} />
    </svg>
  );
}
