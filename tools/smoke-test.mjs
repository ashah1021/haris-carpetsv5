/**
 * End-to-end smoke test for the site.
 *
 *     node tools/stub-api.mjs 8890 &
 *     node tools/smoke-test.mjs http://127.0.0.1:8890
 *
 * The stub rather than a plain static server, and it has to be: the pages are
 * real addresses now, and answering /collections/lvt with the document is a
 * thing a static file server cannot do. The stub does it the way the Worker
 * does, out of the same worker-pages.js.
 *
 * The point of this file is visibility, not just presence. An earlier version
 * of these checks asserted that a route produced HTML, which it always did —
 * and missed a reveal animation leaving the catalogue at opacity 0, so the page
 * was blank while every assertion passed. Every check below therefore measures
 * what a visitor can actually see: painted pixels, non-zero boxes, computed
 * opacity, and real clicks.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:8899";
/* Real addresses. The stub serves them the way the Worker does — index.html
   with its head rewritten for that path — so opening one here is the same
   thing as a visitor typing it in, and a refresh is under test rather than
   assumed. */
const U = (path) => `${BASE}${path === "/" ? "/" : path}`;

let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
}

/** Is this element actually rendered, or merely in the DOM? */
function measure(sel) {
  const el = document.querySelector(sel);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    found: true, w: Math.round(r.width), h: Math.round(r.height),
    opacity: Number(cs.opacity), display: cs.display, visibility: cs.visibility,
  };
}

async function visible(page, sel) {
  const v = await page.evaluate(measure, sel);
  return v.found && v.w > 0 && v.h > 0 && v.opacity > 0.05
    && v.display !== "none" && v.visibility !== "hidden";
}

const ROUTES = [
  ["/", "home"],
  ["/collections", "collections index"],
  ["/collections/carpets", "carpets"],
  ["/collections/wood", "wood"],
  ["/collections/lvt", "lvt"],
  ["/collections/vinyl", "vinyl"],
  ["/collections/rugs", "rugs"],
  ["/collections/carpets/easy-clean", "a carpet style"],
  ["/collections/carpets/loop", "another style"],
  ["/collections/wood/herringbone", "a wood style"],
  ["/collections/lvt/stone-effect", "an lvt style"],
  ["/collections/carpets/pattern", "an empty style 404s"],
  ["/portfolio", "portfolio"],
  ["/range/westex-elysian", "a range"],
  ["/favourites", "favourites"],
  ["/about", "about"],
  ["/contact", "visit us"],
  ["/enquire", "contact us"],
];

/* The visualiser is an optional module — see FEATURES in data.js. These checks
   follow the flag rather than assuming it, so switching it back on re-arms them
   instead of leaving a hole. */
const VISUALISER = /visualiser:\s*true/.test(
  (await import("node:fs")).readFileSync(new URL("../public/data.js", import.meta.url), "utf8"));

const browser = await chromium.launch();

/* Google Fonts is unreachable from the sandbox these tests run in, and a
   request that never settles makes waitUntil:"networkidle" hang until the run
   is killed — which is what an intermittent eight-minute "failure" here turned
   out to be. The site is built to render in the fallback font (the footer rule
   is sized in ems for exactly that reason), so the request is refused outright
   and every run is deterministic. */
const openPage = async (browserObj, opts) => {
  const ctx = await browserObj.newContext(opts);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  return ctx.newPage();
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

/* The Visit us page embeds a Google map. This environment cannot reach Google,
   so the request hangs and "networkidle" never arrives — and even where it can,
   waiting on a third party would make every run slower and flakier. Google is
   stubbed out; that the iframe is on the page with the right src is asserted
   below, which is the part that is ours to get right. */
await ctx.route("**://*.google.com/**", (route) => route.abort());
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());

const errors = [], badResponses = [];
/* Set around a block that provokes a failure on purpose. A flag rather than
   widening the regex below, because adding /enquiry to that list would blind
   this suite to a genuine enquiry failure for ever. */
let expectFailures = false;
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  /* /api/site is the admin overlay, served by the Worker. This file runs
     against a plain static server, so its absence here is the point rather
     than a fault: the shop has to be complete without it. There is an explicit
     assertion for that below. */
  if (r.status() >= 400 && !expectFailures && !/\/api\/(site|instagram)/.test(r.url())) {
    badResponses.push(`${r.status()} ${r.url()}`);
  }
});

/* Walk the page the way a visitor does. Sections reveal on scroll, so measuring
   without scrolling would report whatever happened to be above the fold — and
   would score a page whose lower half never reveals as a pass. */
async function scrollThrough(p) {
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await p.waitForTimeout(600);
}

/* Every direct child of #app, and whether it is actually painted. */
const BLOCKS = () => [...document.querySelector("#app").children].map((el) => {
  const cs = getComputedStyle(el);
  const shown = cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) >= 0.05;
  return { tag: el.tagName.toLowerCase(), cls: el.className, shown,
           h: Math.round(el.getBoundingClientRect().height) };
});

