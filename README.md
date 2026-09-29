# Hari's Carpets

The website for Hari's Carpets, a family-run flooring shop at 267 Hanworth Road,
Hounslow. A flooring catalogue of 48 collections and 721 shades, an admin the
shop runs itself, a room visualiser, and a contact form whose enquiries land in
that admin.

Vanilla JavaScript, no build step, no dependencies. Cloudflare Workers Static
Assets with a small Worker in front, and one R2 bucket.

---

## Documentation

| Read this | If you are |
|---|---|
| [`docs/work-instructions.md`](docs/work-instructions.md) | running the shop's website day to day |
| [`docs/admin.md`](docs/admin.md) | after the detail behind those instructions |
| [`docs/architecture.md`](docs/architecture.md) | picking up the code |
| [`docs/go-live.md`](docs/go-live.md) | moving the domain off Wix onto this site |
| [`docs/seo.md`](docs/seo.md) | the page addresses, the old Wix ones, and what Google does with them |
| [`docs/handover.md`](docs/handover.md) | taking over the Cloudflare account |
| [`docs/photography.md`](docs/photography.md) | regenerating the catalogue from a supplier's photography |
| [`docs/outstanding.md`](docs/outstanding.md) | wondering what is parked and why |

---

## Layout

```
public/            the website. Everything served to a visitor
  index.html         the shell; routing is on real paths, served by worker-pages.js
  app.js             routing, rendering, the overlay merge, favourites, the form
  data.js            the generated catalogue and every shipped default
  admin/             the admin, same style, no framework
  privacy.html       real files at real paths — Meta fetches these without JS
  robots.txt         and sitemap.xml, for crawlers
worker.js          the Worker: photos from R2, four API routes, then static assets
worker-admin.js      the admin API and the overlay document
worker-enquiry.js    the contact form and the enquiry inbox
worker-instagram.js  the live feed and its 60-day token
worker-analytics.js  visitor numbers for the admin's Visitors tab
worker-pages.js      real page addresses, and 301s from the old Wix ones
tools/             the catalogue pipeline (Python) and the test suites (Node)
docs/              the documents above
wrangler.jsonc     bindings, crons, rate limits. Read the comments before editing
```

## Running it

Nothing to install for the site itself.

```sh
node tools/stub-api.mjs 8890          # the site + a stand-in for Cloudflare
```

Then <http://127.0.0.1:8890/> for the shop and
<http://127.0.0.1:8890/admin/> for the admin. Nothing is saved when you stop it.

## Tests

```sh
node tools/admin.test.mjs      # the admin API, with real signed tokens
node tools/enquiry.test.mjs    # the enquiry form
node tools/instagram.test.mjs  # the feed, and the token expiring
node tools/worker.test.mjs     # routing and the R2 photo route
node tools/analytics.test.mjs  # visitor numbers, and every way they can fail
```

Those five need no server and no network. One more needs the site running,
and is the one to run after anything that touches addresses:

```sh
node tools/stub-api.mjs 8890 &
node tools/seo-report.mjs http://127.0.0.1:8890        # what should happen
node tools/seo-report.mjs https://haris-carpets.co.uk  # what does, after a deploy
```

It prints every old Wix path with its redirect status and destination, and
every page with its status, title and canonical — see
[`docs/seo.md`](docs/seo.md). The two browser suites
(`tools/admin-e2e.mjs`, `tools/smoke-test.mjs`) need Playwright and a couple of
local servers — see the Tests section of [`docs/admin.md`](docs/admin.md).

## Deploying

Push to `main`. Cloudflare Workers Builds rebuilds and deploys; there is no
other route and no manual step.

**A Worker cannot see a secret added since its last deploy** — add the secret,
then redeploy.
