/**
 * Schematic map of the region, drawn from the real coordinates stored in PostGIS.
 * Lines show direction from the city, not road routes, and the caption says so.
 * Sights packed around the city are drawn again in a zoomed inset so their labels stay legible.
 */
export interface MapPlace {
  slug: string;
  kind: string;
  name: string;
  lng: number;
  lat: number;
  href: string;
}

const W = 640;
const H = 420;
const PAD = 44;
const NEAR_DEG = 0.3; // places this close to the city go in the inset
const COS = Math.cos((19.8 * Math.PI) / 180); // longitude shrink at this latitude

type Pt = { x: number; y: number };

function projector(pts: Array<{ lng: number; lat: number }>, box: { x: number; y: number; w: number; h: number }) {
  const lngs = pts.map((p) => p.lng);
  const lats = pts.map((p) => p.lat);
  const [minLng, maxLng, minLat, maxLat] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const s = Math.min(box.w / Math.max((maxLng - minLng) * COS, 1e-6), box.h / Math.max(maxLat - minLat, 1e-6));
  const offX = box.x + (box.w - (maxLng - minLng) * COS * s) / 2;
  const offY = box.y + (box.h - (maxLat - minLat) * s) / 2;
  return (p: { lng: number; lat: number }): Pt => ({
    x: offX + (p.lng - minLng) * COS * s,
    y: offY + (maxLat - p.lat) * s,
  });
}

