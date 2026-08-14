/**
 * End-to-end test for the admin page and the overlay it writes.
 *
 *     node tools/stub-api.mjs 8890 &
 *     node tools/admin-e2e.mjs
 *
 * admin.test.mjs covers the API on its own. This covers the two things that
 * only show up when the whole thing runs together: that a change made in the
 * admin actually reaches the shop's pages, and — the one that matters more —
 * that the shop is completely unaffected when the admin API is unreachable.
 * The catalogue is bundled with the site, so a broken overlay must cost a
 * customer nothing at all.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:8890";
const DOWN = process.argv[3] || "http://127.0.0.1:8891";   // same site, failing API
const ANON = process.argv[4] || "http://127.0.0.1:8892";   // not signed in

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const go = async (url, wait = 900) => {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
};

console.log("\nadmin end to end\n");

console.log("The admin page loads and knows who is signed in:");
await go(`${BASE}/admin/`);
check("signed in", (await page.locator("#who").textContent()).includes("@"));
check("no sign-in gate", await page.locator("#gate").isHidden());
check("tabs offered", (await page.locator(".mg-tab").count()) === 4);
check("collections listed", (await page.locator("[data-tab='collections']").click(),
  await page.waitForTimeout(400), (await page.locator(".mg-row").count()) > 40),
  `${await page.locator(".mg-row").count()} collections`);

console.log("\nSearching 48 collections:");
{
  const all = await page.locator(".mg-row").count();
  await page.locator("#search").fill("westex");
  await page.waitForTimeout(300);
  const shown = await page.locator(".mg-row:visible").count();
  check("search narrows the list", shown > 0 && shown < all, `${all} → ${shown}`);
  await page.locator("#search").fill("");
  await page.waitForTimeout(250);
  check("clearing it brings them all back", (await page.locator(".mg-row:visible").count()) === all);
}

console.log("\nHiding a collection:");
const firstName = (await page.locator(".mg-row-main b").first().textContent()).trim();
const rangeId = await page.evaluate(() => CATALOGUE[0].id);
await page.locator(`[data-hide="${rangeId}"]`).click();
await page.waitForTimeout(300);
check("row shows as hidden", (await page.locator(".mg-row").first().getAttribute("class")).includes("off"));
check("save button wakes up", !(await page.locator("#save").isDisabled()));
await page.locator("#save").click();
await page.waitForTimeout(700);
check("saved", (await page.locator("#state").textContent()).toLowerCase().includes("saved"),
  await page.locator("#state").textContent());

console.log("\n…takes it off the shop:");
await go(`${BASE}/index.html#/catalogue/carpets`, 1500);
const gone = await page.evaluate((id) => !RANGES.some((r) => r.id === id), rangeId);
check("the collection is gone from the catalogue", gone, firstName);
const stillInSource = await page.evaluate((id) => CATALOGUE.some((r) => r.id === id), rangeId);
check("but the generated catalogue is untouched", stillInSource);

console.log("\n…and a saved shortlist still resolves:");
const key = await page.evaluate((id) => id + ":" + slugify(CATALOGUE[0].colours[0].name), rangeId);
const resolves = await page.evaluate((k) => {
  const [rid, slug] = k.split(":");
  const r = CATALOGUE.find((x) => x.id === rid);
  return Boolean(r && r.colours.some((c) => slugify(c.name) === slug));
}, key);
check("the shade's key still exists in the source", resolves, key);

console.log("\nPutting it back:");
await go(`${BASE}/admin/`);
await page.locator("[data-tab='collections']").click();
await page.waitForTimeout(400);
await page.locator(`[data-hide="${rangeId}"]`).click();
await page.locator("#save").click();
await page.waitForTimeout(700);
await go(`${BASE}/index.html#/catalogue/carpets`, 1500);
check("the collection is back", await page.evaluate((id) => RANGES.some((r) => r.id === id), rangeId));

console.log("\nRenaming a shade reaches the shop:");
await go(`${BASE}/admin/`);
await page.locator("[data-tab='collections']").click();
await page.waitForTimeout(400);
await page.locator(`[data-shades="${rangeId}"]`).click();
await page.waitForTimeout(400);
check("shade editor opens", (await page.locator(".mg-sw").count()) > 1);
/* Ultima runs to 119 shades; without a filter, hiding one means scrolling */
{
  const all = await page.locator(".mg-sw").count();
  await page.locator("#shadeSearch").fill(
    (await page.locator("[data-rename]").first().inputValue()).slice(0, 4));
  await page.waitForTimeout(300);
  const shown = await page.locator(".mg-sw:visible").count();
  check("shade search narrows the list", shown > 0 && shown < all, `${all} → ${shown}`);
  await page.locator("#shadeSearch").fill("");
  await page.waitForTimeout(200);
}
const renameKey = await page.locator("[data-rename]").first().getAttribute("data-rename");
await page.locator("[data-rename]").first().fill("Renamed By Hari");
await page.locator("#save").click();
await page.waitForTimeout(700);
await go(`${BASE}/index.html#/catalogue/carpets`, 1500);
check("the new name is on the site",
  await page.evaluate(() => allSwatches().some((s) => s.name === "Renamed By Hari")), renameKey);

