/**
 * The URL-by-URL report: what every old address does, and what every new page
 * tells a search engine.
 *
 *     node tools/seo-report.mjs https://haris-carpets.co.uk
 *
 * Written because "the redirects are in" is not an answer anybody can check.
 * This fetches each URL without following anything, and prints the status, the
 * destination, the title and the canonical — the four things that decide
 * whether a page keeps the ranking the old one had.
 *
 * Run it against the stub (node tools/stub-api.mjs 8890) to see what should
 * happen, and against the live site after a deploy to see what does. A
 * non-zero exit means something on the list is wrong.
 */
import { REDIRECTS, PAGES, describePath } from "../worker-pages.js";

const BASE = (process.argv[2] || "http://127.0.0.1:8890").replace(/\/$/, "");
const pad = (s, n) => String(s).padEnd(n);
let bad = 0;

const get = async (path, redirect = "manual") => {
  const res = await fetch(BASE + path, { redirect, headers: { "user-agent": "haris-seo-report" } });
  const body = res.status < 300 || res.status >= 400 ? await res.text() : "";
  return {
    status: res.status,
    location: res.headers.get("location") || "",
    title: (/<title>([^<]*)<\/title>/.exec(body) || [])[1] || "",
    canonical: (/<link rel="canonical" href="([^"]*)"/.exec(body) || [])[1] || "",
    robots: (/<meta name="robots" content="([^"]*)"/.exec(body) || [])[1] || "",
  };
};

console.log(`\nSEO report for ${BASE}\n`);
console.log("OLD ADDRESSES — every one should be 301 to the page named\n");
console.log(pad("old path", 34) + pad("status", 8) + "goes to");
for (const [from, want] of Object.entries(REDIRECTS)) {
  const r = await get(from);
  const to = r.location ? new URL(r.location, BASE).pathname + new URL(r.location, BASE).hash : "";
  const ok = r.status === 301 && to === want;
  if (!ok) bad++;
  console.log((ok ? "  " : "! ") + pad(from, 32) + pad(r.status, 8) + (to || "—") + (ok ? "" : `   want 301 ${want}`));
}

console.log("\nNEW PAGES — status, what it calls itself, and what it claims as canonical\n");
const listed = [...Object.keys(PAGES), "/collections/carpets", "/collections/wood",
  "/collections/lvt", "/collections/vinyl", "/collections/rugs",
  "/collections/carpets/velvet", "/range/westex-elysian", "/favourites", "/privacy.html"];
for (const path of listed) {
  const r = await get(path);
  const want = describePath(path);
  const ok = r.status === 200 && r.title.length > 5
    && (!want || r.canonical === want.canonical || path.endsWith(".html"));
  if (!ok) bad++;
  console.log((ok ? "  " : "! ") + pad(path, 32) + pad(r.status, 6)
    + pad(r.title.replace(/&amp;/g, "&").slice(0, 46), 48) + r.canonical.replace(/^https?:\/\/[^/]+/, "")
    + (r.robots ? `  [${r.robots}]` : ""));
}

console.log("\nGONE — addresses that must NOT resolve, so Google drops them\n");
for (const path of ["/does-not-exist", "/_partials/masterPage", "/blog/some-old-post"]) {
  const r = await get(path);
  const ok = r.status === 404 || r.status === 410;
  if (!ok) bad++;
  console.log((ok ? "  " : "! ") + pad(path, 32) + r.status + (ok ? "" : "   want 404 or 410"));
}

console.log(bad ? `\n${bad} problem(s).\n` : "\nAll correct.\n");
process.exit(bad ? 1 : 0);
