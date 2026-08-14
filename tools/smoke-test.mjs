/**
 * End-to-end smoke test for the site.
 *
 *     npx http-server public -p 8899 &
 *     node tools/smoke-test.mjs [http://127.0.0.1:8899]
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
const U = (hash) => `${BASE}/index.html${hash}`;

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
  ["#/", "home"],
  ["#/catalogue", "catalogue index"],
  ["#/catalogue/carpets", "carpets"],
  ["#/catalogue/wood", "wood"],
  ["#/catalogue/lvt", "lvt"],
  ["#/catalogue/vinyl", "vinyl"],
  ["#/catalogue/rugs", "rugs"],
  ["#/catalogue/carpets/easy-clean", "a carpet style"],
  ["#/catalogue/carpets/loop", "another style"],
  ["#/catalogue/wood/herringbone", "a wood style"],
  ["#/catalogue/lvt/stone-effect", "an lvt style"],
  ["#/catalogue/carpets/pattern", "an empty style 404s"],
  ["#/range/westex-elysian", "a range"],
  ["#/favourites", "favourites"],
  ["#/visualiser", "visualiser"],
  ["#/about", "about"],
  ["#/contact", "contact"],
  ["#/does-not-exist", "404"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

const errors = [], badResponses = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  /* /api/site is the admin overlay, served by the Worker. This file runs
     against a plain static server, so its absence here is the point rather
     than a fault: the shop has to be complete without it. There is an explicit
     assertion for that below. */
  if (r.status() >= 400 && !r.url().includes("/api/site")) {
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
  await page.goto(U(hash), { waitUntil: "networkidle" });
  await page.waitForTimeout(hash === "#/visualiser" ? 2600 : 500);
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

/* The catalogue is generated from supplier filenames, and every bug worth
   having in it so far has been a parsing one — a range name kept as a colour,
   the same range emitted twice, a photo filed as a swatch. These assert the
   shape of the data rather than the look of the page. */
console.log("\nCatalogue data is sane:");
await page.goto(U("#/catalogue"), { waitUntil: "networkidle" });
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

/* Three dead ids here meant the home page showed no featured ranges at all,
   and nothing said so — the list is filtered by findRange, so a stale id is
   indistinguishable from an empty section. */
const feat = await page.evaluate(() =>
  FEATURED.map((id) => ({ id, ok: CATALOGUE.some((r) => r.id === id) })));
check("featured ranges all exist", feat.every((f) => f.ok),
  feat.filter((f) => !f.ok).map((f) => f.id).join(", ") || `${feat.length} on the home page`);

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
await page.goto(U("#/catalogue/carpets"), { waitUntil: "networkidle" });
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
check("clicking a style opens it", /#\/catalogue\/carpets\/./.test(page.url()), page.url().split("#")[1]);
check("style page shows shades", (await page.locator(".swatch").count()) > 5,
  `${await page.locator(".swatch").count()} shades`);
check("shades are grouped by collection", (await page.locator(".style-range").count()) >= 1);
check("offers the other styles", (await page.locator(".style-chips a").count()) >= 2);

console.log("\nCatalogue works:");
await page.goto(U("#/catalogue/carpets"), { waitUntil: "networkidle" });
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
await page.goto(U("#/favourites"), { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check("list page shows the shade", (await page.locator(".swatch").count()) === 1);
const link = await page.evaluate(() => favLink());
const fresh = await (await browser.newContext()).newPage();
await fresh.goto(BASE + "/index.html" + link.split("#")[1] ? link : U("#/favourites"), { waitUntil: "networkidle" });
await fresh.waitForTimeout(700);
check("share link restores on a clean browser", (await fresh.locator(".swatch").count()) >= 1);

console.log("\nVisualiser works:");
await page.goto(U("#/visualiser"), { waitUntil: "networkidle" });
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

console.log("\nMobile:");
const mob = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
for (const hash of ["#/", "#/catalogue/carpets", "#/visualiser"]) {
  await mob.goto(U(hash), { waitUntil: "networkidle" });
  await mob.waitForTimeout(hash === "#/visualiser" ? 2600 : 700);
  const scrolls = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`no sideways scroll on ${hash}`.padEnd(34), !scrolls);
}

console.log("\nNo errors:");
check("no uncaught JS errors", errors.length === 0, errors.slice(0, 2).join(" | "));
check("no failed requests", badResponses.length === 0, badResponses.slice(0, 2).join(" | "));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