console.log("\nRe-filing a collection under a different style:");
await go(`${BASE}/admin/`);
await page.locator("[data-tab='styles']").click();
await page.waitForTimeout(500);
const tick = page.locator('[data-style^="carpets|easy-clean"]').first();
const tickedId = await tick.getAttribute("value");
const wasChecked = await tick.isChecked();
await tick.setChecked(!wasChecked);
await page.locator("#save").click();
await page.waitForTimeout(700);
await go(`${BASE}/index.html#/catalogue/carpets/easy-clean`, 1500);
const nowIn = await page.evaluate(() =>
  stylesFor("carpets").find((s) => s.id === "easy-clean")?.list.map((r) => r.id) || []);
check("the style list followed the tick", nowIn.includes(tickedId) === !wasChecked,
  `${tickedId} ${wasChecked ? "removed" : "added"}`);

console.log("\nThe home page picks up featured changes:");
await go(`${BASE}/admin/`);
await page.locator("[data-tab='home']").click();
await page.waitForTimeout(400);
check("featured options offered", (await page.locator("[data-featured]").count()) > 10);

console.log("\nAdding a collection and a shade from a photograph:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='collections']").click();
  await page.waitForTimeout(400);
  await page.locator("#addRange").click();
  await page.locator("#nrName").fill("Highland Twist");
  await page.locator("#nrBrand").fill("Test Mill");
  await page.locator("#nrType").selectOption("carpets");
  await page.locator("#createRange").click();
  await page.waitForTimeout(500);
  check("lands straight in the new collection",
    (await page.locator("h2").textContent()).includes("Highland Twist"));

  /* a real swatch photograph, so the measurement runs on real pile */
  const photo = new URL("../public/assets/swatches/westex-ultima/alabaster.jpg", import.meta.url).pathname;
  await page.locator("#newShadeName").fill("Shop Oatmeal");
  await page.locator("#newShadeFile").setInputFiles(photo);
  await page.waitForTimeout(1200);
  const measured = await page.locator("#measured").textContent();
  check("the colour is measured from the photo", /Measured #[0-9a-f]{6}/.test(measured), measured.trim());

  /* The whole design rests on this: adding a shade in the browser has to be as
     accurate as running the Python pipeline, or the admin quietly degrades the
     catalogue every time it is used. Same photograph, same rule — median of the
     central half — so the two should agree to within rounding. */
  const mine = measured.match(/#[0-9a-f]{6}/)[0];
  const theirs = await page.evaluate(() =>
    CATALOGUE.find((r) => r.id === "westex-ultima").colours.find((c) => c.name === "Alabaster").hex);
  const drift = [1, 3, 5].map((i) =>
    Math.abs(parseInt(mine.slice(i, i + 2), 16) - parseInt(theirs.slice(i, i + 2), 16)));
  check("and agrees with the pipeline that measured the catalogue",
    Math.max(...drift) <= 2, `browser ${mine} vs pipeline ${theirs}`);
  check("add is enabled once there's a name and a photo", !(await page.locator("#addShade").isDisabled()));

  await page.locator("#addShade").click();
  await page.waitForTimeout(900);
  check("the shade is listed", (await page.locator(".mg-sw").count()) === 1);

  /* the same name twice would collide on the tile path and the saved key */
  await page.locator("#newShadeName").fill("Shop Oatmeal");
  await page.locator("#newShadeFile").setInputFiles(photo);
  await page.waitForTimeout(1000);
  await page.locator("#addShade").click();
  await page.waitForTimeout(400);
  check("a duplicate name is refused",
    (await page.locator("#shadeErr").textContent()).includes("already"));

  await page.locator("#save").click();
  await page.waitForTimeout(800);
  await go(`${BASE}/index.html#/catalogue/carpets`, 1600);
  const live = await page.evaluate(() =>
    allSwatches().find((s) => s.name === "Shop Oatmeal"));
  check("the new shade is on the shop", Boolean(live), live && `${live.range} · ${live.hex}`);
  check("and it was filed under a real colour family",
    Boolean(live) && live.family && live.family.length > 2, live && live.family);
}

console.log("\nWhen the admin API is down the shop does not notice:");
{
  const p2 = await (await browser.newContext()).newPage();
  const errs = [];
  p2.on("pageerror", (e) => errs.push(e.message));
  await p2.goto(`${DOWN}/index.html#/catalogue/carpets`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(1800);
  const n = await p2.locator(".swatch").count();
  check("the catalogue still renders in full", n > 100, `${n} shades`);
  check("no errors reach the visitor", errs.length === 0, errs.slice(0, 1).join());
  const painted = await p2.evaluate(() => {
    const app = document.querySelector("#app");
    return [...app.children].filter((el) => Number(getComputedStyle(el).opacity) >= 0.05)
      .reduce((t, el) => t + el.getBoundingClientRect().height, 0);
  });
  check("and the page is visible, not blank", painted > 500, `${Math.round(painted)}px`);
  await p2.close();
}

console.log("\nSomeone not signed in gets a door, not a form:");
{
  const p3 = await (await browser.newContext()).newPage();
  await p3.goto(`${ANON}/admin/`, { waitUntil: "networkidle" });
  await p3.waitForTimeout(700);
  check("the gate is shown", await p3.locator("#gate").isVisible());
  check("and it explains what to do",
    (await p3.locator("#gateBody").textContent()).length > 20);
  check("no editing controls are usable", (await p3.locator(".mg-row").count()) === 0);
  await p3.close();
}

console.log("\nSigning in with the site password:");
{
  const PW = process.argv[6] || "http://127.0.0.1:8894";
  const p4 = await (await browser.newContext()).newPage();
  await p4.goto(`${PW}/admin/`, { waitUntil: "networkidle" });
  await p4.waitForTimeout(700);
  check("a password box is offered", await p4.locator("#login").isVisible());
  check("and it says what to do",
    (await p4.locator("#gateBody").textContent()).toLowerCase().includes("password"));

  await p4.locator("#adminPassword").fill("wrong one");
  await p4.locator("#pwGo").click();
  await p4.waitForTimeout(600);
  check("a wrong password is rejected in the page",
    (await p4.locator("#pwErr").textContent()).length > 3,
    await p4.locator("#pwErr").textContent());
  check("and the gate is still up", await p4.locator("#gate").isVisible());

  await p4.locator("#adminPassword").fill("correct-horse-battery-staple");
  await p4.locator("#pwGo").click();
  await p4.waitForTimeout(1400);
  check("the right password gets in", await p4.locator("#gate").isHidden());
  check("and the admin is usable", (await p4.locator(".mg-tab").count()) === 4);

  /* the password must not linger anywhere the next person could read it */
  const leaked = await p4.evaluate(() => {
    const hay = [document.body.innerHTML, JSON.stringify(localStorage),
                 JSON.stringify(sessionStorage), document.cookie].join(" ");
    return hay.includes("correct-horse-battery-staple");
  });
  check("the password is not left in the page, storage or a readable cookie", !leaked);
  await p4.close();
}

console.log("\nWith Access and a password both configured — the live shape:");
{
  /* This combination was never tested. Each was covered on its own, and the
     one that actually shipped was the pair. */
  const p5 = await (await browser.newContext()).newPage();
  await p5.goto("http://127.0.0.1:8897/admin/", { waitUntil: "networkidle" });
  await p5.waitForTimeout(700);
  check("the form is shown", await p5.locator("#login").isVisible());
  check("the password box is shown", await p5.locator("#adminPassword").isVisible());
  const box = await p5.locator("#adminPassword").boundingBox();
  check("and it has been painted, not just present",
    box && box.height > 20 && box.width > 100,
    box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "no box");
  check("its label is shown too",
    await p5.locator('label[for="adminPassword"]').isVisible());
  check("the box is focused ready to type",
    await p5.evaluate(() => document.activeElement?.id) === "adminPassword");

  await p5.close();

  /* What a content blocker actually does — a cosmetic rule in the stylesheet,
     in place before any script runs. Injecting it afterwards would land after
     the page had already checked, and prove nothing. */
  const blocked = await (await browser.newContext()).newPage();
  await blocked.route("**/admin.css", async (route) => {
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      body: (await res.text()) + "\n#adminPassword { display: none !important }",
    });
  });
  await blocked.goto("http://127.0.0.1:8897/admin/", { waitUntil: "networkidle" });
  await blocked.waitForTimeout(900);
  check("a field hidden by the browser is reported, not left blank",
    (await blocked.locator("#gateBody").textContent()).includes("hiding it"),
    await blocked.locator("#gateBody").textContent());
  await blocked.close();
}

