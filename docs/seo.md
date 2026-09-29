# Addresses: the old ones, the new ones, and what Google does with them

Two problems, fixed together in `worker-pages.js`, because they are the same
problem: **which URL is this page, and does anything else point at it.**

---

## 1. The Wix addresses

The site was a Wix site until September 2026. Google still holds its URLs —
`/about-us-1`, `/carpets`, `/lvt-1`, a shelf of `/copy-of-carina-*` product
pages — and they are still being clicked, from search results, from printed
material and from other people's links. None of those paths exist here, so
every one of them was a 404: the visitor lost, and the ranking that URL had
built up lost with them.

`REDIRECTS` in `worker-pages.js` maps each one to its nearest real page, as a
**301**, at the HTTP level, before the app loads. Permanently — a 301 is how
you tell Google to move the ranking across, and it only does that if the rule
stays there.

### Adding to it

This is the whole maintenance story. Google Search Console →
**Indexing → Pages**, and the **Not found (404)** group. Each URL in there is
one line in `REDIRECTS`:

```js
  "/old-wix-path": "/collections/lvt",
```

Three rules for what goes on the right:

- **The nearest page that is actually about that thing.** An old LVT product
  page goes to `/collections/lvt`, not to the home page.
- **Never everything-to-the-home-page.** Google calls that a soft 404 and
  treats it as one, and the visitor who clicked "Carina Herringbone" is no
  better served than by an error.
- **If there is no honest equivalent, let it 404.** A page that is gone should
  say so. `tools/seo-report.mjs` checks that unmatched paths still 404.

Redirect chains are checked in `tools/worker.test.mjs`: nothing in the table
may point at something that is itself redirected.

### What is still to do here

The old Wix sitemap had roughly **110 URLs** and it is no longer reachable —
the domain points here now. To get the full list, either:

1. **Search Console**, on the old property, Pages → export; or
2. the **Wayback Machine**: `web.archive.org/web/*/haris-carpets.co.uk/*`.

Send either list over and each URL becomes a line in the table. What is in
there now covers the confirmed 404s, the sitelinks Google is still showing
(About Us, Contact Us, Flooring, Brands, Easy Clean, Velvet) and the shapes
Wix sites take.

---

## 2. The site's own pages

They used to be hash routes: `/#/about`, `/#/collections/lvt`. Everything
after a `#` is a *fragment* — it never reaches the server, and to a search
engine it is not an address at all. `/#/about` and `/` were one document, so
the entire site was one indexable page, which is why it appeared in Google as
a single result with old Wix sitelinks hanging off it.

They are real paths now. `/about` is fetched, served and indexed as its own
document, with its own `<title>`, description, `<h1>` and self-referencing
canonical, **written into the HTML by the Worker before it leaves Cloudflare**
— so a crawler that runs no JavaScript still reads the right page.

| Address | What it is | In the sitemap |
|---|---|---|
| `/` | home | yes |
| `/collections` | every floor type | yes |
| `/collections/<type>` | carpets, wood, lvt, vinyl, rugs | yes |
| `/collections/<type>/<style>` | a filtered view — canonical points at its type page | no |
| `/range/<id>` | one range — `noindex, follow` for now, see below | no |
| `/portfolio` `/about` `/contact` `/enquire` | pages | yes |
| `/favourites` `/visualiser` | this browser's list, and a tool | no, `noindex` |
| `/admin` | behind Cloudflare Access | no, and in robots.txt |

### The three pieces that make it work

1. **`worker-pages.js`** — answers the path with the document, its head
   rewritten for that address. A direct load and a refresh therefore return
   200 with the right page, which is the part a client-side router cannot do.
2. **`public/app.js`** — routes on `location.pathname`, catches clicks on
   internal links and turns them into `pushState`, so navigation is still
   instant and nothing is fetched twice. Old `#/` links are rewritten to real
   paths on arrival, because the server never sees a fragment and this is the
   only place that can be fixed.
3. **`public/sitemap.xml`** — the indexable pages, and only those.

### Why every URL in the page is root-absolute

Because the same document is served at `/`, at `/about` and at
`/collections/lvt`. `./app.js` resolves against the folder the address happens
to be in, so on `/collections/lvt` it would ask for `/collections/app.js` and
the site would be a blank page. `IMG_BASE` in `data.js` is `"/"` for the same
reason. This is the one thing to get right when adding anything to
`index.html`.

### Range pages, and why they are noindex

The Worker cannot name a range. The catalogue is in `data.js` and the shop's
own additions are in R2, so serving `/range/westex-elysian` with a real title
would mean parsing both on every page view. Until it does, every range page
would be served the *same* generic title while the visitor sees a different
one on each — a page that says one thing to Google and another to a person,
which is the single thing Google is strict about.

So they are `noindex, follow`: real, working, linked, crawled for their links,
not indexed. **Nothing is lost by this today** — they were fragments until
now, so Google has never had them. Turning it on is one line in
`describePath()` plus a way for the Worker to read the catalogue, and it is
the next worthwhile piece of SEO work here.

---

## Checking it

```
node tools/stub-api.mjs 8890 &
node tools/seo-report.mjs http://127.0.0.1:8890     # what should happen
node tools/seo-report.mjs https://haris-carpets.co.uk   # what does
```

It prints, per URL: the status, where a redirect goes, the title, the
canonical and any `robots` tag, and exits non-zero if anything is wrong. Run
the live one **after every deploy that touches addresses**.

`tools/smoke-test.mjs` covers the same ground in a real browser, including the
check that matters most: that the title the Worker served and the title the
app renders are the same sentence.

---

## After a deploy that changes addresses

1. `node tools/seo-report.mjs https://haris-carpets.co.uk` — all correct.
2. Search Console → **Sitemaps** → resubmit `https://haris-carpets.co.uk/sitemap.xml`.
   The URL has not changed, so this is a re-read rather than a new submission.
3. Search Console → **URL Inspection** → paste `/about`, `/collections/carpets`
   and one or two more → **Request indexing**. This is the only way to hurry
   Google; everything else is waiting.
4. Leave it **two to four weeks**. The old sitelinks disappear when Google
   re-crawls the 404s and 301s, on its own schedule, not ours.

## What is not ours to fix

The **favicon** beside a Google result and the **sitelinks** under it are
Google's cache, updated on Google's own cycle — weeks, typically, and nothing
in this repository moves them faster. `/favicon.ico` exists now, which is the
file Google fetches by name whatever the `<link>` tags say; the rest is
waiting.
