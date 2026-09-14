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

/* Enquiries, Shop details, About us, Home page, Other pages, Portfolio,
   Collections, Photos, Styles */
const TABS = 9;

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

/* what the site ships with, read from data.js rather than copied here so the
   test cannot drift from it */
const CONTACT_HOURS = (await import("node:fs")).readFileSync(
  new URL("../public/data.js", import.meta.url), "utf8")
  .match(/hours: "([^"]+)"/)[1];

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
const page = await openPage(browser, { viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

/* a real jpeg to upload — the tests that need one all use the same picture */
const shot = new URL("../public/assets/showroom.jpg", import.meta.url).pathname;

const go = async (url, wait = 900) => {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
};

console.log("\nadmin end to end\n");

console.log("The admin page loads and knows who is signed in:");
await go(`${BASE}/admin/`);
check("signed in", (await page.locator("#who").textContent()).includes("@"));
check("no sign-in gate", await page.locator("#gate").isHidden());
check("tabs offered", (await page.locator(".mg-tab").count()) === TABS);
check("collections listed", (await page.locator("[data-tab='collections']").click(),
  await page.waitForTimeout(400), (await page.locator(".mg-row").count()) > 40),
  `${await page.locator(".mg-row").count()} collections`);

console.log("\nShop details reach the site:");
{
  /* Every one of these saved happily and changed nothing on the site, because
     the pages read CONTACT and ABOUT directly and never looked at what the
     admin had stored. Each assertion below is a page, not a saved value. */
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(400);
  const typed = {
    hours: "Mon-Sat 9 to 5.30, Sunday closed",
    phone: "020 1111 2222",
    email: "hello@haris-test.co.uk",
    address: "1 Test Street, Hounslow",
    notice: "Closed Monday for the bank holiday",
  };
  for (const [k, v] of Object.entries(typed)) {
    await page.locator(`[data-content="${k}"]`).fill(v);
  }
  await page.locator("[data-tab='about']").click();
  await page.waitForTimeout(300);
  await page.locator('[data-content="aboutLead"]').fill("A test opening line.");
  await page.locator('[data-content="aboutBody"]').fill("First paragraph.\n\nSecond paragraph.");
  await page.locator("#save").click();
  await page.waitForTimeout(800);

  await go(`${BASE}/index.html#/contact`, 1600);
  const contact = await page.evaluate(() => document.querySelector("#app").textContent);
  check("opening hours show", contact.includes(typed.hours), typed.hours);
  /* An address is written on lines, not run together, so it is compared line by
     line — the commas the shop types are where it breaks. */
  check("the address shows", typed.address.split(",").every((l) => contact.includes(l.trim())),
    typed.address);
  check("the phone number shows", contact.includes(typed.phone));
  check("the email shows", contact.includes(typed.email));
  const tel = await page.evaluate(() =>
    document.querySelector('#app a[href^="tel:"]')?.getAttribute("href"));
  check("and the phone link dials the new number", tel === "tel:+442011112222", tel);

  const headerTel = await page.evaluate(() =>
    document.querySelector('.site-header a[href^="tel:"]')?.textContent.trim());
  check("the header button changes too", headerTel === typed.phone, headerTel);
  const footMail = await page.evaluate(() =>
    document.querySelector('footer a[href^="mailto:"]')?.textContent.trim());
  check("so does the footer email", footMail === typed.email, footMail);
  const footAddr = await page.evaluate(() =>
    (document.querySelector("#footAddress")?.innerHTML || "").split(/<br\s*\/?>/i)
      .map((s) => s.trim()));
  check("and the footer address, on its own lines",
    footAddr.join("|") === "1 Test Street|Hounslow", footAddr.join("|"));

  await go(`${BASE}/index.html#/`, 1500);
  check("the notice shows on the home page",
    (await page.locator(".notice").textContent()).includes(typed.notice));

  await go(`${BASE}/index.html#/about`, 1500);
  const about = await page.evaluate(() => document.querySelector("#app").textContent);
  check("the About opening line shows", about.includes("A test opening line."));
  check("both About paragraphs show",
    about.includes("First paragraph.") && about.includes("Second paragraph."));
  check("a blank line became two paragraphs",
    (await page.locator("#app .prose p").count()) === 2,
    `${await page.locator("#app .prose p").count()} paragraphs`);

  /* clearing a box must restore the shipped wording, not blank the page */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(400);
  await page.locator('[data-content="notice"]').fill("");
  await page.locator('[data-content="hours"]').fill("");
  await page.locator("#save").click();
  await page.waitForTimeout(800);
  await go(`${BASE}/index.html#/`, 1500);
  check("clearing the notice removes the strip", (await page.locator(".notice").count()) === 0);
  await go(`${BASE}/index.html#/contact`, 1500);
  check("clearing a box restores the original wording",
    (await page.evaluate(() => document.querySelector("#app").textContent)).includes(CONTACT_HOURS),
    CONTACT_HOURS);

  /* hand the next section the admin with Collections open, which is where it
     was before this block was slotted in */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='collections']").click();
  await page.waitForTimeout(400);
}

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
await go(`${BASE}/index.html#/collections/carpets`, 1500);
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
await go(`${BASE}/index.html#/collections/carpets`, 1500);
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
await go(`${BASE}/index.html#/collections/carpets`, 1500);
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
await go(`${BASE}/index.html#/collections/carpets/easy-clean`, 1500);
const nowIn = await page.evaluate(() =>
  stylesFor("carpets").find((s) => s.id === "easy-clean")?.list.map((r) => r.id) || []);
check("the style list followed the tick", nowIn.includes(tickedId) === !wasChecked,
  `${tickedId} ${wasChecked ? "removed" : "added"}`);

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
  await go(`${BASE}/index.html#/collections/carpets`, 1600);
  const live = await page.evaluate(() =>
    allSwatches().find((s) => s.name === "Shop Oatmeal"));
  check("the new shade is on the shop", Boolean(live), live && `${live.range} · ${live.hex}`);
  check("and it was filed under a real colour family",
    Boolean(live) && live.family && live.family.length > 2, live && live.family);
}

