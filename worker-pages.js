/**
 * Hari's Carpets — real page addresses, and the Wix ones that came before.
 *
 * TWO JOBS, AND THEY ARE THE SAME JOB
 *
 * 1. The site used to be a Wix site, and Google still holds its URLs:
 *    /about-us-1, /carpets, /lvt-1, a shelf of /copy-of-carina-* product
 *    pages. Those paths do not exist here, so today they 404 — which loses
 *    both the visitor who clicked a search result and the ranking that URL
 *    had built up. REDIRECTS maps each one to its nearest equivalent, as a
 *    301, at the HTTP level, before the app loads. Permanently: a 301 is how
 *    you tell Google to move the ranking across, and it only works if it
 *    stays.
 *
 * 2. The site's own pages were hash routes — /#/about, /#/collections/lvt.
 *    A fragment is not an address to a crawler: everything after the # is the
 *    same document as "/", so the whole site indexed as one page. PAGES makes
 *    them real paths, served as 200s with their own title, description and
 *    canonical, written into the HTML before it leaves the Worker so that a
 *    crawler which does not run JavaScript still reads the right thing.
 *
 * WHY THE TITLES ARE IN HERE AS WELL AS IN app.js
 * The browser sets them too, in describe() — it has the live catalogue and can
 * name a range the shop added this morning. The Worker cannot: it would have
 * to parse data.js and merge the R2 overlay for every page view. So the fixed
 * pages are written twice, and tools/smoke-test.mjs fails if the two copies
 * ever disagree. Everything with an id in it (/range/<id>) is served with its
 * section's description and corrected by the browser a moment later.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * A rule sending unmatched old paths to the home page. A redirect to somewhere
 * irrelevant is worse for the visitor than a 404 and Google treats it as one
 * anyway ("soft 404"). Anything not in REDIRECTS and not an app path falls
 * through to the static assets and 404s honestly.
 */

const SHOP = "Hari's Carpets";
const SITE = "https://haris-carpets.co.uk";

/* The five floor types. Names and blurbs are copied from CATALOGUE.types in
   public/data.js and the smoke test compares them — change one, change both. */
export const TYPES = {
  carpets: ["Carpets",
    "Wool-rich and synthetic carpets from Britain's leading mills. Browse by brand, range and colour."],
  wood: ["Wood & Laminate",
    "Engineered and solid wood, plus hard-wearing laminate — herringbone, chevron and plank formats."],
  lvt: ["LVT",
    "Luxury vinyl tile — the look of wood or stone with the durability for kitchens, bathrooms and busy family spaces."],
  vinyl: ["Vinyl",
    "Cushioned sheet vinyl — practical, comfortable underfoot and easy to keep clean."],
  rugs: ["Luxury Rugs",
    "Luxury rugs, including Louis de Poortere, to finish and pull a room together."],
};

/* The fixed pages, in the order they go in the sitemap. `h1` and `intro` are
   what a crawler with no JavaScript reads; the app replaces them with the real
   view the moment it boots, so nobody sees them twice. */
export const PAGES = {
  "/": {
    title: `${SHOP} — Carpet & Flooring Showroom, Hounslow`,
    description: "Hari's Carpets, Hounslow. Family-run for 30+ years. Carpets, wood, laminate, LVT, vinyl and rugs — supplied and installed across London and the Home Counties. Free home measure.",
    h1: `${SHOP} — carpets and flooring in Hounslow`,
    intro: "Family-run for over 32 years, supplying and installing carpets, wood, laminate, LVT, vinyl and rugs across London and the Home Counties.",
  },
  "/collections": {
    title: `Collections — ${SHOP}`,
    description: "Every floor we stock, by type: carpets, wood and laminate, LVT, vinyl and rugs.",
    h1: "Collections",
    intro: "Every floor we stock, by type: carpets, wood and laminate, LVT, vinyl and rugs.",
  },
  "/portfolio": {
    title: `Our work — ${SHOP}`,
    description: `Floors ${SHOP} has supplied and installed recently, in homes across London and the Home Counties.`,
    h1: "Our work",
    intro: `Floors ${SHOP} has supplied and installed recently, in homes across London and the Home Counties.`,
  },
  "/about": {
    title: `About us — ${SHOP}`,
    description: `${SHOP} has been a family-run flooring business in Hounslow for over 32 years.`,
    h1: `About ${SHOP}`,
    intro: `${SHOP} has been a family-run flooring business in Hounslow for over 32 years, supplying and installing floors across London and the Home Counties.`,
  },
  "/contact": {
    title: `Visit the showroom — ${SHOP}, Hounslow`,
    description: `Find ${SHOP} at 267 Hanworth Road, Hounslow. Opening hours, directions and a map.`,
    h1: "Visit the showroom",
    intro: "267 Hanworth Road, Hounslow, Middlesex, TW3 3RZ. Telephone 020 8570 6502.",
  },
  "/enquire": {
    title: `Get in touch — ${SHOP}`,
    description: `Ask ${SHOP} about flooring, request a quote, or book a free home measure.`,
    h1: "Get in touch",
    intro: `Ask ${SHOP} about flooring, request a quote, or book a free home measure.`,
  },
};