/** Gentle curve from a to b, bowed to one side. */
function arc(a: Pt, b: Pt, bow = 0.18): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx - dy * bow).toFixed(1)},${(my + dx * bow).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

const KIND_COLOR: Record<string, string> = {
  cave_site: "var(--color-kumkum-500)",
  temple: "var(--color-marigold-500)",
  fort: "var(--color-basalt-600)",
  monument: "var(--color-kumkum-600)",
  city: "var(--color-peacock-600)",
  town: "var(--color-peacock-500)",
  airport: "var(--color-basalt-800)",
  nature: "var(--color-peacock-700)",
};

function Label({ p, text, side, size = 12 }: { p: Pt; text: string; side: "left" | "right" | "above" | "below"; size?: number }) {
  const o = 10;
  const pos = {
    left: { x: p.x - o, y: p.y + 4, a: "end" },
    right: { x: p.x + o, y: p.y + 4, a: "start" },
    above: { x: p.x, y: p.y - o, a: "middle" },
    below: { x: p.x, y: p.y + o + 9, a: "middle" },
  }[side];
  return (
    <text
      x={pos.x}
      y={pos.y}
      textAnchor={pos.a as "start" | "middle" | "end"}
      fontSize={size}
      className="fill-basalt-900 font-medium"
      paintOrder="stroke"
      stroke="var(--color-sand-50)"
      strokeWidth={4}
      strokeLinejoin="round"
    >
      {text}
    </text>
  );
}

export function RegionMap({
  places,
  originSlug,
  highlight,
  title,
  caption,
  insetTitle,
}: {
  places: MapPlace[];
  originSlug: string;
  /** When set, only these slugs get lines and emphasis (route pages). */
  highlight?: string[];
  title: string;
  caption: string;
  insetTitle: string;
}) {
  const origin = places.find((p) => p.slug === originSlug);
  if (!origin) return null;
  const others = places.filter((p) => p.slug !== originSlug);
  const near = others.filter((p) => Math.hypot((p.lng - origin.lng) * COS, p.lat - origin.lat) < NEAR_DEG);
  const far = others.filter((p) => !near.includes(p));

  const proj = projector(places, { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 });
  const o = proj(origin);

  // Inset sits in the empty south-east corner. Dots on the right, labels as callouts on the left.
  const inset = { x: W - 276, y: H - 200, w: 244, h: 178 };
  const iproj = projector([origin, ...near], { x: inset.x + 150, y: inset.y + 36, w: 78, h: inset.h - 56 });
  const io = iproj(origin);
  const callouts = near
    .map((p) => ({ p, pt: iproj(p) }))
    .sort((a, b) => a.pt.y - b.pt.y)
    .map((c, i, all) => ({
      ...c,
      ly: inset.y + 42 + (i * (inset.h - 58)) / Math.max(all.length - 1, 1),
    }));

  const lit = (slug: string) => !highlight || highlight.includes(slug);
  const sideFor = (pt: Pt, centre: Pt, width: number): "left" | "right" =>
    pt.x > width - 130 ? "left" : pt.x < 130 ? "right" : pt.x < centre.x ? "left" : "right";

  // Resolve obvious label clashes by pushing the later label below its dot.
  const placed: Pt[] = [];
  const farLabels = far.map((p) => {
    const pt = proj(p);
    let side: "left" | "right" | "above" | "below" = sideFor(pt, o, W);
    if (placed.some((q) => dist(q, pt) < 46)) side = "below";
    // Keep labels clear of the inset box.
    if (pt.x > inset.x - 40 && pt.y > inset.y - 24 && pt.y < inset.y + 8) side = "above";
    placed.push(pt);
    return { p, pt, side };
  });

  return (
    <figure className="relative">
      {/* On phones the map keeps a legible size and scrolls sideways instead of shrinking. */}
      <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-[28px] [scrollbar-width:thin]">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="region-map-title" className="h-auto w-full min-w-[560px]">
        <title id="region-map-title">{title}</title>
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="var(--color-marigold-300)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-sand-100)" stopOpacity="0" />
          </radialGradient>
          <pattern id="map-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.1" fill="var(--color-basalt-400)" opacity="0.28" />
          </pattern>
        </defs>
        <rect width={W} height={H} rx="28" fill="var(--color-sand-100)" />
        <rect width={W} height={H} rx="28" fill="url(#map-dots)" />
        <circle cx={o.x} cy={o.y} r="220" fill="url(#map-glow)" />

        {/* Routes from the city */}
        {far.map((p, i) => {
          const b = proj(p);
          const len = Math.round(dist(o, b) * 1.15);
          return (
            <path
              key={p.slug}
              d={arc(o, b, i % 2 ? 0.16 : -0.16)}
              fill="none"
              stroke={lit(p.slug) ? "var(--color-kumkum-500)" : "var(--color-basalt-400)"}
              strokeOpacity={lit(p.slug) ? 0.75 : 0.25}
              strokeWidth={lit(p.slug) ? 1.8 : 1}
              strokeDasharray={len}
              strokeLinecap="round"
              className="animate-draw"
              style={{ ["--len" as string]: len, animationDelay: `${120 + i * 90}ms` }}
            />
          );
        })}

        {/* Near-city cluster marker on the main map + leader to the inset */}
        <circle cx={o.x} cy={o.y} r="20" fill="none" stroke="var(--color-peacock-600)" strokeDasharray="2 4" strokeWidth="1.2" />
        <path
          d={`M${o.x + 14},${o.y + 14} L${inset.x + 10},${inset.y + 4}`}
          stroke="var(--color-peacock-600)"
          strokeWidth="1"
          strokeDasharray="2 4"
          fill="none"
        />

        {/* Destination dots */}
        {farLabels.map(({ p, pt, side }) => (
          <a key={p.slug} href={p.href} aria-label={p.name}>
            <g className="cursor-pointer transition-opacity hover:opacity-80" opacity={lit(p.slug) ? 1 : 0.45}>
              <circle cx={pt.x} cy={pt.y} r="9" fill="white" stroke={KIND_COLOR[p.kind]} strokeWidth="2" />
              <circle cx={pt.x} cy={pt.y} r="3.5" fill={KIND_COLOR[p.kind]} />
              <Label p={pt} text={p.name} side={side} />
            </g>
          </a>
        ))}

        {/* Origin */}
        <circle cx={o.x} cy={o.y} r="6" fill="var(--color-kumkum-500)" className="animate-pulse-ring" opacity="0.6" />
        <circle cx={o.x} cy={o.y} r="7" fill="var(--color-kumkum-600)" stroke="white" strokeWidth="2.5" />
        <Label p={o} text={origin.name} side="above" size={13} />

        {/* Inset: around the city */}
        <g>
          <rect x={inset.x} y={inset.y} width={inset.w} height={inset.h} rx="16" fill="white" stroke="var(--color-peacock-600)" strokeOpacity="0.35" />
          <text x={inset.x + 14} y={inset.y + 20} fontSize="10" letterSpacing="1.2" className="fill-peacock-700 font-semibold uppercase">
            {insetTitle}
          </text>
          {near.map((p) => {
            const b = iproj(p);
            return <path key={p.slug} d={arc(io, b, 0.12)} fill="none" stroke="var(--color-kumkum-500)" strokeOpacity={lit(p.slug) ? 0.6 : 0.2} strokeWidth="1.2" />;
          })}
          {callouts.map(({ p, pt, ly }) => (
            <a key={p.slug} href={p.href} aria-label={p.name}>
              <g opacity={lit(p.slug) ? 1 : 0.45} className="cursor-pointer hover:opacity-80">
                <path
                  d={`M${inset.x + 118},${ly - 3} H${inset.x + 132} L${pt.x},${pt.y}`}
                  fill="none"
                  stroke="var(--color-basalt-400)"
                  strokeWidth="0.8"
                />
                <circle cx={pt.x} cy={pt.y} r="5" fill="white" stroke={KIND_COLOR[p.kind]} strokeWidth="1.8" />
                <circle cx={pt.x} cy={pt.y} r="2" fill={KIND_COLOR[p.kind]} />
                <text x={inset.x + 115} y={ly} textAnchor="end" fontSize="10.5" className="fill-basalt-900 font-medium">
                  {p.name}
                </text>
              </g>
            </a>
          ))}
          <circle cx={io.x} cy={io.y} r="5" fill="var(--color-kumkum-600)" stroke="white" strokeWidth="2" />
        </g>
      </svg>
      </div>
      <figcaption className="mt-3 text-xs text-basalt-600">{caption}</figcaption>
    </figure>
  );
}