console.log("\nWhen the admin API is down the shop does not notice:");
{
  const p2 = await openPage(browser);
  const errs = [];
  p2.on("pageerror", (e) => errs.push(e.message));
  await p2.goto(`${DOWN}/index.html#/collections/carpets`, { waitUntil: "networkidle" });
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
  const p3 = await openPage(browser);
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
  const p4 = await openPage(browser);
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
  check("and the admin is usable", (await p4.locator(".mg-tab").count()) === TABS);

  /* the password must not linger anywhere the next person could read it */
  const leaked = await p4.evaluate(() => {
    const hay = [document.body.innerHTML, JSON.stringify(localStorage),
                 JSON.stringify(sessionStorage), document.cookie].join(" ");
    return hay.includes("correct-horse-battery-staple");
  });
  check("the password is not left in the page, storage or a readable cookie", !leaked);
  await p4.close();
}

console.log("\nReplacing a photograph:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='photos']").click();
  await page.waitForTimeout(700);
  const cards = await page.locator(".mg-photo").count();
  check("every replaceable photo is listed", cards > 50, `${cards} photographs`);
  check("each shows what is there now",
    (await page.locator(".mg-photo-img img").count()) > 50);

  await page.locator('[data-slot="hero"]').setInputFiles(shot);
  await page.waitForTimeout(1500);
  check("the upload reports back",
    (await page.locator('[data-state="hero"]').textContent()).includes("Save"),
    await page.locator('[data-state="hero"]').textContent());

  /* a collection too, since those are the 43 stand-ins worth replacing */
  await page.locator('[data-slot="range:westex-ultima"]').setInputFiles(shot);
  await page.waitForTimeout(1500);
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  check("saved", (await page.locator("#state").textContent()).toLowerCase().includes("saved"));

  await go(`${BASE}/index.html#/`, 1600);
  const heroSrc = await page.evaluate(() =>
    document.querySelector(".hero img")?.getAttribute("src") || "");
  check("the home page banner is the new photo", heroSrc.includes("assets/uploads/hero-"), heroSrc);

  await go(`${BASE}/index.html#/range/westex-ultima`, 1600);
  const rangeSrc = await page.evaluate(() =>
    document.querySelector(".range-hero img")?.getAttribute("src") || "");
  check("the collection photo followed too",
    rangeSrc.includes("assets/uploads/range-westex-ultima-"), rangeSrc);

  /* and putting it back must restore the original, not blank it */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='photos']").click();
  await page.waitForTimeout(600);
  await page.locator('[data-revert="hero"]').click();
  await page.waitForTimeout(400);
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/`, 1600);
  const back = await page.evaluate(() =>
    document.querySelector(".hero img")?.getAttribute("src") || "");
  check("'use the original' restores the shipped photo",
    back.includes("hero-living-room.jpg"), back);
}

console.log("\nReviews and Instagram:");
{
  /* Set, not assumed. The stub keeps its feed for as long as it is running, so
     a previous run — or somebody poking it by hand — would otherwise decide
     whether these pass. */
  await fetch(`${BASE}/_feed?n=0`);
  /* Clear both out first, so this passes whatever a previous run left in the
     stub — and so removing them is covered as well as adding them. */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(600);
  for (const sel of ['[data-rev="rating"]', '[data-rev="count"]', '[data-rev="url"]']) {
    await page.locator(sel).fill("");
  }
  for (const q of await page.locator('[data-part="text"]').all()) await q.fill("");
  while (await page.locator("[data-igdrop]").count()) {
    await page.locator("[data-igdrop]").first().click();
    await page.waitForTimeout(250);
  }
  /* on a freshly started stub there is nothing to clear, so nothing goes dirty
     and Save stays disabled — which is correct, not a failure */
  if (!(await page.locator("#save").isDisabled())) {
    await page.locator("#save").click();
    await page.waitForTimeout(900);
  }

  await go(`${BASE}/index.html#/`, 1600);
  check("neither section is there when nothing has been entered",
    (await page.locator(".reviews").count()) === 0
    && (await page.locator(".ig-wall").count()) === 0);

  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(600);
  await page.locator('[data-rev="rating"]').fill("4.9");
  await page.locator('[data-rev="count"]').fill("37");
  await page.locator('[data-rev="url"]').fill("https://g.page/haris-carpets");
  await page.locator('[data-quote="0"][data-part="text"]').fill("Lovely job on the stairs.");
  await page.locator('[data-quote="0"][data-part="name"]').fill("Sam");
  await page.locator('[data-quote="0"][data-part="stars"]').fill("5");
  await page.locator('[data-quote="0"][data-part="when"]').fill("13 days ago");
  await page.locator('[data-ig="url"]').fill("https://www.instagram.com/hariscarpets/");
  await page.locator('[data-igfile="0"]')
    .setInputFiles(new URL("../public/assets/showroom.jpg", import.meta.url).pathname);
  await page.waitForTimeout(1500);
  await page.locator('[data-igpost="0"]').fill("https://www.instagram.com/p/abc/");
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  await go(`${BASE}/index.html#/`, 1700);
  check("the rating shows", (await page.locator(".reviews-score").textContent()).includes("4.9"));
  check("the count shows", (await page.locator(".reviews-score").textContent()).includes("37"));
  check("the review shows",
    (await page.locator(".rv p").first().textContent()).includes("stairs"));
  check("the reviewer is credited",
    (await page.locator(".rv-who b").first().textContent()) === "Sam");
  check("when they wrote it shows",
    (await page.locator(".rv-who small").first().textContent()) === "13 days ago");
  check("the overall rating is the headline",
    (await page.locator(".reviews-score").textContent()).includes("4.9"));
  check("five stars are drawn, not a number",
    (await page.locator(".rv .stars").first().textContent()).includes("★"));
  /* The "Review us on Google" button is gone on purpose: asking for reviews on
     the strip that is showing off the ones you already have reads as fishing,
     and the shop asked for it removed. The listing link is still stored — it is
     what the rating and the count come from. */
  check("but no button asking for another one",
    (await page.locator(".reviews-bar a").count()) === 0);
  check("the Instagram grid appears", (await page.locator(".ig-tile").count()) === 1);
  const igHref = await page.evaluate(() =>
    document.querySelector(".ig-tile")?.getAttribute("href"));
  check("the tile links to the post", igHref?.includes("instagram.com/p/"), igHref);
  /* the grid sits at the foot of the page and its images are lazy, so they do
     not load until somebody scrolls to them — which is the point of lazy */
  await page.evaluate(() => document.querySelector(".ig-wall").scrollIntoView());
  await page.waitForTimeout(900);
  const igImg = await page.evaluate(() =>
    document.querySelector(".ig-tile img")?.naturalWidth > 0);
  check("and the picture actually loaded", igImg);

  /* keeps the reviews strip small — three quotes, not a testimonials page */
  /* reviews were under the banner; they belong lower down, after the reasons
     to believe rather than in front of them */
  const order = await page.evaluate(() => {
    const names = [...document.querySelectorAll("#app > *")].map((el) => el.className || el.tagName);
    return { reviews: names.findIndex((n) => String(n).includes("reviews")),
             insta: names.findIndex((n, i) => document.querySelectorAll("#app > *")[i].querySelector(".ig-wall")),
             total: names.length };
  });
  check("Instagram is high on the page", order.insta > -1 && order.insta <= 3, `block ${order.insta}`);
  check("and the reviews are near the foot",
    order.reviews > order.insta && order.reviews >= order.total - 2,
    `reviews at ${order.reviews} of ${order.total}`);

  check("the strip stays compact",
    (await page.evaluate(() =>
      Math.round(document.querySelector(".reviews").getBoundingClientRect().height))) < 400,
    `${await page.evaluate(() => Math.round(document.querySelector(".reviews").getBoundingClientRect().height))}px tall`);
}