/* Real addresses, but not ones to put in front of a search engine: one is a
   list of whatever this browser saved, the other is a tool. Served 200 like
   any other page, kept out of the sitemap, and marked noindex. */
export const PRIVATE_PAGES = {
  "/favourites": { title: `My Favourites — ${SHOP}`, h1: "My Favourites" },
  "/visualiser": { title: `See it in a room — ${SHOP}`, h1: "See it in a room" },
};

/* Every first segment the app knows how to render. Anything else is not a page
   of this site and must be allowed to 404. */
const APP_TOPS = new Set([
  "collections", "portfolio", "range", "favourites", "visualiser",
  "about", "contact", "enquire", "catalogue",
]);

/**
 * Old Wix paths → where they live now.
 *
 * Confirmed from Search Console and the live URL test:
 *   /about-us-1  /contact-us-1  /carpets  /lvt-1
 *   /copy-of-carina-tile-click  /copy-of-carina-herringbone
 *   /copy-of-carina-plank-dryback
 *
 * The rest are the shapes Wix sites take and the sitelinks Google is still
 * showing (Velvet, Easy Clean, Flooring, Brands, About Us, Contact Us). A rule
 * for a path nobody ever requests costs nothing; a missing rule costs a
 * visitor. Add to this list as Search Console reports more — that is the whole
 * maintenance story for it.
 */
