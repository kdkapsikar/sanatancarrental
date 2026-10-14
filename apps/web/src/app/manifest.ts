import type { MetadataRoute } from "next";
import { BRAND } from "@cab/config";
import { withBase } from "@/lib/base";

/** Installable web app: the name shows in Devanagari on the home screen. */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: `${BRAND.latin}: outstation, airport and sightseeing trips from Chhatrapati Sambhajinagar`,
    start_url: withBase("/mr"),
    display: "standalone",
    background_color: "#fdfaf4",
    theme_color: "#a3174d",
    lang: "mr",
    icons: [{ src: withBase("/icon.svg"), sizes: "any", type: "image/svg+xml" }],
  };
}
