/**
 * Tests for the Visitors tab's API — worker-analytics.js.
 *
 *     node tools/analytics.test.mjs
 *
 * Cloudflare's GraphQL endpoint is stubbed. What is being protected here is
 * not the arithmetic: it is that this route can never answer with a confident
 * empty page. Every way it can fail — nothing configured, a refused query, an
 * unreachable API, an account that returns nothing — has to come back with a
 * sentence naming the cause, because "the tab is empty" has four causes fixed
 * in four different places, and that lesson cost this project a fortnight on
 * the Instagram feed.
 */
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker-analytics.js", import.meta.url), "utf8");
const an = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

const ctx = { waitUntil() {} };
let cacheStore = new Map();
globalThis.caches = { default: {
  async match(k) { return cacheStore.get(String(k)); },
  async put(k, v) { cacheStore.set(String(k), v); },
}};

const env = (extra = {}) => ({
  CF_ACCOUNT_ID: "acc123", CF_SITE_TAG: "site456", CF_ANALYTICS_TOKEN: "tok789", ...extra,
});
const req = (days) => new Request(
  "https://haris-carpets.co.uk/api/admin/visitors" + (days ? `?days=${days}` : ""));

/* One group as Cloudflare shapes them: a count, a sum, and the dimension. */
const group = (dim, n, visits) => ({ count: n, sum: { visits }, dimensions: dim });

function cloudflare(body, { status = 200, throws = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), init });
    if (throws) throw new Error("network down");
    return new Response(JSON.stringify(body), { status });
  };
  return calls;
}

const GOOD = { data: { viewer: { accounts: [{
  totals: [{ count: 310, sum: { visits: 96 } }],
  daily: [group({ date: "2026-09-01" }, 40, 12), group({ date: "2026-09-02" }, 55, 18)],
  pages: [group({ requestPath: "/" }, 120), group({ requestPath: "/index.html" }, 60)],
  countries: [group({ countryName: "United Kingdom" }, 280), group({ countryName: "Ireland" }, 12)],
  referers: [group({ refererHost: "google.com" }, 90), group({ refererHost: "" }, 40)],
  devices: [group({ deviceType: "mobile" }, 210), group({ deviceType: "desktop" }, 100)],
}] } } };

console.log("\nvisitor numbers\n");

console.log("Nothing set up yet — it says which part:");
{
  cacheStore = new Map();
  const res = await an.analyticsRoute(req(), {}, ctx);
  const body = await res.json();
  check("it answers rather than erroring", res.status === 200);
  check("says it is not switched on", body.configured === false);
  check("and names all three missing settings", body.needs.length === 3, body.needs.join(", "));
  check("in words a person can act on", /CF_ANALYTICS_TOKEN/.test(body.reason), body.reason);

  const partial = await (await an.analyticsRoute(req(), { CF_ACCOUNT_ID: "a" }, ctx)).json();
  check("with one of three set, it names the other two", partial.needs.length === 2,
    partial.needs.join(", "));
}

console.log("\nA working request:");
{
  cacheStore = new Map();
  const calls = cloudflare(GOOD);
  const body = await (await an.analyticsRoute(req(30), env(), ctx)).json();
  check("visits and page views are both reported",
    body.visits === 96 && body.views === 310, `${body.visits} / ${body.views}`);
  check("a day at a time for the chart", body.daily.length === 2);
  check("the busiest pages", body.pages[0].name === "/" && body.pages[0].views === 120);
  check("where people were", body.countries[0].name === "United Kingdom");
  check("what they came from", body.referers[0].name === "google.com");
  check("and on what", body.devices[0].name === "mobile");
  /* An empty dimension is "typed it in" rather than a referrer called "". */
  check("a blank dimension is dropped rather than shown as a blank row",
    body.referers.length === 1, JSON.stringify(body.referers));

  check("the token is sent as a bearer credential",
    calls[0].init.headers.authorization === "Bearer tok789");
  check("and never in the answer", !JSON.stringify(body).includes("tok789"));
  check("the site is named in the query", calls[0].body.variables.site === "site456");
}

console.log("\nThe range is chosen from a list, not taken on trust:");
{
  for (const [asked, want] of [[7, 7], [90, 90], [1000, 30], ["; drop", 30], [null, 30]]) {
    cacheStore = new Map();
    cloudflare(GOOD);
    const body = await (await an.analyticsRoute(req(asked), env(), ctx)).json();
    check(`?days=${asked} is served as ${want}`, body.days === want, String(body.days));
  }
}

console.log("\nEvery failure says what happened:");
{
  cacheStore = new Map();
  cloudflare({ errors: [{ message: "unknown field 'rumPageloadEventsAdaptiveGroups'" }] });
  const refused = await (await an.analyticsRoute(req(), env(), ctx)).json();
  /* Cloudflare answers 200 with an errors array, so a status check alone would
     show an empty tab and call it a success. */
  check("a refused query is reported, not shown as zero visitors",
    /unknown field/.test(refused.reason || ""), refused.reason);

  cacheStore = new Map();
  cloudflare(GOOD, { throws: true });
  const down = await (await an.analyticsRoute(req(), env(), ctx)).json();
  check("an unreachable API is reported", /Could not reach/.test(down.reason || ""), down.reason);

  cacheStore = new Map();
  cloudflare({ data: { viewer: { accounts: [] } } });
  const none = await (await an.analyticsRoute(req(), env(), ctx)).json();
  check("an account that returns nothing names the setting to check",
    /CF_ACCOUNT_ID/.test(none.reason || ""), none.reason);
}

console.log("\nLooking twice is one request:");
{
  cacheStore = new Map();
  const calls = cloudflare(GOOD);
  await an.analyticsRoute(req(7), env(), ctx);
  await an.analyticsRoute(req(7), env(), ctx);
  check("the second read is cached", calls.length === 1, `${calls.length} calls`);
  await an.analyticsRoute(req(30), env(), ctx);
  check("but a different range is its own request", calls.length === 2, `${calls.length} calls`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