export const REDIRECTS = {
  /* about / contact */
  "/about-us-1": "/about",
  "/about-us": "/about",
  "/about-1": "/about",
  "/aboutus": "/about",
  "/our-story": "/about",
  "/contact-us-1": "/contact",
  "/contact-us": "/contact",
  "/contact-1": "/contact",
  "/contactus": "/contact",
  "/find-us": "/contact",
  "/opening-hours": "/contact",
  "/get-a-quote": "/enquire",
  "/quote": "/enquire",
  "/enquiry": "/enquire",

  /* the floor types */
  "/carpets": "/collections/carpets",
  "/carpets-1": "/collections/carpets",
  "/carpet": "/collections/carpets",
  "/wool": "/collections/carpets",
  "/wood": "/collections/wood",
  "/wood-1": "/collections/wood",
  "/wood-flooring": "/collections/wood",
  "/laminate": "/collections/wood",
  "/laminate-1": "/collections/wood",
  "/engineered-wood": "/collections/wood",
  "/lvt": "/collections/lvt",
  /* "Flooring - Wood, LVT & Laminate" — a hub over three of our categories,
     so it goes to the hub rather than to one of the three. */
  "/lvt-1": "/collections",
  "/luxury-vinyl": "/collections/lvt",
  "/luxury-vinyl-tiles": "/collections/lvt",
  "/karndean": "/collections/lvt",
  "/amtico": "/collections/lvt",
  /* Not a mistake: the old /vinyl page was titled "Lvt". Wix slugs and Wix
     page titles drifted apart on this site and the title is the evidence of
     what the page was about, so the redirects follow the titles. */
  "/vinyl": "/collections/lvt",
  "/vinyl-flooring": "/collections/vinyl",   /* "Vinyl Flooring London" */
  "/vinyl-1": "/collections/vinyl",
  "/sheet-vinyl": "/collections/vinyl",
  "/rugs": "/collections/rugs",
  "/rugs-1": "/collections/rugs",
  "/luxury-rugs": "/collections/rugs",

  /* the sitelinks Google still shows, which are carpet styles here */
  "/twist-pile": "/collections/carpets/easy-clean",     /* titled "Easy Clean" */
  "/wool-loop": "/collections/carpets/wool-twist",      /* titled "Wool Twist Pile" */
  "/copy-2-of-wool-loop": "/collections/carpets",       /* "Stripe & Pattern" — we have no such style */
  "/stripe": "/collections/carpets",
  "/pattern": "/collections/carpets",
  "/velvet": "/collections/carpets/velvet",
  "/velvet-1": "/collections/carpets/velvet",
  "/saxony": "/collections/carpets/velvet",
  "/easy-clean": "/collections/carpets/easy-clean",
  "/easyclean": "/collections/carpets/easy-clean",
  "/easy-clean-1": "/collections/carpets/easy-clean",
  "/twist": "/collections/carpets/wool-twist",
  "/wool-twist": "/collections/carpets/wool-twist",
  "/loop": "/collections/carpets/loop",
  "/herringbone": "/collections/wood/herringbone",

  /* the pages that were a list of everything */
  "/flooring": "/collections",
  "/flooring-1": "/collections",
  "/brands": "/collections",
  "/brands-1": "/collections",
  "/products": "/collections",
  "/shop": "/collections",
  "/services": "/collections",

  /* the old Carina product pages — Carina is an LVT range */
  "/copy-of-carina-tile-click": "/collections/lvt",
  "/copy-of-carina-herringbone": "/collections/lvt",
  "/copy-of-carina-plank-dryback": "/collections/lvt",
  "/carina": "/collections/lvt",
  "/carina-tile-click": "/collections/lvt",
  "/carina-herringbone": "/collections/lvt",
  "/carina-plank-dryback": "/collections/lvt",
  "/copy-of-carina-plank-click-1": "/collections/lvt",
  "/copy-of-carina-plank-dryback-1": "/collections/lvt",
  "/carina-plank-click": "/collections/lvt",

  /* The other Wix product pages in the index. Every one of these was found
     with a site: search rather than guessed, and the comment is the title
     Google holds for it — which is the only reliable clue to what it was,
     because none of these slugs describes its own page. */
  "/copy-of-lvt": "/collections/wood",                  /* "Wood" */
  "/copy-of-lvt-1": "/collections/wood",                /* "Laminate" */
  "/copy-of-pictora-ii": "/collections/lvt",            /* "Versatility" */
  "/pictora-ii": "/collections/lvt",
  "/copy-of-elite-xl": "/collections/lvt",              /* "Artisan" */
  "/elite-xl": "/collections/lvt",
  "/copy-of-ashdown": "/collections/lvt",               /* "Charisma" */
  "/ashdown": "/collections/lvt",
  "/copy-of-artisan-1": "/collections/lvt",             /* "ASHDOWN" */
  "/artisan": "/collections/lvt",
  "/artisan-1": "/collections/lvt",
  "/copy-of-aurora-herringbone": "/collections/lvt",    /* "Aurora Plank Click" */
  "/aurora-herringbone": "/collections/lvt",
  "/aurora-plank-click": "/collections/lvt",
  "/sirona-plank-dryback": "/collections/lvt",

  /* gallery / our work */
  "/gallery": "/portfolio",
  "/gallery-1": "/portfolio",
  "/our-work": "/portfolio",
  "/projects": "/portfolio",
  "/portfolio-1": "/portfolio",

  /* the policy pages, which are real files rather than app routes */
  "/privacy": "/privacy.html",
  "/privacy-policy": "/privacy.html",
  "/terms": "/privacy.html",
  "/data-deletion": "/privacy.html#deleting",
};

/* Wix's own furniture. None of it is a page of this site and some of it gets
   crawled for years, so it is turned away rather than left to guess. */
export const WIX_JUNK = /^\/(_partials|_api|_serverless|wix-code|blog-frontend-adapter-public)\b/;

const esc = (s) => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/** Trailing slashes, double slashes and upper case all name the same page to a
 *  person and three different ones to a search engine. One shape wins. */
export function tidy(pathname) {
  /* A malformed escape — /%zz, and crawlers do send them — makes
     decodeURIComponent throw. The path is then whatever was asked for,
     which matches nothing here and 404s, which is the right answer. */
  let decoded = pathname;
  try { decoded = decodeURIComponent(pathname); } catch { /* as sent */ }
  let p = decoded.toLowerCase().replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.replace(/\/+$/, "");
  return p || "/";
}

/**
 * What this path is, or null if it is not a page of the app at all.
 * Returns the head a crawler should be served.
 */