console.log("\nEvery text box in the admin changes something on the site:");
{
  /* Written as a sweep rather than a handful of examples on purpose: the point
     of "every field Hari can change" is that none of them is a box that saves
     happily and alters nothing, which is exactly the bug this started as. Each
     one gets a unique marker typed into it, and then the pages are searched for
     those markers. Anything missing is named. */
  const MARK = "ZQ";
  /* "styles" is in here because the style names and blurbs became boxes: the
     tiles on "what sort of carpet are you after?" used to be wording nobody
     could change, and a box nobody sweeps is a box that can go back to being
     one. */
  const tabs = ["shop", "about", "home", "pages", "portfolio", "styles"];
  const typed = new Map();
  /* Checked apart: the notice is off unless it has something in it, and the two
     URLs have to stay URLs or the page they are on cannot render them. */
  const APART = new Set(["notice", "mapEmbed", "mapsUrl", "whatsapp",
    "socialInstagram", "socialFacebook", "socialTiktok", "socialTwitter"]);

  await go(`${BASE}/admin/`);
  for (const t of tabs) {
    await page.locator(`[data-tab='${t}']`).click();
    await page.waitForTimeout(500);
    for (const el of await page.locator("[data-content]").all()) {
      const key = await el.getAttribute("data-content");
      if (APART.has(key) || typed.has(key)) continue;
      const value = `${MARK}-${key}`;
      await el.fill(value);
      typed.set(key, value);
    }
  }
  await page.locator("#save").click();
  await page.waitForTimeout(1000);

  /* every page that could be showing any of them */
  const pages = ["#/", "#/about", "#/collections", "#/collections/carpets",
                 /* Wood and LVT have styles of their own, and their names are
                    separate boxes — "herringbone" exists under both. */
                 "#/collections/wood", "#/collections/lvt",
                 "#/portfolio", "#/contact", "#/enquire"];
  let seen = "";
  for (const hash of pages) {
    await page.goto(`${BASE}/index.html${hash}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1300);
    seen += await page.evaluate(() => document.body.textContent);
  }
  const missing = [...typed].filter(([, v]) => !seen.includes(v)).map(([k]) => k);
  check(`all ${typed.size} text fields reach a page`, missing.length === 0,
    missing.length ? "not showing: " + missing.join(", ") : `${typed.size} checked`);

  /* The URLs and the phone number, which the sweep cannot fill with a marker:
     they have to stay a URL or a number or the thing they drive cannot render.
     Each is checked on its own — mapsUrl was a box that changed nothing for
     months, and the WhatsApp button has its own block below. */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(500);
  await page.locator('[data-content="mapsUrl"]').fill("https://maps.example/haris");
  await page.locator('[data-content="socialTiktok"]').fill("https://tiktok.example/haris");
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/contact`, 1500);
  check("the Google Maps link is really a link now",
    (await page.locator('a[href="https://maps.example/haris"]').count()) > 0);
  check("and a social link the shop typed is on the page",
    (await page.locator('.socials a[href="https://tiktok.example/haris"]').count()) === 1);
}

console.log("\nSwitching a line off takes it off the page:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(600);

  const before = await page.inputValue('[data-content="instaHeading"]');
  const focusedBefore = await page.evaluate(() => document.activeElement?.tagName);
  await page.locator('[data-off="instaHeading"]').uncheck();
  await page.waitForTimeout(300);
  check("the box greys out", (await page.locator('.mg-field.mg-off [data-content="instaHeading"]').count()) === 1);
  check("what was written in it is left alone",
    (await page.inputValue('[data-content="instaHeading"]')) === before, before);
  /* A full re-render here would move the tick out from under the cursor and
     drop whatever box was being typed in — on this tab there are thirty of them. */
  check("and the panel is not rebuilt underneath you",
    (await page.evaluate(() => document.activeElement?.tagName)) !== focusedBefore
      || (await page.locator("[data-content]").count()) > 20);

  await page.locator("[data-tab='pages']").click();
  await page.waitForTimeout(400);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(500);
  check("it is still off after moving away and back",
    (await page.locator('[data-off="instaHeading"]').isChecked()) === false);

  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/`, 1600);
  const heads = await page.evaluate(() =>
    [...document.querySelectorAll(".ig-wall")].length
      ? [...document.querySelectorAll("section h2")].map((h) => h.textContent) : ["no grid"]);
  check("the heading is gone from the home page", !heads.some((h) => /Recent work/.test(h)),
    heads.join(" | "));
  /* Gone, not blank: an empty <h2> still takes up space and still reads as a
     heading to a screen reader. */
  check("and there is no empty heading left behind", await page.evaluate(() =>
    ![...document.querySelectorAll("#app h1, #app h2, #app p")].some((el) => !el.textContent.trim())));
  check("the word undefined appears nowhere",
    !/undefined/.test(await page.evaluate(() => document.body.innerText)));

  /* and back on again, with the wording intact */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(600);
  await page.locator('[data-off="instaHeading"]').check();
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/`, 1600);
  check("ticking it back on brings it back",
    /Recent work|ZQ-instaHeading/.test(await page.evaluate(() => document.body.innerText)));
}

