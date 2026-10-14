import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// STATIC_EXPORT=1 builds plain HTML for GitHub Pages (see scripts/build-static.mjs):
// no server, served under NEXT_PUBLIC_BASE_PATH, e-Taxi runs in the browser.
const STATIC = process.env["STATIC_EXPORT"] === "1";
const BASE_PATH = process.env["NEXT_PUBLIC_BASE_PATH"] ?? "";

const config: NextConfig = {
  ...(STATIC ? { output: "export" as const, images: { unoptimized: true }, ...(BASE_PATH ? { basePath: BASE_PATH } : {}) } : {}),
  transpilePackages: ["@cab/assistant", "@cab/compliance", "@cab/config", "@cab/db", "@cab/fare-engine", "@cab/seo"],
  poweredByHeader: false,
  // The Anthropic SDK stays a server-side Node dependency.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default withNextIntl(config);
