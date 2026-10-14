/**
 * Sub-path the site is served under (e.g. "/sanatancarrental" on GitHub Pages; "" elsewhere).
 * next/link and router.push add it themselves; plain <a href>, fetch() and SVG links need withBase().
 */
export const BASE_PATH = process.env["NEXT_PUBLIC_BASE_PATH"] ?? "";
export const withBase = (path: string) => `${BASE_PATH}${path}`;

/** Static export (GitHub Pages): no server routes, so e-Taxi runs in the browser unless an API URL is set. */
export const IS_STATIC = process.env["NEXT_PUBLIC_STATIC_EXPORT"] === "1";
/** Optional remote API (e.g. the Render deployment) for e-Taxi when the site itself is static. */
export const API_URL = (process.env["NEXT_PUBLIC_API_URL"] ?? "").replace(/\/$/, "");
