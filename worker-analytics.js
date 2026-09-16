/**
 * Hari's Carpets — how many people visited, read in the admin.
 *
 * WHY THIS EXISTS AT ALL
 * Cloudflare Web Analytics already has a dashboard, and it is a good one. But
 * reading it means a Cloudflare login, and the shop has one place it goes to
 * run this website. A second account, with a second password, for a number
 * somebody wants to glance at once a month, is a thing that gets forgotten and
 * then gets asked for again. So the numbers come to the admin instead.
 *
 * WHAT IT IS NOT
 * Country, from the IP address, the way every web server sees one. Not a town,
 * not a street, not a person, and nothing that follows one visitor between
 * visits. The beacon sets no cookie and stores nothing on the device — which is
 * why the site needs no consent banner, and why this is Cloudflare's analytics
 * rather than Google's. If anybody asks for more than this, the honest answer
 * is that it would need a banner, a different privacy policy and a different
 * product.
 *
 * WHERE THE NUMBERS COME FROM
 * Cloudflare's GraphQL Analytics API, over the RUM dataset the Web Analytics
 * beacon feeds. Three things have to be set, and the route says plainly which
 * one is missing rather than answering with an empty page:
 *
 *   CF_ACCOUNT_ID       var    the account the site is in
 *   CF_SITE_TAG         var    which site in Web Analytics — the same value as
 *                              the beacon token in public/data.js
 *   CF_ANALYTICS_TOKEN  secret an API token with Account Analytics: Read
 *
 * The API token is the only secret of the three: an account id is in the
 * dashboard URL and the site tag is in the page source of every page.
 */

const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

/* Long enough that opening the tab twice does not make two round trips, short
   enough that "how did the weekend go" on a Monday morning is honest. */
const CACHE_TTL = 10 * 60;

/* A fourth name for the same three lines. json(), reply() and answer() are
   each taken by another Worker module, and load-worker.mjs inlines every one
   of them into a single scope for the tests — two modules declaring the same
   const is a SyntaxError that shows up as the whole Worker failing to load. */
const report = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8",
               "cache-control": "no-store" },
  });

/* Only the ranges the admin offers. A number off the query string becomes part
   of a request to somebody else's API, so it is chosen from a list rather than
   sanitised. */
const DAYS = new Set([7, 30, 90]);

/* One query, five answers. Kept as one string because the shape of it is the
   thing most likely to need correcting against Cloudflare's schema, and one
   place to correct is better than five.

   `sum { visits }` is people arriving; `count` is page views. They are
   different numbers and the admin shows both, because "we had 80 visits and
   240 page views" says something that either number alone does not. */
const QUERY = `
query Visitors($account: String!, $site: String!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      totals: rumPageloadEventsAdaptiveGroups(
        limit: 1
        filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }
      ) { count sum { visits } }
      daily: rumPageloadEventsAdaptiveGroups(
        limit: 100
        orderBy: [date_ASC]
        filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }
      ) { count sum { visits } dimensions { date } }
      pages: rumPageloadEventsAdaptiveGroups(
        limit: 15
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }
      ) { count dimensions { requestPath } }
      countries: rumPageloadEventsAdaptiveGroups(
        limit: 15
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }
      ) { count dimensions { countryName } }
      referers: rumPageloadEventsAdaptiveGroups(
        limit: 15
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }
      ) { count dimensions { refererHost } }
      devices: rumPageloadEventsAdaptiveGroups(
        limit: 8
        orderBy: [count_DESC]
        filter: { siteTag: $site, datetime_geq: $since, datetime_leq: $until }
      ) { count dimensions { deviceType } }
    }
  }
}`;

/* What is missing, in the words of whoever has to fix it. An empty tab with no
   explanation is the failure this project has already had once, with the
   Instagram feed. */
function missing(env) {
  const gaps = [];
  if (!env.CF_ACCOUNT_ID) gaps.push("CF_ACCOUNT_ID");
  if (!env.CF_SITE_TAG) gaps.push("CF_SITE_TAG");
  if (!env.CF_ANALYTICS_TOKEN) gaps.push("CF_ANALYTICS_TOKEN");
  return gaps;
}

const rows = (list, key) => (Array.isArray(list) ? list : [])
  .map((r) => ({ name: (r.dimensions && r.dimensions[key]) || "", views: r.count || 0 }))
  .filter((r) => r.name);

/**
 * Visitor numbers for the admin. Authenticated by the caller — this is behind
 * identify() in worker-admin.js, and belongs there: how the shop's website is
 * doing is the shop's business and nobody else's.
 */
export async function analyticsRoute(request, env, ctx) {
  const gaps = missing(env);
  if (gaps.length) {
    return report({
      configured: false,
      reason: `Visitor numbers are not switched on yet. Still to set: ${gaps.join(", ")}.`,
      needs: gaps,
    });
  }

  const url = new URL(request.url);
  const asked = Number(url.searchParams.get("days") || 30);
  const days = DAYS.has(asked) ? asked : 30;

  /* Cached by range, so flicking between 7 and 30 days is two requests rather
     than one every time somebody looks. */
  const key = new URL(`/api/admin/visitors?days=${days}`, url.origin).toString();
  const cached = await caches.default.match(key);
  if (cached) return cached;

  const until = new Date();
  const since = new Date(until.getTime() - days * 86400 * 1000);

  let body;
  try {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: {
        authorization: "Bearer " + env.CF_ANALYTICS_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          account: env.CF_ACCOUNT_ID,
          site: env.CF_SITE_TAG,
          since: since.toISOString(),
          until: until.toISOString(),
        },
      }),
    });
    body = await res.json();
    if (!res.ok && !body) {
      return report({ configured: true, reason: `Cloudflare answered ${res.status}.` });
    }
  } catch (err) {
    return report({ configured: true,
      reason: "Could not reach Cloudflare just now. Try again in a minute." });
  }

  /* Cloudflare answers 200 with an errors array when the query is wrong, so a
     status check alone would show an empty tab and call it success. Whatever
     it says is passed through: if a field name in QUERY ever goes stale, the
     admin shows the sentence that names it rather than nothing at all. */
  if (body && Array.isArray(body.errors) && body.errors.length) {
    return report({ configured: true,
      reason: "Cloudflare refused the request — " + body.errors[0].message });
  }

  const account = body?.data?.viewer?.accounts?.[0];
  if (!account) {
    return report({ configured: true,
      reason: "Cloudflare returned nothing for this account. Check CF_ACCOUNT_ID and that the API token has Account Analytics: Read." });
  }

  const totals = account.totals?.[0] || {};
  const out = {
    configured: true,
    days,
    views: totals.count || 0,
    visits: totals.sum?.visits || 0,
    daily: (account.daily || []).map((d) => ({
      date: d.dimensions?.date || "",
      views: d.count || 0,
      visits: d.sum?.visits || 0,
    })).filter((d) => d.date),
    pages: rows(account.pages, "requestPath"),
    countries: rows(account.countries, "countryName"),
    referers: rows(account.referers, "refererHost"),
    devices: rows(account.devices, "deviceType"),
  };

  const answer = new Response(JSON.stringify(out), {
    headers: { "content-type": "application/json; charset=utf-8",
               "cache-control": `max-age=${CACHE_TTL}` },
  });
  ctx.waitUntil(caches.default.put(key, answer.clone()));
  return answer;
}