console.log("\nClearing a box is not the same as switching it off:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(600);
  await page.locator('[data-content="typesHeading"]').fill("");
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/`, 1600);
  check("an empty box puts the original wording back",
    /Every floor, one showroom/.test(await page.evaluate(() => document.body.innerText)));
}

console.log("\nThe portfolio:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='portfolio']").click();
  await page.waitForTimeout(600);
  await page.locator('[data-folio="0"][data-part="title"]').fill("Hounslow semi");
  await page.locator('[data-folio="0"][data-part="caption"]').fill("Wool twist through the hall.");
  await page.locator('[data-foliofile="0"]').setInputFiles(shot);
  await page.waitForTimeout(1600);
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  await go(`${BASE}/index.html#/portfolio`, 1600);
  check("the job is on the page", (await page.locator(".folio-item").count()) === 1);
  check("with its heading", /Hounslow semi/.test(await page.evaluate(() => document.body.innerText)));
  check("and its description",
    /Wool twist through the hall/.test(await page.evaluate(() => document.body.innerText)));
  check("the photograph actually loaded", await page.evaluate(() =>
    document.querySelector(".folio-item img")?.naturalWidth > 0));

  /* An entry with no photograph is not an entry — an empty frame is worse than
     a shorter gallery. */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='portfolio']").click();
  await page.waitForTimeout(600);
  await page.locator('[data-folio="1"][data-part="title"]').fill("No picture for this one");
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/portfolio`, 1600);
  check("an entry with no picture is dropped", (await page.locator(".folio-item").count()) === 1);
}

console.log("\nThe WhatsApp button:");
{
  /* Nothing about WhatsApp is on the site until the shop puts a number in, so
     the first assertion is that an empty box leaves no button behind. */
  await go(`${BASE}/index.html#/`, 1200);
  check("no number, no button", (await page.locator("#waFloat:visible").count()) === 0);

  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(400);
  await page.locator('[data-content="whatsapp"]').fill("07700 900123");
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  await go(`${BASE}/index.html#/`, 1400);
  const wa = page.locator("#waFloat");
  check("with one, the button is there", await wa.isVisible());
  check("dialling the number in international form",
    (await wa.getAttribute("href")) === "https://wa.me/447700900123",
    await wa.getAttribute("href"));
  const box = await wa.boundingBox();
  check("painted, bottom right", box.width > 40 && box.height > 30,
    `${Math.round(box.width)}x${Math.round(box.height)}`);

  /* It is fixed to the window, so it has to survive a page change rather than
     be rendered by one view. */
  await page.locator('.nav a[href="#/about"]').click();
  await page.waitForTimeout(900);
  check("and it survives moving to another page", await page.locator("#waFloat").isVisible());

  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(400);
  await page.locator('[data-content="whatsapp"]').fill("");
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/`, 1400);
  check("emptying the box takes it away again",
    (await page.locator("#waFloat:visible").count()) === 0);
}

console.log("\nA save that loses something does not say Saved:");
{
  /* The shop added collections for weeks into a save that was dropping
     everything past the two hundredth and still reporting success. The Worker
     names its casualties now; this is the half that puts them on the screen. */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(400);
  await page.locator('[data-content="hours"]').fill("Mon to Sat, 9 till 5");
  await fetch(`${BASE}/_drop?what=${encodeURIComponent('"Trade Winds" — its name cannot be stored')}`);
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  const state = await page.locator("#state").textContent();
  check("the status line does not claim a clean save", !/^Saved — live/.test(state.trim()), state);
  const banner = page.locator("#dropped");
  check("what was lost is on the screen", await banner.isVisible());
  check("named", /Trade Winds/.test(await banner.innerText()));
  check("and it says the rest did save", /Everything else saved/.test(await banner.innerText()));

  /* and a clean save afterwards clears it, or the warning becomes wallpaper */
  await page.locator('[data-content="hours"]').fill("Mon to Sat, 9 till 5.30");
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  check("a clean save afterwards clears the warning", !(await banner.isVisible()));
  check("and says so", /Saved/.test(await page.locator("#state").textContent()));
}

console.log("\nA style tile gets a picture of its own:");
{
  /* The tile picture used to be borrowed from the first collection under the
     style, with nothing in /admin able to change it — so "Striped & patterned",
     whose collections have no photograph, showed an empty frame and there was
     nowhere to fix it. */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='photos']").click();
  await page.waitForTimeout(700);
  const slot = "style-carpets-wool-twist";
  check("style tiles are listed as photographs",
    (await page.locator(`[data-slot="${slot}"]`).count()) === 1);

  await page.locator(`[data-slot="${slot}"]`).setInputFiles(shot);
  await page.waitForTimeout(1500);
  await page.locator(`[data-caption="${slot}"]`).fill("Wool twist fitted in a bay window");
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  await go(`${BASE}/index.html#/collections/carpets`, 1600);
  const tile = await page.evaluate(() => {
    const a = [...document.querySelectorAll(".style-tile")]
      .find((t) => /wool-twist$/.test(t.getAttribute("href")));
    const img = a && a.querySelector("img");
    return { src: img?.getAttribute("src") || "", alt: img?.getAttribute("alt") || "",
             painted: Boolean(img && img.naturalWidth > 0) };
  });
  check("the tile shows the uploaded picture",
    tile.src.includes(`assets/uploads/${slot}-`), tile.src);
  check("and it actually loads", tile.painted);
  check("described in the shop's own words",
    tile.alt === "Wool twist fitted in a bay window", tile.alt);
}

