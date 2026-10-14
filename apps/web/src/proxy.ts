import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { canonicalizePath } from "@cab/seo";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/**
 * 1. City-name aliases (Aurangabad / Sambhajinagar) in any path segment 301 to the canonical
 *    "chhatrapati-sambhajinagar" slug, so both names resolve but only one URL is indexed.
 * 2. Everything else goes through next-intl locale routing.
 */
export default function proxy(req: NextRequest) {
  const { path, changed } = canonicalizePath(req.nextUrl.pathname);
  if (changed) {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url, 301);
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|sitemap.xml|robots.txt|.*\\..*).*)"],
};