console.log("\nThe gate names the actual problem:");
{
  /* Both of these produced the same unhelpful "check your Zero Trust path"
     message, which sent you after a setting that could never have worked. */
  const stale = await (await browser.newContext()).newPage();
  await stale.goto("http://127.0.0.1:8895/admin/", { waitUntil: "networkidle" });
  await stale.waitForTimeout(600);
  check("a Worker older than the page says to redeploy",
    (await stale.locator("#gateTitle").textContent()).includes("redeploy"),
    await stale.locator("#gateTitle").textContent());
  await stale.close();

  /* a browser that genuinely believes it is on workers.dev */
  const wd = await chromium.launch({
    args: ["--host-resolver-rules=MAP fake-haris.workers.dev 127.0.0.1"] });
  const p = await (await wd.newContext()).newPage();
  await p.goto("http://fake-haris.workers.dev:8896/admin/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const body = await p.locator("#gateBody").textContent();
  check("on workers.dev it says Access cannot work there",
    body.includes("can't protect a workers.dev address"));
  check("and names the secret to set", body.includes("ADMIN_PASSWORD"));
  check("without sending you to Zero Trust", !body.includes("Zero Trust"));
  await wd.close();
}

console.log("\nNothing here is named like an advert:");
{
  /* The admin's classes were all prefixed "ad-", short for admin. Ad blockers
     carry cosmetic rules for exactly those names, so the header, the tabs and
     every form field were hidden in a normal browser while passing every test
     here, because headless Chromium runs no extensions. The prefix is "mg-"
     now, and this keeps it that way. */
  const p6 = await (await browser.newContext()).newPage();
  await p6.goto(`${BASE}/admin/`, { waitUntil: "networkidle" });
  await p6.waitForTimeout(900);
  const adish = await p6.evaluate(() => {
    /* the shapes filter lists actually carry — "admin" is a word, not a slot */
    const looksLikeAnAd = (s) => /^(ads?|advert\w*)$|^ads?[-_]|^advert[-_]/i.test(s);
    const bad = new Set();
    for (const el of document.querySelectorAll("*")) {
      for (const c of el.classList) if (looksLikeAnAd(c)) bad.add("." + c);
      if (looksLikeAnAd(el.id || "")) bad.add("#" + el.id);
    }
    return [...bad];
  });
  check("no class or id looks like an ad slot", adish.length === 0, adish.join(", "));

  /* and prove the page survives a blocker that hides the usual suspects */
  const blocker = await (await browser.newContext()).newPage();
  await blocker.route("**/admin.css", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text())
      + '\n[class^="ad-"],[class*=" ad-"],[id^="ad-"],.ad,.ads,.advert{display:none!important}' });
  });
  await blocker.goto(`${BASE}/admin/`, { waitUntil: "networkidle" });
  await blocker.waitForTimeout(900);
  check("the header survives an ad blocker", await blocker.locator(".mg-top").isVisible());
  check("the tabs survive", (await blocker.locator(".mg-tab:visible").count()) === 4);
  check("the shop-details fields survive",
    (await blocker.locator(".mg-field:visible").count()) >= 5,
    `${await blocker.locator(".mg-field:visible").count()} fields`);
  await blocker.close();
  await p6.close();
}

console.log("\nNo JS errors in the admin:");
check("clean run", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