export function describePath(pathname) {
  const p = tidy(pathname);

  if (PAGES[p]) return { ...PAGES[p], canonical: SITE + (p === "/" ? "/" : p), index: true };
  if (PRIVATE_PAGES[p]) {
    return { ...PRIVATE_PAGES[p], description: null, canonical: SITE + p, index: false };
  }

  const parts = p.split("/").filter(Boolean);
  if (!parts.length || !APP_TOPS.has(parts[0])) return null;

  /* /collections/<type>[/<style>] — the type is known here, the style is not,
     because the shop can rename its own styles from /admin.

     So a style page is served its type's words and canonicalises to the type
     page. That is what a canonical is for: /collections/carpets/velvet is a
     narrower view of /collections/carpets, not a different subject, and
     pointing it at the parent gathers the old Wix /velvet and /easy-clean
     rankings onto one page instead of splitting them across four thin ones.
     The page itself still works, still renders, and is still linked. */
  if (parts[0] === "collections" && TYPES[parts[1]]) {
    const [name, blurb] = TYPES[parts[1]];
    return {
      title: `${name} — ${SHOP}, Hounslow`,
      description: `${name} from ${SHOP} in Hounslow. ${blurb}`,
      h1: name,
      intro: blurb,
      canonical: SITE + "/collections/" + parts[1],
      index: true,
    };
  }

  /* Anything left is a page with an id in it, and the id has to be in the
     shape the app expects. /collections/tuesday and /about/us are not pages
     of this site; serving them the document would answer a crawler 200 for
     any string anybody ever appended, which is how a site ends up with
     thousands of indexed near-duplicates. They 404 instead.

     The one that mattered: app.js used to fetch "api/site" relative to the
     page, so on /collections/lvt it asked for /collections/api/site — and
     this function answered *that* with the home page, 200, so the shop's own
     edits stopped reaching every page below the top level without a single
     error anywhere. */
  const depth = { collections: 3, range: 2, favourites: 2, visualiser: 2, catalogue: 9 };
  if (!(parts[0] in depth) || parts.length > depth[parts[0]]) return null;
  if (parts[0] === "collections" && parts[1]) return null;   // an unknown floor type
  if (parts[0] === "range" && !parts[1]) return null;

  /* /range/<id>.

     noindex, follow — deliberately, and only for now. The Worker cannot name
     a range: the catalogue is in data.js and the shop's own additions are in
     R2, so every range page would be served the same generic title and Google
     would be shown sixty pages that look identical while the visitor sees
     sixty different ones. That is the one mismatch worth avoiding. `follow`
     means the links on them are still crawled. Nothing is lost by this today
     — these were fragments until now, so Google has never had them — and
     turning it on is one line once the Worker can read the catalogue. */
  return {
    title: `Collections — ${SHOP}`,
    description: "Every floor we stock, by type: carpets, wood and laminate, LVT, vinyl and rugs.",
    h1: "Collections",
    intro: "Every floor we stock, by type: carpets, wood and laminate, LVT, vinyl and rugs.",
    canonical: SITE + p,
    index: false,
  };
}

/** The old path this one replaces, or null. */
export function redirectFor(pathname) {
  const p = tidy(pathname);
  if (REDIRECTS[p]) return REDIRECTS[p];
  /* Wix hung .html on some of the old paths. /about-us-1.html is the same
     page as /about-us-1 and should cost one redirect, not two.

     The guard matters more than it looks: /privacy redirects to the real file
     /privacy.html, and without it /privacy.html would strip its own extension,
     find that rule and redirect to itself, for ever. */
  if (p.endsWith(".html")) {
    const stripped = REDIRECTS[p.slice(0, -5)];
    if (stripped && stripped !== p) return stripped;
  }
  return null;
}


/**
 * Everything above, applied to a request. Returns a Response, or null to let
 * the rest of the Worker deal with it.
 */