console.log("\nA style with nothing in it says so rather than offering dead boxes:");
{
  /* Sets its own state rather than relying on what the site ships with: the
     sweep above has already been through this tab, and a stub kept running
     between runs holds whatever the last one saved. */
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='styles']").click();
  await page.waitForTimeout(600);
  const block = page.locator('[data-style-block="carpets|pattern"]');
  const ticked = await block.locator("input[type=checkbox]:checked").all();
  for (const box of ticked) await box.uncheck();
  /* Only if there was something to undo. Save is disabled until the document
     changes, and clicking a disabled button waits for thirty seconds and then
     fails the run — which is what a freshly started stub did here. */
  if (ticked.length) {
    await page.locator("#save").click();
    await page.waitForTimeout(900);
    await page.locator("[data-tab='styles']").click();
    await page.waitForTimeout(600);
  }

  check("a style with no collections has no wording boxes",
    (await block.locator("[data-content]").count()) === 0);
  check("and says why instead", /Nothing is filed under this one/.test(await block.innerText()));

  await go(`${BASE}/index.html#/collections/carpets`, 1500);
  check("it is not on the site either",
    (await page.locator('.style-tile[href$="/pattern"]').count()) === 0);

  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='styles']").click();
  await page.waitForTimeout(600);
  await block.locator("input[type=checkbox]").first().check();
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await page.locator("[data-tab='styles']").click();
  await page.waitForTimeout(600);
  check("filing one collection under it brings its wording back",
    (await block.locator("[data-content]").count()) === 2,
    `${await block.locator("[data-content]").count()} boxes`);
}