console.log(`\nSmoke test against ${BASE}\n`);
console.log("Routes render something a visitor can see:");
const invisible = [];
for (const [hash, label] of ROUTES) {
  const res = await page.goto(U(hash), { waitUntil: "networkidle" });
  check(("  served as a page: " + label).padEnd(34), res.status() === 200, String(res.status()));
  await page.waitForTimeout(500);
  await scrollThrough(page);
  const blocks = await page.evaluate(BLOCKS);
  const painted = blocks.filter((b) => b.shown).reduce((n, b) => n + b.h, 0);
  check(label.padEnd(16), painted > 120, `${painted}px visible in ${blocks.length} blocks`);
  /* The bug this file exists for: a block that has height but no opacity. It
     passes every "did it render?" assertion and shows the visitor nothing. */
  for (const b of blocks.filter((b) => !b.shown && b.h > 40)) {
    invisible.push(`${hash} ${b.tag}.${b.cls.split(" ")[0]} ${b.h}px`);
  }
}
check("nothing is left invisible after scrolling", invisible.length === 0,
  invisible.slice(0, 3).join(" | "));

/* An address this site has never had is a 404, and has to stay one. The old
   hash router answered every string with a page — "#/does-not-exist" drew a
   friendly "we couldn't find that" *inside a 200 response*, which is a soft
   404: Google keeps the URL, indexes the apology and reports it as an error.
   Now the server answers before the app ever loads. */
{
  /* The 404 is the point of this one, so the watcher that fails the suite on a
     404 is told to expect it. */
  expectFailures = true;
  const res = await page.goto(U("/does-not-exist"), { waitUntil: "domcontentloaded" });
  check("an address the site has never had is a real 404", res.status() === 404, String(res.status()));
  expectFailures = false;
}

/* The old Wix addresses. Still in Google, still on printed material, and until
   these existed they were 404s that lost both the visitor and the ranking. */
for (const [from, to] of [["/about-us-1", "/about"], ["/carpets", "/collections/carpets"],
                          ["/lvt-1", "/collections/lvt"], ["/copy-of-carina-herringbone", "/collections/lvt"],
                          ["/velvet", "/collections/carpets/velvet"]]) {
  const res = await page.goto(U(from), { waitUntil: "networkidle" });
  check(`${from} lands on ${to}`.padEnd(46),
    res.status() === 200 && new URL(page.url()).pathname === to, new URL(page.url()).pathname);
}

/* What a crawler is handed, before a line of JavaScript runs. Fetched rather
   than rendered on purpose: this is the document Google indexes, and the whole
   point of serving real paths is that it differs from page to page. */
for (const [path, title, canonical] of [
  ["/", "Hari's Carpets — Carpet &amp; Flooring Showroom, Hounslow", "https://haris-carpets.co.uk/"],
  ["/about", "About us — Hari's Carpets", "https://haris-carpets.co.uk/about"],
  ["/contact", "Visit the showroom — Hari's Carpets, Hounslow", "https://haris-carpets.co.uk/contact"],
  ["/enquire", "Get in touch — Hari's Carpets", "https://haris-carpets.co.uk/enquire"],
  ["/portfolio", "Our work — Hari's Carpets", "https://haris-carpets.co.uk/portfolio"],
  ["/collections", "Collections — Hari's Carpets", "https://haris-carpets.co.uk/collections"],
  ["/collections/lvt", "LVT — Hari's Carpets, Hounslow", "https://haris-carpets.co.uk/collections/lvt"],
  ["/collections/carpets/velvet", "Carpets — Hari's Carpets, Hounslow", "https://haris-carpets.co.uk/collections/carpets"],
]) {
  const html = await (await fetch(BASE + path)).text();
  const got = /<title>([^<]*)<\/title>/.exec(html)?.[1] || "";
  const can = /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1] || "";
  const h1 = /<h1>([^<]*)<\/h1>/.exec(html)?.[1] || "";
  check(`${path} is served named`.padEnd(46), got === title, got);
  check(`${path} declares its canonical`.padEnd(46), can === canonical, can);
  check(`${path} has a heading without JavaScript`.padEnd(46), h1.length > 2, h1);
}

/* The title the Worker wrote and the title the app sets have to be the same
   sentence. A page that says one thing to a crawler and another to a visitor
   is the single thing Google is strict about, and the two live in different
   files — worker-pages.js and the describe() above — so they can drift. */