export async function pageRoute(request, env, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);

  /* One hostname and the new path, in a single hop.

     Both of these are redirects and they used to be two: the host first, the
     path second. Every URL Google holds for this site is a www one, so every
     old address cost a visitor two round trips and Google a redirect chain —
     the thing the whole exercise was meant to avoid. They are worked out
     together and answered once.

     CANONICAL_HOST is empty in wrangler.jsonc until somebody has loaded the
     hostname in a browser. It shipped once as an unconditional "www goes to
     the bare domain" while the bare domain had no A record, and every page on
     the hostname that worked redirected to one that did not resolve. A
     redirect cannot check that its destination exists, so it does not guess.
     It only ever moves between the www and bare form of one domain, and
     workers.dev is untouched either way. */
  const canonicalHost = (env.CANONICAL_HOST || "").trim().toLowerCase();
  const here = url.hostname.toLowerCase();
  const bare = (h) => h.replace(/^www\./, "");
  const wantHost = canonicalHost && bare(here) === bare(canonicalHost) ? canonicalHost : here;
  const wantPath = redirectFor(url.pathname);

  if (wantPath || wantHost !== here) {
    const to = new URL(wantPath || url.pathname + url.search, url.origin);
    if (wantPath) to.search = url.search;
    to.hostname = wantHost;
    return Response.redirect(to.toString(), 301);
  }

  if (WIX_JUNK.test(url.pathname)) {
    return new Response("Gone", { status: 410, headers: { "cache-control": "public, max-age=86400" } });
  }

  /* The tidy shape of the address, once, so /About/ and /about are not two
     pages with the same words on them.

     Only for the fixed pages, deliberately. Everything below them carries an
     id in the path — a range, a style, the keys in a shared favourites link —
     and tidy() lower-cases, so applying this to those would quietly rewrite
     somebody's link into one that finds nothing. */
  const tidied = tidy(url.pathname);
  const fixed = Boolean(PAGES[tidied] || PRIVATE_PAGES[tidied]
    || /^\/collections(\/(carpets|wood|lvt|vinyl|rugs))?$/.test(tidied));
  if (tidied !== url.pathname && fixed) {
    const to = new URL(url);
    to.pathname = tidied;
    return Response.redirect(to.toString(), 301);
  }

  const page = describePath(url.pathname);
  if (!page) return null;              // a file, the admin, or an honest 404

  /* The app is one document. Fetch it and rewrite its head for this address —
     the request has to name a real asset, hence /index.html. */
  const doc = await env.ASSETS.fetch(new Request(new URL("/index.html", url.origin).toString()));
  if (!doc.ok) return null;

  const html = rewriteHead(await doc.text(), page, PAGES["/"].description);
  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      /* Short, because the shop edits this site from /admin and a stale hour
         is a support call. Long enough that a crawl of forty pages is not
         forty origin fetches. */
      "cache-control": "public, max-age=300",
    },
  });
}

/**
 * The one document, addressed to one page.
 *
 * Text replacement rather than HTMLRewriter, which is the Cloudflare-shaped
 * way to do this: HTMLRewriter only exists inside the Workers runtime, so
 * every line of it would be untestable here and first run in production. The
 * document is one file of a few kilobytes — there is nothing to stream.
 */
export function rewriteHead(html, page, fallbackDescription) {
  const description = page.description || fallbackDescription;
  const set = (source, pattern, replacement) =>
    pattern.test(source) ? source.replace(pattern, replacement) : source;

  let out = html;
  out = set(out, /<title>[\s\S]*?<\/title>/i, `<title>${esc(page.title)}</title>`);
  out = set(out, /(<meta\s+name="description"\s+content=")[^"]*(")/i, `$1${esc(description)}$2`);
  out = set(out, /(<meta\s+property="og:title"\s+content=")[^"]*(")/i, `$1${esc(page.title)}$2`);
  out = set(out, /(<meta\s+property="og:description"\s+content=")[^"]*(")/i, `$1${esc(description)}$2`);
  out = set(out, /(<meta\s+property="og:url"\s+content=")[^"]*(")/i, `$1${esc(page.canonical)}$2`);
  out = set(out, /(<link\s+rel="canonical"\s+href=")[^"]*(")/i, `$1${esc(page.canonical)}$2`);

  if (!page.index) {
    out = out.replace("</head>", '  <meta name="robots" content="noindex, follow">\n</head>');
  }

  /* What a crawler that does not run JavaScript reads. app.js replaces the
     whole of #app on boot, so a visitor never sees it — but it means the page
     served and the page rendered say the same thing, which is the one rule
     Google is strict about. */
  out = out.replace(
    /<main id="app">[\s\S]*?<\/main>/i,
    `<main id="app"><section class="wrap" style="padding:40px 0"><h1>${esc(page.h1)}</h1>`
    + `<p>${esc(page.intro || description)}</p></section></main>`,
  );
  return out;
}