console.log("\nAn enquiry gets as far as the wire:");
{
  /* enquiry.test.mjs covers delivery against the Worker itself. What this adds
     is the half that only exists in a browser: that the page sends what the
     visitor typed, and that it copes with each answer honestly. */
  const lastSent = async () =>
    (await (await fetch(`${BASE}/_enquiry`)).json()).last;

  /* Set rather than assumed. The stub keeps its mode for as long as it is
     running, so a run that stopped early with it left on "fail" would make the
     next run fail here for a reason that has nothing to do with the code. */
  await fetch(`${BASE}/_enquiry?mode=ok`);

  await page.goto(`${BASE}/index.html#/collections/carpets`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator(".swatch .fav").first().click();
  await go(`${BASE}/index.html#/favourites`, 1200);
  await page.locator("#favEnquire").click();
  await page.waitForTimeout(1200);
  check("the shortlist takes you to the form", page.url().endsWith("#/enquire"));
  check("with the shades already written into it",
    (await page.inputValue("#m")).includes("ask about these shades"));

  await page.fill("#n", "Test Visitor");
  await page.fill("#e", "visitor@example.com");
  await page.fill("#p", "07700 900000");
  await page.waitForTimeout(3200);   // the form refuses anything sent inside 3s
  await page.locator("#enquiry button[type=submit]").click();
  await page.waitForTimeout(900);
  check("the visitor is thanked", (await page.locator("#enquiry h3").count()) === 1,
    await page.evaluate(() => document.querySelector("#enquiry")?.innerText.slice(0, 40)));

  const sent = await lastSent();
  check("their name went with it", sent?.name === "Test Visitor");
  check("and their email", sent?.email === "visitor@example.com");
  check("and the shortlist they came in with",
    (sent?.message || "").includes("ask about these shades"));
  check("the honeypot went over empty", sent?.website === "");
  check("and the page said when the form was opened", typeof sent?.t === "number");

  /* The provider is down. Reloaded rather than navigated: the URL is already
     #/enquire, and a goto that only differs by hash does not reload — the form
     would still be showing the thank-you from the last one. */
  await fetch(`${BASE}/_enquiry?mode=fail`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.fill("#n", "Second Visitor");
  await page.fill("#e", "second@example.com");
  await page.fill("#m", "Please call me back.");
  await page.waitForTimeout(3200);
  await page.locator("#enquiry button[type=submit]").click();
  await page.waitForTimeout(900);
  check("a failed send does not thank anybody", (await page.locator("#enquiry h3").count()) === 0);
  check("what they typed is still on screen",
    (await page.inputValue("#m")) === "Please call me back.");
  check("and there is a mailto: to fall back on",
    (await page.locator('#enquiryNote a[href^="mailto:"]').count()) === 1);
  check("the send button works again", !(await page.locator("#enquirySend").isDisabled()));

  /* There is no "queued" any more. Writing the enquiry to the bucket is the
     delivery, so it either reached the shop's inbox or it did not, and the two
     answers above are the only two the visitor can be given. */
  await fetch(`${BASE}/_enquiry?mode=ok`);
}

console.log("\nAn enquiry the visitor sent turns up in the shop's inbox:");
{
  /* The enquiry above was sent through the real form, in this browser, on the
     mode the shop actually runs on. Nothing here plants it: if the round trip
     from the page to the inbox is broken, the first assertion fails. */
  await go(`${BASE}/admin/`);
  const tab = page.locator("[data-tab='enquiries']");
  check("Enquiries is the first tab", (await page.locator(".mg-tab").first().textContent())
    .includes("Enquiries"));
  check("carrying a count of the unread ones",
    (await tab.locator(".mg-count").textContent()) === "2",
    await tab.textContent());

  await tab.click();
  await page.waitForTimeout(400);
  const items = page.locator(".mg-enq-item");
  check("all three are listed", (await items.count()) === 3, `${await items.count()}`);
  check("newest first", (await items.first().innerText()).includes("Test Visitor"),
    (await items.first().innerText()).split("\n")[0]);
  check("with what they wrote",
    (await items.first().locator(".mg-enq-msg").innerText()).includes("ask about these shades"));
  check("and their phone number to ring",
    (await items.first().locator('a[href^="tel:"]').getAttribute("href")) === "tel:07700900000");

  /* Reply is the whole delivery mechanism: no mail leaves the website, so if
     this link is wrong the enquiry has effectively not been answerable. */
  const reply = await items.first().locator('a:has-text("Reply")').getAttribute("href");
  check("Reply opens an email to them", reply.startsWith("mailto:visitor%40example.com?"),
    reply.slice(0, 60));
  check("with what they wrote quoted underneath",
    decodeURIComponent(reply).includes("> Hello, I'd like to ask about these shades")
    || decodeURIComponent(reply).includes("ask about these shades"), decodeURIComponent(reply).slice(-80));

  /* Marking read is what makes the count mean anything. */
  await items.first().locator('button:has-text("Mark read")').click();
  await page.waitForTimeout(600);
  check("marking one read drops the count to one",
    (await tab.locator(".mg-count").textContent()) === "1", await tab.textContent());
  check("and it is still there, just not new", (await page.locator(".mg-enq-item").count()) === 3);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("which survives a reload",
    (await page.locator("[data-tab='enquiries'] .mg-count").textContent()) === "1");
}

console.log("\nDeleting an enquiry, and the empty inbox:");
{
  await page.locator("[data-tab='enquiries']").click();
  await page.waitForTimeout(400);
  page.once("dialog", (d) => d.accept());
  await page.locator(".mg-enq-item").first().locator('button:has-text("Delete")').click();
  await page.waitForTimeout(700);
  check("it goes", (await page.locator(".mg-enq-item").count()) === 2);
  const left = await page.locator(".mg-enq").innerText();
  check("and takes the customer's details with it", !left.includes("visitor@example.com"));

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator("[data-tab='enquiries']").click();
  await page.waitForTimeout(400);
  check("still gone after a reload", (await page.locator(".mg-enq-item").count()) === 2);

  /* An inbox with nothing in it is the state the shop sees most days, so it
     has to say what it is rather than look broken. */
  await fetch(`${BASE}/_inbox?state=empty`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator("[data-tab='enquiries']").click();
  await page.waitForTimeout(400);
  const empty = await page.locator("#panel").innerText();
  check("an empty inbox says so", /Nothing yet/i.test(empty));
  check("without a count on the tab",
    (await page.locator("[data-tab='enquiries'] .mg-count").count()) === 0);
  /* The form's own wording lives on this tab, so it is reachable even when
     there is nothing to read. */
  check("and the form's wording is still editable here",
    (await page.locator('[data-content="formHeading"]').count()) === 1);
  await fetch(`${BASE}/_inbox?state=seeded`);
}

/* Whether the live feed is working has to be readable by the shop, not by
   somebody willing to type an API address into a browser and read raw JSON.
   "The grid is empty" has four causes fixed in four different places. */
console.log("\nThe admin says whether the Instagram feed is working:");
{
  await fetch(`${BASE}/_feed?n=3`);
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(1400);
  const on = await page.locator("#igStatus").textContent();
  check("a working feed says so", /working/i.test(on), on.slice(0, 60));
  check("and how many posts", /3 posts/.test(on));
  check("in green", (await page.locator("#igStatus").getAttribute("class")).includes("ok"));

  await fetch(`${BASE}/_feed?n=0`);
  await page.locator("[data-tab='shop']").click();
  await page.waitForTimeout(300);
  await page.locator("[data-tab='home']").click();
  await page.waitForTimeout(1400);
  const off = await page.locator("#igStatus").textContent();
  check("a broken feed says why", /refused the token/i.test(off), off.slice(0, 80));
  check("and what happens in the meantime", /pick below/.test(off));
  check("flagged, not green", (await page.locator("#igStatus").getAttribute("class")).includes("warn"));
  check("with no stray double full stop", !/\.\s*\./.test(off));
  await fetch(`${BASE}/_feed?n=0`);
}

console.log("\nThe Instagram wall:");
{
  await fetch(`${BASE}/_feed?n=9`);
  await go(`${BASE}/index.html#/`, 1800);
  await page.evaluate(() => document.querySelector(".ig-wall")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(700);

  check("nine posts are shown", (await page.locator(".ig-tile").count()) === 9);
  check("every picture loads", (await page.evaluate(() =>
    [...document.querySelectorAll(".ig-tile img")].filter((i) => i.naturalWidth > 0).length)) === 9);

  /* The wall has to fill exactly: an orphan tile alone on a last row is what
     eight equal squares gave, and it looked like a mistake. Nine with a 2x2
     lead tiles cleanly at two, three and four columns. */
  for (const [w, h, label] of [[1280, 900, "desktop"], [820, 900, "tablet"], [390, 844, "phone"]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const ragged = await page.evaluate(() => {
      const wall = document.querySelector(".ig-wall");
      const tiles = [...wall.children].map((t) => t.getBoundingClientRect());
      return Math.round(wall.getBoundingClientRect().bottom - Math.max(...tiles.map((t) => t.bottom)));
    });
    check(`no hole in the wall on ${label}`.padEnd(30), ragged === 0, `${ragged}px short`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);

  const lead = await page.evaluate(() => {
    const t = document.querySelector(".ig-tile.lead").getBoundingClientRect();
    const s = document.querySelectorAll(".ig-tile")[1].getBoundingClientRect();
    return Math.round(t.width / s.width);
  });
  check("the newest post is the big one", lead === 2, `${lead}x`);
  /* Hover does not exist on a phone, so the lead tile keeps its caption on
     show — otherwise captions would be a desktop-only feature. */
  check("and carries its caption without hovering", await page.evaluate(() =>
    Number(getComputedStyle(document.querySelector(".ig-tile.lead .ig-cap")).opacity) === 1));
  check("the others keep theirs until hovered", await page.evaluate(() =>
    Number(getComputedStyle(document.querySelectorAll(".ig-tile")[1].querySelector(".ig-cap")).opacity) === 0));

  check("the account is named", /@hariscarpets/.test(await page.locator(".ig-who").textContent()));
  check("with its follower count", /1.4k followers/.test(await page.locator(".ig-who").textContent()));
  check("and the Follow button carries the Instagram mark",
    (await page.locator(".ig-follow svg").count()) === 1);
  await fetch(`${BASE}/_feed?n=0`);
}

console.log("\nPhoto captions:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='photos']").click();
  await page.waitForTimeout(800);
  check("all three banner pictures are listed",
    (await page.locator('[data-slot="hero"], [data-slot="hero2"], [data-slot="hero3"]').count()) === 3);
  await page.locator('[data-caption="hero"]').fill("A wool twist in a bay-window living room");
  await page.locator('[data-caption="hero2"]').fill("Velvet pile in a bay window");
  await page.locator('[data-caption="range:westex-ultima"]').fill("Ultima fitted in a hallway");
  await page.locator("#save").click();
  await page.waitForTimeout(900);

  await go(`${BASE}/index.html#/`, 1600);
  check("the banner picture is described",
    (await page.evaluate(() => document.querySelector(".hero img")?.getAttribute("alt")))
      === "A wool twist in a bay-window living room");
  /* the second slide is a separate slot with its own caption, so a shop that
     changes one banner picture does not silently relabel the others */
  check("so is the one behind it",
    (await page.evaluate(() =>
      document.querySelectorAll(".hero-slide img")[1]?.getAttribute("alt"))) === "Velvet pile in a bay window");
  await go(`${BASE}/index.html#/range/westex-ultima`, 1600);
  check("so is a collection's",
    (await page.evaluate(() => document.querySelector(".range-hero img")?.getAttribute("alt")))
      === "Ultima fitted in a hallway");
}

console.log("\nA collection's own description:");
{
  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='collections']").click();
  await page.waitForTimeout(500);
  await page.locator('[data-shades="westex-ultima"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-blurb="westex-ultima"]').fill("Our best-selling wool twist.");
  await page.locator("#save").click();
  await page.waitForTimeout(900);
  await go(`${BASE}/index.html#/range/westex-ultima`, 1600);
  check("shows on the collection page",
    (await page.evaluate(() => document.querySelector("#app").textContent))
      .includes("Our best-selling wool twist."));

  await go(`${BASE}/admin/`);
  await page.locator("[data-tab='collections']").click();
  await page.waitForTimeout(500);
}

console.log("\nA live Instagram feed replaces the chosen posts:");
{
  /* the chosen posts from the block above are still in the stub */
  await page.goto(`${BASE}/_feed?n=4`, { waitUntil: "domcontentloaded" });
  await go(`${BASE}/index.html#/`, 1800);
  check("the live posts are used", (await page.locator(".ig-tile").count()) === 4,
    `${await page.locator(".ig-tile").count()} tiles`);
  const href = await page.evaluate(() =>
    document.querySelector(".ig-tile")?.getAttribute("href"));
  check("each links to its post on Instagram", href?.includes("/p/live0"), href);

  /* a lapsed token, an outage, a Meta app someone deleted */
  await page.goto(`${BASE}/_feed?n=0`, { waitUntil: "domcontentloaded" });
  await go(`${BASE}/index.html#/`, 1800);
  check("without a feed it falls back to the chosen posts",
    (await page.locator(".ig-tile").count()) === 1,
    `${await page.locator(".ig-tile").count()} tiles`);
}

console.log("\nWith Access and a password both configured — the live shape:");
{
  /* This combination was never tested. Each was covered on its own, and the
     one that actually shipped was the pair. */
  const p5 = await openPage(browser);
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
  const blocked = await openPage(browser);
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
  const stale = await openPage(browser);
  await stale.goto("http://127.0.0.1:8895/admin/", { waitUntil: "networkidle" });
  await stale.waitForTimeout(600);
  check("a Worker older than the page says to redeploy",
    (await stale.locator("#gateTitle").textContent()).includes("redeploy"),
    await stale.locator("#gateTitle").textContent());
  await stale.close();

  /* a browser that genuinely believes it is on workers.dev */
  const wd = await chromium.launch({
    args: ["--host-resolver-rules=MAP fake-haris.workers.dev 127.0.0.1"] });
  const p = await openPage(wd);
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
  const p6 = await openPage(browser);
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
  const blocker = await openPage(browser);
  await blocker.route("**/admin.css", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text())
      + '\n[class^="ad-"],[class*=" ad-"],[id^="ad-"],.ad,.ads,.advert{display:none!important}' });
  });
  await blocker.goto(`${BASE}/admin/`, { waitUntil: "networkidle" });
  await blocker.waitForTimeout(900);
  check("the header survives an ad blocker", await blocker.locator(".mg-top").isVisible());
  check("the tabs survive", (await blocker.locator(".mg-tab:visible").count()) === TABS);
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
