// Builds the static GitHub Pages version of the site into apps/web/out.
// Server-only parts (API routes, the proxy) are moved aside for the build and always restored.
// Needs DATABASE_URL (pages and the assistant snapshot are rendered from the database at build).
import { execSync } from "node:child_process";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const aside = [
  ["src/app/api", "src/_server_only_api"],
  ["src/proxy.ts", "src/_server_only_proxy.ts"],
];

const moved = [];
try {
  for (const [from, to] of aside) {
    if (existsSync(path.join(web, from))) {
      renameSync(path.join(web, from), path.join(web, to));
      moved.push([from, to]);
    }
  }
  execSync("npx next build", {
    cwd: web,
    stdio: "inherit",
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_STATIC_EXPORT: "1", NEXT_PUBLIC_BASE_PATH: base },
  });
} finally {
  for (const [from, to] of moved.reverse()) renameSync(path.join(web, to), path.join(web, from));
}

const out = path.join(web, "out");
// The site root picks a language from the browser (Marathi, Hindi, otherwise English).
writeFileSync(
  path.join(out, "index.html"),
  `<!doctype html><html lang="mr"><head><meta charset="utf-8"><title>सनातन कार रेंटल</title>
<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">
<noscript><meta http-equiv="refresh" content="0;url=${base}/en"></noscript>
<script>
var l=(navigator.languages||[navigator.language||"en"]).map(function(x){return String(x).slice(0,2)});
var pick=l.indexOf("mr")>-1?"mr":l.indexOf("hi")>-1?"hi":"en";
location.replace("${base}/"+pick);
</script></head><body><a href="${base}/en">सनातन कार रेंटल</a></body></html>\n`,
);
// GitHub Pages: serve files as-is (Next writes folders starting with "_").
writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`static site ready in ${out} (base path "${base || "/"}")`);