for (const path of ["/", "/about", "/contact", "/enquire", "/portfolio", "/collections", "/collections/lvt"]) {
  const served = /<title>([^<]*)<\/title>/.exec(await (await fetch(BASE + path)).text())?.[1] || "";
  await page.goto(U(path), { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const rendered = (await page.title()).replace(/&/g, "&amp;");
  check(`${path} says the same thing after rendering`.padEnd(46), served === rendered,
    served === rendered ? "" : `served ${served} / rendered ${rendered}`);
}

/* The catalogue is generated from supplier filenames, and every bug worth
   having in it so far has been a parsing one — a range name kept as a colour,
   the same range emitted twice, a photo filed as a swatch. These assert the
   shape of the data rather than the look of the page. */
console.log("\nVisit us and Get in touch:");
await page.goto(U("/contact"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const mapSrc = await page.evaluate(() =>
  document.querySelector(".map-embed iframe")?.getAttribute("src") || "");
check("the map is embedded", mapSrc.includes("google.com/maps/embed"), mapSrc.slice(0, 48));
check("the map box has been given a size", await visible(page, ".map-embed"));
check("the enquiry form has moved off this page",
  (await page.locator("#enquiry").count()) === 0);
check("with a link to where it went", (await page.locator('a[href="/enquire"]').count()) > 0);

await page.goto(U("/enquire"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
check("the form is on its own page", await visible(page, "#enquiry"));
check("and it can be filled in", (await page.locator("#enquiry input, #enquiry textarea").count()) >= 4);
check("with a way back to the showroom", (await page.locator('a[href="/contact"]').count()) > 0);

console.log("\nCollections data is sane:");
await page.goto(U("/collections"), { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const data = await page.evaluate(() => {
  const ids = CATALOGUE.map((r) => r.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const junk = /^(landscape|outdoor|portraits?|render|above|below|main|detail|\d+([.-]\d+)?|.{1,2})$/i;
  const bad = [], noColour = [], wrongAlt = [];
  for (const r of CATALOGUE) {
    if (!r.colours.length && !r.pending) noColour.push(r.id);
    if (r.type !== "carpets" && /\bcarpet\b/i.test(r.alt || "")) wrongAlt.push(r.id);
    for (const c of r.colours) if (junk.test(c.name.trim())) bad.push(r.id + ":" + c.name);
  }
  return { dupes, bad, noColour, wrongAlt, ranges: CATALOGUE.length,
           shades: CATALOGUE.reduce((n, r) => n + r.colours.length, 0),
           lvt: CATALOGUE.filter((r) => r.type === "lvt").reduce((n, r) => n + r.colours.length, 0) };
});
check("no duplicate range ids", data.dupes.length === 0, data.dupes.join(", "));
check("no filename artefacts as shade names", data.bad.length === 0, data.bad.slice(0, 3).join(", "));
check("every range has shades or says why not", data.noColour.length === 0, data.noColour.join(", "));
check("non-carpet ranges aren't described as carpet", data.wrongAlt.length === 0, data.wrongAlt.slice(0, 2).join(", "));
check("lvt catalogue is populated", data.lvt >= 30, `${data.lvt} lvt shades`);


/* The overlay is optional by design. This file is served without one, so the
   fact that everything above passed is the proof — but assert it, because a
   future change could make the catalogue wait on a request that never lands. */
const noOverlay = await page.evaluate(() => RANGES === CATALOGUE || RANGES.length >= CATALOGUE.length);
check("the shop is complete with no admin overlay", noOverlay);
console.log(`       (${data.ranges} ranges, ${data.shades} shades)`);

/* Every tile the catalogue points at must exist. A 404 here is invisible on
   the page — the img is removed and the hex shows through — so only a direct
   check catches it. */
console.log("\nEvery referenced image exists:");
const imgCheck = await page.evaluate(async () => {
  const seen = new Set(), bad = [];
  for (const sw of allSwatches()) {
    if (!sw.shot) continue;
    for (const url of [swatchImg(sw), ...(hasRoom(sw) ? [roomPhoto(sw)] : [])]) {
      if (seen.has(url)) continue;
      seen.add(url);
      const r = await fetch(url, { method: "HEAD" });
      if (!r.ok) bad.push(r.status + " " + url);
    }
  }
  return { checked: seen.size, bad };
});
check("no missing tiles", imgCheck.bad.length === 0,
  `${imgCheck.checked} checked${imgCheck.bad.length ? " — " + imgCheck.bad.slice(0, 3).join(", ") : ""}`);

console.log("\nBrowse-by-style works:");
await page.goto(U("/collections/carpets"), { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const tiles = await page.locator(".style-tile").count();
check("style tiles offered", tiles >= 4, `${tiles} styles`);
check("style tile is visible", await visible(page, ".style-tile"));
const styleShots = await page.evaluate(() =>
  [...document.querySelectorAll(".style-ph img")].filter((i) => i.naturalWidth > 0).length);
check("style photographs load", styleShots >= 4, `${styleShots} of ${tiles}`);
/* every tile must promise stock, or the journey dead-ends */
const emptyTiles = await page.evaluate(() =>
  [...document.querySelectorAll(".style-tile")].filter((t) => /\b0 shades\b/.test(t.textContent)).length);
check("no style promises 0 shades", emptyTiles === 0);

await page.locator(".style-tile").first().click();
await page.waitForTimeout(900);
check("clicking a style opens it", /\/collections\/carpets\/./.test(new URL(page.url()).pathname), page.url());
check("style page shows shades", (await page.locator(".swatch").count()) > 5,
  `${await page.locator(".swatch").count()} shades`);
check("shades are grouped by collection", (await page.locator(".style-range").count()) >= 1);
check("offers the other styles", (await page.locator(".style-chips a").count()) >= 2);

console.log("\nCollections works:");
await page.goto(U("/collections/carpets"), { waitUntil: "networkidle" });
await page.waitForTimeout(1400);
const swatches = await page.locator(".swatch").count();
check("shades render", swatches > 100, `${swatches} tiles`);
check("swatch tile is visible", await visible(page, ".swatch"));
const photos = await page.evaluate(() =>
  [...document.querySelectorAll(".swatch img")].filter((i) => i.naturalWidth > 0).length);
check("swatch photographs load", photos > 10, `${photos} loaded above the fold`);

const before = await page.locator(".swatch").count();
await page.locator('[data-family="Green"]').click();
await page.waitForTimeout(500);
const after = await page.locator(".swatch").count();
check("colour filter narrows results", after > 0 && after < before, `${before} -> ${after}`);
check("active filter pill shown", await page.locator(".pill").count() === 1);
await page.locator("[data-clear]").click();
await page.waitForTimeout(400);
check("clear restores everything", await page.locator(".swatch").count() === before);

console.log("\nLightbox works:");
await page.locator(".swatch .col").first().click();
await page.waitForTimeout(500);
check("opens", await visible(page, "#zoom.open"));
check("shows a shade name", (await page.locator("#zoomBody h3").textContent()).length > 1);
check("shows the large swatch", await visible(page, ".zoom-main"));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("closes on Escape", (await page.locator("#zoom.open").count()) === 0);

console.log("\nFavourites work:");
await page.locator(".swatch .fav").first().click();
await page.waitForTimeout(300);
check("count increments", (await page.locator("#favCount").first().textContent()) === "1");
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
check("survives a reload", (await page.locator("#favCount").first().textContent()) === "1");
await page.goto(U("/favourites"), { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("list page shows the shade", (await page.locator(".swatch").count()) === 1);
const link = await page.evaluate(() => favLink());
const fresh = await openPage(browser);
/* favLink() is a real address now, so it is opened as one. */
await fresh.goto(link, { waitUntil: "networkidle" });
await fresh.waitForTimeout(700);
check("share link restores on a clean browser", (await fresh.locator(".swatch").count()) >= 1);

if (VISUALISER) {
  console.log("\nVisualiser works:");
  await page.goto(U("/visualiser"), { waitUntil: "networkidle" });
  await page.waitForTimeout(2800);
  check("canvas painted", await visible(page, "#visCanvas.ready"));
  check("room options offered", (await page.locator("#vzRooms button").count()) >= 2);
  check("shade strip populated", (await page.locator(".vz-swatch").count()) > 3);
  const firstShade = await page.locator("#vzNowName").textContent();
  await page.locator(".vz-swatch").nth(2).click();
  await page.waitForTimeout(700);
  check("picking a shade changes it", (await page.locator("#vzNowName").textContent()) !== firstShade);
  for (const t of ["wood", "lvt", "vinyl", "rugs"]) {
    await page.locator(`[data-vz-type="${t}"]`).click();
    await page.waitForTimeout(1600);
    check(`${t} type renders`.padEnd(20), await visible(page, "#visCanvas.ready"));
  }
} else {
  console.log("\nVisualiser is switched off:");
  await page.goto(U("/visualiser"), { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  check("its route is a 404", (await page.evaluate(() =>
    document.querySelector("#app").textContent)).includes("couldn't find that page"));
  await page.goto(U("/"), { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("no link to it anywhere on the home page",
    (await page.locator('a[href^="/visualiser"]').count()) === 0);
  await page.goto(U("/collections/carpets"), { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("nor in Collections", (await page.locator('a[href^="/visualiser"]').count()) === 0);
  check("nor in the header or footer", (await page.evaluate(() =>
    document.querySelectorAll('.site-header a[href^="/visualiser"], footer a[href^="/visualiser"]').length)) === 0);
}

/* The banner carousel. A slide with height but no opacity is exactly the fault
   this file was written for, so these check which slide is actually on rather
   than how many exist. */
console.log("\nThe banner carousel works:");
await page.goto(U("/"), { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const slideCount = await page.locator(".hero-slide").count();
check("more than one banner picture", slideCount > 1, `${slideCount} slides`);
check("dots match the pictures", (await page.locator(".hero-dots button").count()) === slideCount);
const onNow = () => page.evaluate(() =>
  [...document.querySelectorAll(".hero-slide")].findIndex((s) => s.classList.contains("on")));
check("exactly one slide is showing", (await page.evaluate(() =>
  document.querySelectorAll(".hero-slide.on").length)) === 1);
check("its photograph loads", await page.evaluate(() =>
  document.querySelector(".hero-slide.on img")?.naturalWidth > 0));
await page.locator(".hero-dots button").nth(2).click();
await page.waitForTimeout(400);
check("a dot switches picture", (await onNow()) === 2);
check("and the third photograph loads too", await page.evaluate(() =>
  document.querySelector(".hero-slide.on img")?.naturalWidth > 0));
/* Hovering pauses it, so the pointer is parked somewhere else first. */
await page.mouse.move(5, 780);
await page.waitForTimeout(7000);
check("it advances on its own", (await onNow()) !== 2, `now on ${await onNow()}`);
check("the headline never moved", await visible(page, ".hero h1"));

console.log("\nCollections, not catalogue:");
const words = await page.evaluate(() => ({
  nav: [...document.querySelectorAll(".nav a")].map((a) => a.textContent.trim()),
  page: document.body.innerText,
}));
check("the menu says Collections", words.nav.includes("Collections"));
check("the menu says Contact us", words.nav.includes("Contact us"));
const stillSaysIt = [];
for (const hash of ["/", "/collections", "/collections/carpets", "/collections/carpets/easy-clean",
                    "/range/westex-elysian", "/favourites", "/about", "/contact", "/enquire"]) {
  await page.goto(U(hash), { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const text = await page.evaluate(() => document.body.innerText);
  if (/catalogue/i.test(text)) stillSaysIt.push(`${hash}: ${(text.match(/.{0,24}atalogue/i) || [""])[0]}`);
}
check("no page says Catalogue anywhere", stillSaysIt.length === 0, stillSaysIt[0] || "");
await page.goto(U("/"), { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const cta = await page.locator('.hero-cta a[href="/enquire"]').first();
check("the banner button asks for an enquiry",
  /enquir/i.test((await cta.textContent()).trim()), (await cta.textContent()).trim());

await page.goto(U("/catalogue/carpets"), { waitUntil: "networkidle" });
await page.waitForTimeout(900);
check("the old catalogue link still lands somewhere",
  new URL(page.url()).pathname === "/collections/carpets", page.url());
check("and that page has shades on it", (await page.locator(".swatch").count()) > 50);

console.log("\nEvery page says what it is:");
{
  /* One <title> for nine pages is a browser tab, a bookmark and a shared link
     all saying the same wrong thing. This does not make the hash routes
     indexable — nothing can, short of real paths — it makes them legible. */
  const seen = [];
  for (const [hash, want] of [
    ["/", /Carpet & Flooring Showroom, Hounslow/],
    ["/collections", /^Collections —/],
    ["/collections/carpets", /^Carpets —/],
    ["/about", /^About us —/],
    ["/contact", /^Visit the showroom —/],
    ["/enquire", /^Get in touch —/],
    ["/portfolio", /^Our work —/],
    ["/favourites", /^My Favourites —/],
  ]) {
    await page.goto(U(hash), { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const title = await page.title();
    if (!want.test(title)) seen.push(`${hash}: ${title}`);
  }
  check("each page has its own title", seen.length === 0, seen.join(" | "));

  await page.goto(U("/about"), { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const meta = await page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.content,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content,
    ogDesc: document.querySelector('meta[property="og:description"]')?.content,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
  }));
  check("with a description to match", /family-run flooring business/i.test(meta.description),
    meta.description);
  check("and the sharing card follows it",
    /^About us —/.test(meta.ogTitle) && meta.ogDesc === meta.description, meta.ogTitle);
  /* Absolute, on the shop's own domain, and pointing at this page — not at
     the root, and not at 127.0.0.1. A share preview is fetched by somebody
     else's server, so what it reads has to be the real address of the page
     rather than whichever host this browser happens to be pointed at. */
  check("the canonical is this page, absolute, on the real domain",
    meta.canonical === "https://haris-carpets.co.uk/about", meta.canonical);

  /* A collection is the page somebody arrives on from a search for a range. */
  await page.goto(U("/range/westex-ultima"), { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  check("a collection page names the collection and the mill",
    /Ultima/i.test(await page.title()) && /Westex/i.test(await page.title()),
    await page.title());
}

console.log("\nWhat a search engine is given:");
{
  /* The structured data is what makes this a shop in Hounslow to Google
     rather than a page that mentions Hounslow. */
  const html = await (await page.request.get(`${BASE}/index.html`)).text();
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  check("there is a structured-data block", Boolean(block));
  let data = null;
  try { data = JSON.parse(block[1]); } catch { /* reported below */ }
  check("and it is valid JSON", data !== null);
  check("describing a business", /Business|Store|LocalBusiness/.test(data?.["@type"] || ""),
    data?.["@type"]);
  check("at the shop's real address",
    data?.address?.streetAddress === "267 Hanworth Road"
    && data?.address?.postalCode === "TW3 3RZ", JSON.stringify(data?.address));
  check("with the phone number the site shows",
    (data?.telephone || "").replace(/\D/g, "") === "442085706502", data?.telephone);
  check("and where it is on a map",
    typeof data?.geo?.latitude === "number" && typeof data?.geo?.longitude === "number");
  /* Hours are the one thing Google prints as fact, and the shipped hours are
     still a placeholder. Publishing a guess sends somebody to a closed shop. */
  check("but no opening hours, because they are not confirmed yet",
    !("openingHoursSpecification" in (data || {})));

  const robots = await page.request.get(`${BASE}/robots.txt`);
  check("robots.txt is served", robots.ok());
  const robotsText = await robots.text();
  check("it keeps the admin out of search results", /Disallow: \/admin/.test(robotsText));
  check("and points at the sitemap", /Sitemap: https:\/\//.test(robotsText));

  const sitemap = await page.request.get(`${BASE}/sitemap.xml`);
  check("the sitemap is served", sitemap.ok());
  check("as XML a crawler will read",
    /schemas\/sitemap\/0\.9/.test(await sitemap.text()));
}

console.log("\nThe site has an icon of its own:");
{
  /* Without these Google shows a blank page-shape next to the result. Each
     file is fetched rather than just found in the markup: a <link> to a 404 is
     the same as no icon at all, and worse because it looks done. */
  await page.goto(U("/"), { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')]
      .map((l) => ({ rel: l.getAttribute("rel"), href: l.getAttribute("href"),
                     sizes: l.getAttribute("sizes") })));
  check("an SVG icon is declared",
    links.some((l) => /icon\.svg$/.test(l.href)), JSON.stringify(links));
  check("a PNG for Google, at the size it asks for",
    links.some((l) => l.sizes === "48x48"), JSON.stringify(links.map((l) => l.sizes)));
  check("and one for a phone's home screen",
    links.some((l) => l.rel === "apple-touch-icon"));

  const missing = [];
  for (const l of links) {
    const res = await page.request.get(new URL(l.href, `${BASE}/index.html`).toString());
    if (!res.ok()) missing.push(`${l.href} → ${res.status()}`);
  }
  check("every one of them is actually there", missing.length === 0, missing.join(", "));

  /* The icon is on the pages Google fetches on their own, not only the app.
     Read as bytes rather than rendered: data-deletion.html redirects itself
     with a meta refresh, so a rendered check races the navigation — and bytes
     are what a crawler sees anyway. */
  for (const file of ["privacy.html", "data-deletion.html"]) {
    const html = await (await page.request.get(`${BASE}/${file}`)).text();
    check(`${file} has it too`, /<link rel="icon"/.test(html));
  }

  /* And what a shared link looks like. */
  await page.goto(U("/"), { waitUntil: "domcontentloaded" });
  const og = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll("meta[property^='og:']")]
      .map((m) => [m.getAttribute("property"), m.getAttribute("content")])));
  check("a shared link has a title", Boolean(og["og:title"]));
  check("a description", Boolean(og["og:description"]));
  check("and a picture", /^https:\/\/.+\.jpg$/.test(og["og:image"] || ""), og["og:image"]);
  /* A share preview is fetched by somebody else's server, so a relative URL
     resolves against nothing. */
  check("given absolutely, because someone else's server fetches it",
    (og["og:image"] || "").startsWith("https://") && (og["og:url"] || "").startsWith("https://"));
}

console.log("\nNo supplier codes anywhere a customer looks:");
{
  /* CC-AP on a collection page, ALU01 under a shade name. Both are how the
     mill files it, neither is anything somebody choosing a carpet is picking
     between, and both read like a fault on the page. Checked against the real
     codes out of the catalogue rather than a pattern, so this cannot pass by
     matching nothing. */
  const codes = await page.evaluate(() => {
    const ranges = CATALOGUE.filter((r) => r.type === "carpets").slice(0, 6);
    return {
      range: ranges.map((r) => r.code).filter(Boolean),
      shade: ranges.flatMap((r) => r.colours.map((c) => c.code)).filter(Boolean),
      id: ranges[0].id,
    };
  });
  check("the catalogue does still carry the codes",
    codes.range.length > 3 && codes.shade.length > 10,
    `${codes.range.length} range, ${codes.shade.length} shade`);

  const seen = [];
  for (const hash of ["/collections/carpets", `/range/${codes.id}`, "/favourites"]) {
    await page.goto(U(hash), { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const text = await page.evaluate(() => document.body.innerText);
    for (const c of [...codes.range, ...codes.shade]) {
      if (text.includes(c)) seen.push(`${hash}: ${c}`);
    }
  }
  check("no supplier code on the collections page, a collection, or favourites",
    seen.length === 0, seen.slice(0, 3).join(" | "));
  check("and the words Range code are gone with them",
    !/range code/i.test(await page.evaluate(() => document.body.innerText)));

  /* The lightbox is its own render and had the shade code under the name. */
  await page.goto(U(`/range/${codes.id}`), { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator(".swatch").first().click();
  await page.waitForTimeout(600);
  const zoom = await page.locator("#zoomBody").innerText();
  check("the lightbox opens", zoom.length > 3);
  check("and carries no code either",
    ![...codes.shade].some((c) => zoom.includes(c)), zoom.replace(/\n/g, " ").slice(0, 60));
  check("it still says the collection and the colour family",
    (await page.locator(".zoom-sub").innerText()).includes("·"));
  await page.keyboard.press("Escape");
}

console.log("\nThe words the shop asked us to change:");
{
  /* Each of these is a line the owner sent back twice. A rename that only
     half-lands — the header but not the footer, the page but not the
     breadcrumb — is how it came back the second time. */
  await page.goto(U("/favourites"), { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  /* Case-insensitively: the header button is uppercased in CSS, so innerText
     comes back shouting and an exact match would be testing the stylesheet. */
  check("the header button says My Favourites",
    /my favourites/i.test(await page.locator("#favBtn").innerText()),
    (await page.locator("#favBtn").innerText()).replace(/\n/g, " "));
  check("so does the footer link",
    /^my favourites$/i.test((await page.locator('footer a[href="/favourites"]').innerText()).trim()));
  const anywhere = [];
  for (const hash of ["/", "/favourites", "/collections/carpets"]) {
    await page.goto(U(hash), { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => document.body.innerText);
    if (/my list/i.test(t)) anywhere.push(hash);
  }
  check("and nothing anywhere still says My list", anywhere.length === 0, anywhere.join(", "));

  /* The mill's range code (CC-AE) read as a fault on the card. */
  await page.goto(U("/collections/carpets"), { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator('[data-view="ranges"]').click();
  await page.waitForTimeout(700);
  const cardMeta = await page.evaluate(() =>
    [...document.querySelectorAll(".card .k")].map((e) => e.textContent.trim()));
  check("collection cards are shown", cardMeta.length > 5, `${cardMeta.length} cards`);
  check("with no supplier code beside the brand",
    cardMeta.every((t) => !/·/.test(t)), cardMeta.find((t) => /·/.test(t)) || "");

  /* The style tiles: renamed, and every one carries a picture. */
  const tileNames = await page.evaluate(() =>
    [...document.querySelectorAll(".style-cap h3")].map((h) => h.textContent.trim()));
  check("the style tiles use the new names",
    tileNames.includes("Easy-Clean Carpets") && tileNames.includes("Wool Twist-Pile Carpets"),
    tileNames.join(", "));

  /* "London & the Home Counties" used to be glued onto the end of the Visit us
     paragraph with no way to tell where it came from. */
  await page.goto(U("/contact"), { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll(".info-row .il")].map((e) => e.textContent.trim()));
  check("the area covered is its own labelled line", rows.includes("We cover"), rows.join(", "));
  const lede = await page.evaluate(() => document.querySelector(".contact-grid .lede")?.innerText || "");
  check("and not stuck on the end of the paragraph", !/M25/.test(lede), lede.slice(-40));
}

console.log("\nThe About page reads as one column, not a heading and a hole:");
{
  await page.goto(U("/about"), { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const gap = await page.evaluate(() => {
    const h = document.querySelector(".split-copy h2");
    const p = document.querySelector(".split-copy .prose p");
    if (!h || !p) return null;
    return Math.round(p.getBoundingClientRect().top - h.getBoundingClientRect().bottom);
  });
  /* The text used to start below the photograph, which on this viewport put
     several hundred pixels of nothing between the title and the first word. */
  check("the text starts under the title", gap !== null && gap < 80, `${gap}px below it`);
  const both = await page.evaluate(() => {
    const copy = document.querySelector(".split-copy")?.getBoundingClientRect();
    const pic = document.querySelector(".split-media")?.getBoundingClientRect();
    return copy && pic ? Math.round(Math.abs(copy.top - pic.top)) : null;
  });
  check("and the photograph starts level with it", both !== null && both < 40, `${both}px apart`);
  check("the About photograph loads",
    await page.evaluate(() => {
      const i = document.querySelector(".split-media img");
      return Boolean(i && i.naturalWidth > 0);
    }));
}

console.log("\nThe privacy policy is a page Meta and Google can read:");
{
  const res = await page.goto(`${BASE}/privacy.html`, { waitUntil: "networkidle" });
  check("it is served as a real page", res.status() === 200, String(res.status()));
  /* One link in the footer, not two: deleting your information is a section of
     this page, so a second link was two names for one document. */
  const legal = await page.goto(U("/"), { waitUntil: "networkidle" })
    .then(() => page.waitForTimeout(700))
    .then(() => page.evaluate(() =>
      [...document.querySelectorAll(".fine-links a")].map((a) => a.textContent.trim())));
  check("the footer offers one legal link", legal.length === 1, legal.join(", "));
  check("and it is the Privacy Policy", legal[0] === "Privacy Policy", legal[0]);
  await page.goto(`${BASE}/privacy.html`, { waitUntil: "networkidle" });
  check("titled Privacy Policy", (await page.title()).startsWith("Privacy Policy"), await page.title());
  check("and headed the same", (await page.locator("h1").innerText()).trim() === "Privacy Policy");
  const text = await page.evaluate(() => document.body.innerText);
  check("it names who holds the data", /Cloudflare/.test(text));
  check("says how long for", /twelve months/i.test(text));
  /* No email provider is in the chain today. If one is ever switched on, this
     page has to name it — and this assertion is what fails until it does. */
  check("and names no email provider it does not use", !/Resend/i.test(text));

  /* Analytics and the policy, tied together in both directions. Switching the
     beacon on without saying so here makes this page untrue on the day it
     deploys; saying so without switching it on is a different kind of wrong.
     Either mistake fails this. */
  const token = (await import("node:fs")).readFileSync(
    new URL("../public/data.js", import.meta.url), "utf8")
    .match(/const ANALYTICS = \{ token: "([^"]*)" \}/)?.[1] ?? null;
  check("the analytics switch is readable", token !== null);
  const claims = /Cloudflare Web Analytics/i.test(text);
  check(token ? "the policy names the analytics that are running"
              : "the policy claims no analytics, and there are none",
    token ? claims : !claims,
    token ? `token set, policy mentions it: ${claims}` : "no token, no claim");

  check("the wordmark has no stale 32-years line under it", !/Est\. 32/.test(text));
  check("deleting your information is a section of it now",
    (await page.locator("#deleting").count()) === 1);
  check("and explains how to ask", /Delete my information/.test(text));

  /* And the site itself must match the switch. Last in this block, because it
     navigates away from the policy page. */
  await page.goto(U("/"), { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const beacons = await page.evaluate(() =>
    document.querySelectorAll('script[src*="cloudflareinsights"]').length);
  check(token ? "the beacon is on the page" : "no beacon on the page",
    token ? beacons === 1 : beacons === 0, `${beacons} beacon(s)`);

  /* The old URL is in the Meta app's data deletion field and in anybody's
     bookmarks. It has to keep resolving, and it has to still answer the
     question for a checker that does not follow a redirect. */
  const del = await page.goto(`${BASE}/data-deletion.html`, { waitUntil: "domcontentloaded" });
  check("the old deletion URL still resolves", del.status() === 200);
  check("and still answers the question on its own",
    /Delete my information/.test(await page.evaluate(() => document.body.innerText)));
}

console.log("\nThe portfolio page:");
await page.goto(U("/portfolio"), { waitUntil: "networkidle" });
await page.waitForTimeout(700);
check("it is in the menu", (await page.locator('.nav a[href="/portfolio"]').count()) === 1);
check("and in the footer", (await page.locator('footer a[href="/portfolio"]').count()) === 1);
/* Nothing is shipped for this page — a portfolio of stock photography would be
   a lie — so with no admin overlay it must say so rather than show empty frames. */
check("with no jobs added it says so rather than showing empty frames",
  (await page.locator(".folio-item").count()) === 0
  && /showroom/i.test(await page.evaluate(() => document.querySelector("#app").innerText)));
check("and the page is still worth landing on", await visible(page, "#app section"));

console.log("\nThe address is an address, not a run-on line:");
await page.goto(U("/contact"), { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const lines = await page.evaluate(() =>
  (document.querySelector(".info-row a[href*='maps']")?.innerHTML || "").split(/<br\s*\/?>/i).length);
check("the showroom address is on four lines", lines === 4, `${lines} lines`);
const footLines = await page.evaluate(() =>
  (document.getElementById("footAddress")?.innerHTML || "").split(/<br\s*\/?>/i).length);
/* applyContentToChrome used to set textContent here, which flattened the <br>
   out of the markup on every render — the reason nobody could get the footer
   address onto more than one line. */
check("and so is the one in the footer", footLines === 4, `${footLines} lines`);

console.log("\nThe enquiry form does not lie to anyone:");
await page.goto(U("/enquire"), { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const formText = await page.evaluate(() => document.querySelector("#app").innerText);
check("nothing on the page says demo", !/demo/i.test(formText),
  (formText.match(/.{0,30}demo.{0,30}/i) || [""])[0]);
const topics = await page.locator("#w option").allTextContents();
check("the measure option is gone from the dropdown",
  !topics.some((t) => /measure/i.test(t)), topics.join(", "));
const hp = await page.evaluate(() => {
  const el = document.querySelector('#enquiry input[name="website"]');
  if (!el) return null;
  return { type: el.type, height: el.offsetHeight, inView: el.getBoundingClientRect().right > 0 };
});
check("there is a honeypot field", hp !== null);
/* type=hidden is what a form-filling bot skips, so it must be a real text
   input that CSS has taken out of the layout instead. */
check("it is a real input a bot will fill in, hidden with CSS", hp?.type === "text" && !hp?.inView);

/* The stub is told to refuse the next enquiry. That is the point of this
   block: whatever goes wrong at the far end, the visitor must be told the
   truth and must not lose what they typed.

   It used to get this for free, by running against a static server with no
   API behind it at all. That stopped being possible when the pages became
   real addresses — a static server answers /collections/lvt with a 404 — so
   the failure is now asked for deliberately, which is a better test anyway:
   it proves the refusal path rather than the absence of a back end. */
await fetch(`${BASE}/_enquiry?mode=fail`);
expectFailures = true;
await page.fill("#n", "Test Visitor");
await page.fill("#e", "test@example.com");
await page.fill("#m", "Stairs and landing please.");
await page.waitForTimeout(3200);   // the form refuses anything sent inside 3s
const posted = page.waitForRequest((r) => r.url().includes("/api/enquiry"), { timeout: 5000 });
await page.locator("#enquiry button[type=submit]").click();
let sentIt = true;
try { await posted; } catch { sentIt = false; }
check("submitting actually posts the enquiry", sentIt);
await page.waitForTimeout(900);
check("with nothing to take it, the visitor is not thanked",
  (await page.locator("#enquiry h3").count()) === 0);
check("what they typed is still there",
  (await page.inputValue("#m")) === "Stairs and landing please.");
check("and they are given another way through",
  (await page.locator('#enquiryNote a[href^="mailto:"]').count()) === 1);
check("with their message already in it", await page.evaluate(() =>
  decodeURIComponent(document.querySelector('#enquiryNote a[href^="mailto:"]')?.href || "")
    .includes("Stairs and landing")));
expectFailures = false;

console.log("\nThe footer:");
await page.goto(U("/"), { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const marks = await page.locator("#footSocials a").count();
check("social links are in the footer", marks >= 3, `${marks} links`);
check("each one is a mark, not more link text",
  (await page.locator("#footSocials a svg").count()) === marks);
check("and each is named for a screen reader", await page.evaluate(() =>
  [...document.querySelectorAll("#footSocials a")].every((a) => a.getAttribute("aria-label"))));
/* The rule under the wordmark was a fixed pixel width measured against a
   fallback font, so it hung past the end of the words as soon as the real one
   loaded. It comes from the text now, and this proves it in a font the number
   was never measured against. */
const ruleFits = await page.evaluate(() => {
  document.documentElement.style.setProperty("--f-display", "Georgia, serif");
  const el = document.querySelector(".site-footer .fbrand");
  const r = document.createRange(); r.selectNodeContents(el);
  const text = r.getBoundingClientRect().width;
  const rule = document.querySelector(".site-footer .br").getBoundingClientRect().width;
  document.documentElement.style.removeProperty("--f-display");
  return { text: Math.round(text), rule: Math.round(rule) };
});
check("the footer rule is exactly as wide as the wordmark",
  Math.abs(ruleFits.rule - ruleFits.text) <= 2, `text ${ruleFits.text} vs rule ${ruleFits.rule}`);

console.log("\nMobile:");
const mob = await openPage(browser, { viewport: { width: 390, height: 844 } });
for (const hash of ["/", "/collections/carpets", "/enquire"]) {
  await mob.goto(U(hash), { waitUntil: "networkidle" });
  await mob.waitForTimeout(700);
  const scrolls = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`no sideways scroll on ${hash}`.padEnd(34), !scrolls);
}

console.log("\nNo errors:");
check("no uncaught JS errors", errors.length === 0, errors.slice(0, 2).join(" | "));
check("no failed requests", badResponses.length === 0, badResponses.slice(0, 2).join(" | "));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
