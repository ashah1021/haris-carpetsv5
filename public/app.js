/* =========================================================================
   HARI'S CARPETS — app (vanilla JS, no build step)
   Routes:
     #/                       home
     #/catalogue              every flooring type
     #/catalogue/<type>       one type, filterable by brand and colour
     #/range/<id>             one range, all of its colours
     #/favourites             the shortlist the visitor has saved
     #/visualiser             see a colour on a real floor
     #/about  #/contact

   The sample tray is gated on FEATURES.samples. Favourites are separate and
   always on — a private shortlist, nothing posted to anyone.
   ========================================================================= */

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $("#app");

/* =========================================================================
   THE LIVE CATALOGUE
   CATALOGUE in data.js is generated from supplier photography and is never
   edited. What the shop changes from /admin — discontinued ranges, new
   collections, shades that are out of stock, which range sits under which
   style — arrives separately from /api/site and is merged over the top here.

   RANGES is that merge, and everything on the site reads it rather than
   CATALOGUE. Until the overlay loads, or if it never does, RANGES *is*
   CATALOGUE: a shop with no admin changes and a shop whose API is down look
   identical, which is the point. Nothing on this page waits for the network.
   ========================================================================= */
let RANGES = CATALOGUE;
let SITE = { version: 0, content: {}, featured: null, styles: {}, overrides: {}, ranges: [] };

const findRange = (id) => RANGES.find((r) => r.id === id);
const findType = (id) => TYPES.find((t) => t.id === id);
const rangesOfType = (type) => RANGES.filter((r) => r.type === type);

/* A hidden range or shade is dropped from the catalogue but its images and its
   key survive, so a saved shortlist or a shared link still resolves. Deleting
   would quietly empty somebody's list; hiding does not. */
function applyOverlay(site) {
  SITE = { ...SITE, ...site };
  const over = SITE.overrides || {};
  const extra = SITE.extra || {};
  const added = (SITE.ranges || []).map((r) => ({ ...r, real: true, added: true }));

  RANGES = [...CATALOGUE, ...added]
    .filter((r) => !over[r.id]?.hidden)
    .map((r) => {
      const o = over[r.id] || {};
      /* shades added from /admin sit after the ones the pipeline measured */
      const colours = [...r.colours, ...(extra[r.id] || [])]
        .filter((c) => !over[`${r.id}:${slugify(c.name)}`]?.hidden)
        .map((c) => {
          const co = over[`${r.id}:${slugify(c.name)}`];
          return co?.name ? { ...c, name: co.name } : c;
        });
      return { ...r, name: o.name || r.name, note: o.note,
               blurb: o.blurb || r.blurb, colours };
    });
}

/* The overlay is fetched, never bundled, so a change is live in seconds
   without a deploy. A failure here is silent on purpose — the generated
   catalogue is a complete, working site on its own. */
async function loadOverlay() {
  try {
    const res = await fetch("api/site", { headers: { accept: "application/json" } });
    if (!res.ok) return false;
    const site = await res.json();
    if (!site || typeof site !== "object") return false;
    applyOverlay(site);
    return true;
  } catch { return false; }
}
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const SAMPLES_ON = typeof FEATURES !== "undefined" && FEATURES.samples;

/* =========================================================================
   COLOUR FAMILIES
   Derived from the hex value rather than stored alongside it, so a new colour
   is filterable the moment it is added and there is no label to keep in sync
   with a swatch. Families are the ones that matter when choosing a floor —
   "Beige & Sand" and "Brown & Walnut" are far more use than "orange".
   ========================================================================= */
const FAMILIES = ["Cream & White", "Beige & Sand", "Brown & Walnut", "Grey",
                  "Charcoal & Black", "Green", "Blue", "Red & Terracotta", "Heather & Plum"];

function hsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? ((g - b) / d + (g < b ? 6 : 0))
      : max === g ? (b - r) / d + 2
      : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function colourFamily(hex) {
  const { h, s, l } = hsl(hex);
  const warm = h >= 18 && h < 75;   /* the beige-through-brown side of the wheel */
  if (l <= 0.18) return "Charcoal & Black";
  /* Near-neutral: hue is noise at this saturation, so go by lightness — but keep
     the warm/cool distinction, because a warm mid grey is what the trade calls a
     beige and filing it under "Grey" is what made this list feel wrong.
     The threshold is 0.10 rather than 0.08 because shades like Westex Abalone
     (#b4b5a8, s=0.08, h=65) were landing in Green on a technicality. */
  if (s < 0.10) {
    if (l >= 0.85) return "Cream & White";
    if (l < 0.32) return "Charcoal & Black";
    return warm && l >= 0.55 ? "Beige & Sand" : "Grey";
  }
  if (h >= 70 && h < 170) return "Green";
  if (h >= 170 && h < 260) return "Blue";
  if (h >= 260 && h < 330) return "Heather & Plum";
  if (h >= 330 || h < 15) return s > 0.25 ? "Red & Terracotta" : "Heather & Plum";
  /* 15-60deg is where nearly every floor lives — brightness separates it */
  if (l >= 0.82) return "Cream & White";
  if (l >= 0.55) return s > 0.45 ? "Red & Terracotta" : "Beige & Sand";
  if (l >= 0.34) return s > 0.30 ? "Brown & Walnut" : "Beige & Sand";
  return "Brown & Walnut";
}

/* every colour in the catalogue, flattened, each knowing its parent range */
function allSwatches(typeId) {
  const out = [];
  for (const range of RANGES) {
    if (typeId && range.type !== typeId) continue;
    for (const col of range.colours) {
      out.push({
        /* keyed on the colour name, not the generated code: codes are renumbered
           whenever the catalogue is rebuilt, which would break saved lists and
           every shared link. */
        key: range.id + ":" + slugify(col.name),
        name: col.name, code: col.code, hex: col.hex,
        /* the tile's file stem, which is only the colour name when the supplier
           named it that way — see v() in data.js */
        file: col.file || slugify(col.name), roomFile: col.roomFile,
        rangeId: range.id, range: range.name, brand: range.brand, type: range.type,
        family: colourFamily(col.hex), room: col.room,
        /* false on the two placeholder ranges, which have no photographed
           chips. Without this the tiles request swatch jpgs that were never
           taken — a dozen 404s per page load for an image that can't exist. */
        shot: range.real !== false,
        /* Some suppliers photographed a room instead of a chip. The picture is
           still worth showing, just not as a swatch, so the tile falls back to
           the measured hex and the photograph moves to the roomset slot.
           Keyed on the file, because that is what was measured. */
        chip: !ROOM_ONLY.has(range.id + ":" + (col.file || slugify(col.name))),
      });
    }
  }
  return out;
}

/* =========================================================================
   FAVOURITES
   A private shortlist, kept in localStorage so it survives closing the tab —
   the whole point being that nobody has to find the same shade twice. It is
   deliberately NOT a sample request: nothing is sent anywhere unless the
   visitor chooses to bring the list to us.

   The list also round-trips through a URL, so it can move between a phone and
   a laptop, or be handed to us in the showroom, without any account.
   ========================================================================= */
const FAV_KEY = "haris.favourites.v1";
let FAVS = [];

function favLoad() {
  try { FAVS = JSON.parse(localStorage.getItem(FAV_KEY)) || []; }
  catch { FAVS = []; }
}
function favSave() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(FAVS)); } catch { /* private mode */ }
  favSyncCount();
}
const isFav = (key) => FAVS.some((f) => f.key === key);

function favToggle(key) {
  const i = FAVS.findIndex((f) => f.key === key);
  if (i > -1) FAVS.splice(i, 1);
  else {
    const sw = allSwatches().find((s) => s.key === key);
    if (!sw) return;
    FAVS.push(sw);
  }
  favSave();
  document.querySelectorAll(`[data-fav="${CSS.escape(key)}"]`).forEach((el) => {
    const on = isFav(key);
    el.classList.toggle("on", on);
    el.setAttribute("aria-pressed", on);
    el.title = on ? "Saved — click to remove" : "Save this shade";
  });
  if (location.hash.startsWith("#/favourites")) render();
}

function favSyncCount() {
  const n = FAVS.length;
  document.querySelectorAll("#favCount").forEach((el) => { el.textContent = n; });
  const btn = $("#favBtn");
  if (btn) btn.classList.toggle("has", n > 0);
}

/* share link — keys are short, so the list rides in the URL itself */
const favLink = () =>
  location.origin + location.pathname + "#/favourites/" +
  encodeURIComponent(FAVS.map((f) => f.key).join(","));

function favFromKeys(str) {
  const wanted = decodeURIComponent(str || "").split(",").filter(Boolean);
  if (!wanted.length) return;
  const all = allSwatches();
  const found = wanted.map((k) => all.find((s) => s.key === k)).filter(Boolean);
  for (const sw of found) if (!isFav(sw.key)) FAVS.push(sw);
  favSave();
}

/* =========================================================================
   SHARED BITS
   ========================================================================= */

/* The picture for a slot: the shop's if they have uploaded one, otherwise
   whatever the site shipped with. */
const siteImage = (slot, fallback) =>
  (SITE.images && SITE.images[slot]) ? P(SITE.images[slot]) : fallback;

/* =========================================================================
   WORDS THE SHOP CAN CHANGE
   Opening hours, the phone number, the About text. Same idea as siteImage:
   what /admin has saved, or what the site shipped with. Every use of these
   values goes through say() — a value read straight off CONTACT or ABOUT is a
   value the shop cannot change, which is how the whole Shop details tab came
   to save happily and alter nothing.
   ========================================================================= */
const say = (key, fallback) => {
  const v = SITE.content && SITE.content[key];
  return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
};

/* Paragraphs, split on blank lines so the shop writes in a plain box. */
const sayLines = (key, fallback) => {
  const v = say(key, null);
  return v ? v.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) : fallback;
};

/* A phone number typed by a human — "020 8570 6502", or with spaces missing —
   has to become a dialable href. Strip everything but digits and a leading +,
   and assume a UK number when it starts 0. */
function telHref(number) {
  const raw = String(number).replace(/[^\d+]/g, "");
  if (raw.startsWith("+")) return "tel:" + raw;
  if (raw.startsWith("0")) return "tel:+44" + raw.slice(1);
  return "tel:" + raw;
}

/* The header and footer are in index.html rather than rendered, so they are
   patched in place once the overlay arrives. */
function applyContentToChrome() {
  const phone = say("phone", CONTACT.phone);
  document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
    a.href = telHref(phone);
    if (a.textContent.trim().replace(/\s+/g, " ") !== phone) a.textContent = phone;
  });
  const email = say("email", CONTACT.email);
  document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
    a.href = "mailto:" + email;
    a.textContent = email;
  });
  /* the footer showed the address the site shipped with while the contact page
     showed the shop's — one address per site, please */
  const foot = document.getElementById("footAddress");
  if (foot) foot.textContent = say("address", CONTACT.address);
  const blurb = document.getElementById("footBlurb");
  if (blurb) blurb.textContent = say("footerBlurb", blurb.textContent);
}

const rangePhoto = (r) => siteImage("range:" + r.id, r.photo);

/* The four claims across the top of the home page. Two boxes each in /admin:
   the bold phrase, then the rest of the line. */
const PROOF = [
  ["proof1", "30+ years", "family run"],
  ["proof2", "Our own fitters", "\u2014 not subcontractors"],
  ["proof3", "Free", "home measure & plan"],
  ["proof4", "Old flooring", "lifted & taken away"],
];

/* What a photograph is described as. Alt text for a screen reader, and the
   caption shown while a picture is still missing. */
const caption = (slot, fallback) => {
  const v = SITE.captions && SITE.captions[slot];
  return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
};
const rangeCaption = (r) => caption("range:" + r.id, r.alt || `${r.name} flooring`);

/* A flooring type shows one of the site photographs above, so replacing that
   photograph changes the tile too — which is what somebody who has just
   swapped "Carpets" expects to happen. */
const TYPE_SLOT = { carpets: "velvet", wood: "wood", lvt: "lvt", vinyl: "vinyl", rugs: "rug" };
const typePhoto = (t) => siteImage(TYPE_SLOT[t.id] || t.id, t.photo);

function photo(src, alt, ratio = "4-3", cls = "") {
  const label = esc(alt || "Photograph");
  return `<div class="ph r-${ratio} ${cls}" data-ph="${label}">
    <img src="${esc(src)}" alt="${label}" loading="lazy" onerror="this.remove()">
  </div>`;
}

/* Must match slug() in tools/emit-catalogue.py — these build the paths that
   script uploaded to, so the two have to agree exactly. */
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const swatchImg = (sw) => siteImage("shade:" + sw.rangeId + ":" + slugify(sw.name),
  P("swatches/" + sw.rangeId + "/" + (sw.file || slugify(sw.name)) + ".jpg"));
const roomImg = (sw) => P("roomsets/" + sw.rangeId + "/" + slugify(sw.name) + ".jpg");

/* Where the room photograph lives, in the three ways a shade can have one:
   a dedicated roomset file, a second supplier photograph alongside the chip,
   or — when the supplier never shot a chip at all — the file that was standing
   in as the swatch. */
const hasRoom = (sw) => Boolean(sw.room || sw.roomFile) || sw.chip === false;
const roomPhoto = (sw) =>
  sw.roomFile ? P("swatches/" + sw.rangeId + "/" + sw.roomFile + ".jpg")
  : sw.chip === false ? swatchImg(sw)
  : roomImg(sw);

const heart = (key) => `<button class="fav${isFav(key) ? " on" : ""}" data-fav="${esc(key)}"
  aria-pressed="${isFav(key)}" title="${isFav(key) ? "Saved — click to remove" : "Save this shade"}"
  aria-label="Save this shade">♥</button>`;

/* One colour tile. The hex sits behind the photograph so the tile is the right
   colour the instant it paints, and stays right if the photo never arrives. */
function swatchTile(sw, opts = {}) {
  return `<div class="swatch">
    ${heart(sw.key)}
    <button class="col" style="background:${sw.hex}" data-zoom="${esc(sw.key)}"
            aria-label="View ${esc(sw.name)} larger">
      ${sw.shot ? `<img class="${sw.chip === false ? "floor-crop" : ""}" src="${swatchImg(sw)}"
        alt="${esc(sw.name)} — ${esc(sw.range)}" loading="lazy" onerror="this.remove()">` : ""}
      ${hasRoom(sw) ? `<span class="pin" title="Photographed in a room">Room</span>` : ""}
    </button>
    <span class="meta">
      <span class="cn">${esc(sw.name)}</span>
      ${opts.showRange === false ? "" : `<span class="cr">${esc(sw.brand)} · ${esc(sw.range)}</span>`}
    </span>
  </div>`;
}

/* ---- lightbox: the big view of one shade ---- */
function openZoom(key) {
  const sw = allSwatches().find((s) => s.key === key);
  if (!sw) return;
  const box = $("#zoom");
  $("#zoomBody").innerHTML = `
    <div class="zoom-media">
      <div class="zoom-main" style="background:${sw.hex}">
        ${sw.shot && sw.chip !== false ? `<img src="${swatchImg(sw)}" alt="${esc(sw.name)}" onerror="this.remove()">` : ""}
      </div>
      ${hasRoom(sw) ? `<div class="zoom-room"><img src="${roomPhoto(sw)}" alt="${esc(sw.name)} in a room" onerror="this.closest('.zoom-room').remove()">
        <span class="zoom-cap">${esc(sw.name)} photographed in a room${sw.chip === false ? " — colour measured off the floor" : ""}</span></div>` : ""}
    </div>
    <div class="zoom-info">
      <p class="kicker">${esc(sw.brand)}</p>
      <h3>${esc(sw.name)}</h3>
      <p class="zoom-sub"><a href="#/range/${esc(sw.rangeId)}">${esc(sw.range)}</a> · ${esc(sw.code)} · ${esc(sw.family)}</p>
      <div class="zoom-actions">
        ${heart(sw.key)}<span class="zoom-favlabel">Save to my list</span>
      </div>
      ${VISUALISER_ON ? `<a class="btn btn-solid btn-sm" href="#/visualiser/${esc(sw.rangeId)}" data-zoom-close>See it in a room</a>` : ""}
      <a class="btn btn-ghost btn-sm" href="#/range/${esc(sw.rangeId)}" data-zoom-close>All ${esc(sw.range)} shades</a>
    </div>`;
  box.classList.add("open");
  document.body.style.overflow = "hidden";
  $("#zoomClose").focus();
}
function closeZoom() {
  $("#zoom")?.classList.remove("open");
  document.body.style.overflow = "";
}

function rangeCard(r) {
  return `<a class="card" href="#/range/${esc(r.id)}">
    ${photo(rangePhoto(r), rangeCaption(r), "4-3")}
    <div class="card-swatches">${r.colours.slice(0, 8).map((x) => `<span style="background:${x.hex}"></span>`).join("")}</div>
    <div class="card-body">
      <span class="k">${esc(r.brand)} · ${esc(r.code)}</span>
      <h3>${esc(r.name)}</h3>
      <span class="desc">${esc(r.blurb)}</span>
      ${r.real ? "" : `<span class="tag-placeholder">Placeholder data</span>`}
      <span class="card-foot">${r.colours.length} colours →</span>
    </div></a>`;
}

function typeTile(t, i) {
  const lead = i < 2;
  return `<a class="cat-tile${lead ? " lead" : ""}" href="${t.route}">
    ${photo(typePhoto(t), caption(TYPE_SLOT[t.id] || t.id, t.alt || t.name), lead ? "16-9" : "4-3")}
    <div class="cat-cap"><h3>${esc(t.name)}</h3><p>${esc(say("type-" + t.id, t.blurb))}</p>
      <span class="go">View ${esc(t.name)}</span></div></a>`;
}

const servicesGrid = () =>
  `<div class="grid cols-4">${SERVICES.map((s) => `<div class="svc"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join("")}</div>`;

/* =========================================================================
   VIEWS
   ========================================================================= */
/* =========================================================================
   REVIEWS AND INSTAGRAM
   Both are entered in /admin rather than pulled live, and both render nothing
   at all until the shop has put something in. An empty reviews strip or a grid
   of grey squares is worse than no section, and inventing either would be
   putting words in a customer's mouth on a real shop's website.
   ========================================================================= */
function reviewsStrip() {
  const r = SITE.reviews;
  if (!r) return "";
  /* Filtered here as well as on the way in. Whether a section appears at all
     should not depend on something upstream having tidied the data — an empty
     quote box saved by accident must not put an empty blockquote on the home
     page. */
  const items = (r.items || []).filter((i) => i && i.text && i.text.trim());
  const rating = (r.rating || "").trim();
  if (!items.length && !rating) return "";

  const stars = (n) => {
    const filled = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    return `<span class="stars" role="img" aria-label="${filled} out of 5">${
      "★".repeat(filled)}<span class="stars-off">${"★".repeat(5 - filled)}</span></span>`;
  };
  /* The initial in a coloured disc, the way every review site does it. Hue from
     the name so the same person is always the same colour. */
  const avatar = (name) => {
    const n = (name || "?").trim();
    let h = 0;
    for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 360;
    return `<span class="rv-face" style="background:hsl(${h} 45% 42%)" aria-hidden="true">${
      esc(n[0] ? n[0].toUpperCase() : "?")}</span>`;
  };

  return `
  <section class="reviews"><div class="wrap">
    <div class="reviews-bar">
      <div class="reviews-brand">
        <b>Google</b> Reviews
        ${rating ? `<span class="reviews-score">${esc(rating)} ${stars(rating)}
          ${r.count ? `<i>(${esc(r.count)})</i>` : ""}</span>` : ""}
      </div>
      ${r.url ? `<a class="btn btn-solid btn-sm" href="${esc(r.url)}"
        target="_blank" rel="noopener">Review us on Google</a>` : ""}
    </div>
    ${items.length ? `<div class="reviews-list">${items.slice(0, 3).map((i) => `
      <figure class="rv">
        <figcaption>
          ${avatar(i.name)}
          <span class="rv-who"><b>${esc(i.name || "Google customer")}</b>
            ${i.when ? `<small>${esc(i.when)}</small>` : ""}</span>
        </figcaption>
        ${stars(i.stars || 5)}
        <p>${esc(i.text)}</p>
      </figure>`).join("")}</div>` : ""}
  </div></section>`;
}

/* Posts pulled live from Instagram, when the feed is configured and answering.
   Chosen posts are the fallback, not the other way round: if the token has
   lapsed the shop still has something on the front page. */
let IG_LIVE = null;

async function loadInstagram() {
  try {
    const res = await fetch("api/instagram", { headers: { accept: "application/json" } });
    if (!res.ok) return false;
    const body = await res.json();
    if (!body?.posts?.length) return false;
    IG_LIVE = body.posts;
    return true;
  } catch { return false; }
}

function instagramGrid() {
  const g = SITE.instagram;
  /* same reasoning as the reviews strip: a post with no picture is not a tile */
  const chosen = (g?.posts || []).filter((p) => p && p.image);
  const live = (IG_LIVE || []).filter((p) => p && p.image && p.link);
  const posts = live.length ? live : chosen;
  if (!posts.length) return "";
  const tile = (p) => {
    const src = /^https?:\/\//.test(p.image) ? p.image : P(p.image);
    const img = `<img src="${esc(src)}" alt="${esc(p.caption || "")}" loading="lazy" onerror="this.remove()">`;
    return p.link
      ? `<a class="ig-tile" href="${esc(p.link)}" target="_blank" rel="noopener">${img}</a>`
      : `<span class="ig-tile">${img}</span>`;
  };
  return `
  <section class="sec-alt"><div class="wrap">
    <div class="section-head"><div><span class="rule"></span>
      <p class="kicker">${esc(say("instaKicker", "On Instagram"))}</p><h2>${esc(say("instaHeading", "Recent work"))}</h2></div>
      ${g.url ? `<a class="btn btn-ghost btn-sm" href="${esc(g.url)}" target="_blank" rel="noopener">Follow us</a>` : ""}</div>
    <div class="ig-grid">${posts.slice(0, 8).map(tile).join("")}</div>
  </div></section>`;
}

function viewHome() {
  /* An optional line the shop can put across the top — a bank holiday, a
     delivery delay, a sale. Empty means no strip at all rather than an empty
     one, so leaving it blank is the normal state. */
  const notice = say("notice", "");
  return `
  ${notice ? `<div class="notice"><div class="wrap">${esc(notice)}</div></div>` : ""}
  <section class="hero">
    ${photo(siteImage("hero", IMG.hero), caption("hero", "Wool carpet in a family living room"), "16-9")}
    <div class="hero-scrim"></div>
    <div class="wrap">
      <p class="kicker">${esc(say("since", BUSINESS.since))}</p>
      <h1>${esc(say("heroTitle", "The flooring shop on Hanworth Road."))}</h1>
      <p>Family-run since the nineties. Carpets, wood, LVT, vinyl and rugs — supplied
         and fitted by our own team, right across London and the Home Counties.</p>
      <div class="hero-cta">
        <a class="btn btn-yellow" href="#/contact">Book a free measure</a>
        <a class="btn btn-ghost on-dark" href="#/catalogue">Browse the catalogue</a>
      </div>
    </div>
  </section>

  <div class="proof"><div class="wrap">
    ${PROOF.map(([k, b, r]) => `<span><b>${esc(say(k + "Bold", b))}</b> ${esc(say(k, r))}</span>`).join("")}
  </div></div>


  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><h2>${esc(say("typesHeading", "Every floor, one showroom"))}</h2>
        <p>Wool carpet, engineered wood, laminate, LVT, sheet vinyl and rugs — all under
           one roof on Hanworth Road, and all fitted by us.</p></div>
      ${VISUALISER_ON ? `<a class="arrow-link" href="#/visualiser">Try colours in a room →</a>` : ""}
    </div>
    <div class="cat-grid">${TYPES.map(typeTile).join("")}</div>
  </div></section>

  ${instagramGrid()}

  <section class="sec-alt"><div class="wrap">
    <div class="split">
      <div class="split-media stack">
        ${photo(siteImage("showroom", IMG.showroom), caption("showroom", "Inside the Hari's Carpets showroom in Hounslow"), "3-2")}
        <div class="inset">${photo(siteImage("samples", IMG.samples), caption("samples", "Carpet sample swatches on the showroom counter"), "1-1")}</div>
      </div>
      <div class="split-copy">
        <span class="rule"></span>
        <p class="kicker">${esc(say("showroomKicker", "Come and see it in daylight"))}</p>
        <h2>${esc(say("showroomHeading", "A screen won\'t tell you how it feels underfoot"))}</h2>
        <p class="lede">Colour shifts under different light, and pile you love in a photograph can
           feel wrong the moment you stand on it. That's what the showroom is for.</p>
        <p>Save the shades you like as you browse and bring the list in — we'll pull those
           books out and you won't have to start again.</p>
        <p style="margin-top:22px"><a class="arrow-link" href="#/contact">Find us &amp; opening hours →</a></p>
      </div>
    </div>
  </div></section>


  <section class="band"><div class="wrap">
    <div class="split flip">
      <div class="split-media">${photo(siteImage("fitting", IMG.fitting), caption("fitting", "A carpet fitter finishing an edge with a knee kicker"), "3-2")}</div>
      <div class="split-copy">
        <span class="rule on-dark"></span>
        <p class="kicker">${esc(say("serviceKicker", "How we work"))}</p>
        <h2>${esc(say("serviceHeading", "Supplied and fitted, properly"))}</h2>
        <p class="lede">The same team measures the job and comes back to fit it. Nothing gets
           handed to a subcontractor who's never seen your house.</p>
        <p style="margin-top:24px"><a class="btn btn-yellow" href="#/contact">Book a free measure</a></p>
      </div>
    </div>
    <div style="margin-top:clamp(34px,5vw,60px)">${servicesGrid()}</div>
  </div></section>


  <section class="sec-alt"><div class="wrap">
    <div class="split">
      <div class="split-copy">
        <span class="rule"></span><p class="kicker">${esc(say("familyKicker", "Family run, Hounslow"))}</p>
        <h2>${esc(say("aboutLead", ABOUT.lead))}</h2>
        <p class="lede" style="margin-top:14px">${esc(sayLines("aboutBody", ABOUT.body)[0])}</p>
        <p style="margin-top:22px"><a class="btn btn-ghost" href="#/about">More about us</a></p>
      </div>
      <div class="split-media">${photo(siteImage("stairs", IMG.stairs), caption("stairs", "Wool twist carpet fitted to a staircase and landing"), "3-2")}</div>
    </div>
  </div></section>

  ${reviewsStrip()}`;
}

/* ---------- catalogue: filterable by brand and colour family ---------- */
const CAT = { view: "colours", brand: "", family: "", sort: "range" };

/* Counts shown on each chip are faceted: the number next to a brand is how many
   you get if you pick it *given the colour filter already on*, and vice versa.
   A chip that would give you nothing is disabled rather than left to look
   clickable — the old version let you filter your way to an empty grid with no
   hint why. */
function facetCounts(all, active) {
  const brands = {}, families = {};
  for (const s of all) {
    if (!active.family || s.family === active.family) brands[s.brand] = (brands[s.brand] || 0) + 1;
    if (!active.brand || s.brand === active.brand) families[s.family] = (families[s.family] || 0) + 1;
  }
  return { brands, families };
}

/* =========================================================================
   STYLES — the "what sort of floor are you after?" layer
   Collection names mean nothing to somebody who has never bought a carpet.
   These sit in front of them. See the STYLES table in data.js for how ranges
   were assigned and which assignments still need Hari's confirmation.
   ========================================================================= */

/* Only styles that actually have stock behind them. An unpopulated style is
   skipped rather than rendered as a dead end. */
const stylesFor = (typeId) =>
  (STYLES[typeId] || []).map((st) => {
    /* The shop can re-file a range from /admin — that is how the eight
       unverified fibre assignments get corrected without a deploy. An admin
       list replaces the built-in one for that style; no entry means the
       built-in stands. */
    const ids = SITE.styles?.[typeId]?.[st.id] || st.ranges;
    return { ...st, list: ids.map(findRange).filter(Boolean) };
  }).filter((st) => st.list.length);

const findStyle = (typeId, styleId) => stylesFor(typeId).find((s) => s.id === styleId);

const styleCount = (st) => st.list.reduce((n, r) => n + r.colours.length, 0);

/* Every picture a style could put on its tile, best first:
     1. a supplier roomset of a floor in this style — real, and the one place
        those orphaned room photographs are exactly what is wanted
     2. a range photograph shot for this collection
     3. the generic stock photo a range falls back to
   Ranked rather than picked outright because several styles share a fallback,
   and two tiles showing the same navy drawing room says nothing about how the
   two differ. */
function stylePhotoOptions(st) {
  const rooms = [], own = [], stock = [];
  for (const r of st.list) {
    for (const col of r.colours) {
      const stem = col.roomFile || (ROOM_ONLY.has(r.id + ":" + (col.file || slugify(col.name)))
        ? (col.file || slugify(col.name)) : null);
      if (stem) rooms.push(P("swatches/" + r.id + "/" + stem + ".jpg"));
    }
    (String(r.photo).includes("assets/ranges/") ? own : stock).push(r.photo);
  }
  return [...rooms, ...own, ...stock];
}

/* Hand out the tile pictures so no two styles in a type share one. Styles with
   the fewest options choose first, otherwise a style spoilt for choice takes
   the only picture a leaner one had. */
function stylePhotos(styles) {
  const taken = new Set(), out = {};
  const opts = new Map(styles.map((st) => [st.id, stylePhotoOptions(st)]));
  for (const st of [...styles].sort((a, b) => opts.get(a.id).length - opts.get(b.id).length)) {
    const list = opts.get(st.id);
    out[st.id] = list.find((p) => !taken.has(p)) || list[0];
    taken.add(out[st.id]);
  }
  return out;
}

function styleTile(st, typeId, photos) {
  const n = styleCount(st);
  return `<a class="style-tile" href="#/catalogue/${esc(typeId)}/${esc(st.id)}">
    <div class="style-ph">
      <img src="${esc(photos[st.id])}" alt="${esc(st.name)}" loading="lazy" onerror="this.remove()">
      <span class="style-swatches">${st.list.flatMap((r) => r.colours).slice(0, 6)
        .map((x) => `<span style="background:${x.hex}"></span>`).join("")}</span>
    </div>
    <div class="style-cap">
      <h3>${esc(st.name)}</h3>
      <p>${esc(st.blurb)}</p>
      <span class="style-n">${st.list.length} collection${st.list.length === 1 ? "" : "s"} · ${n} shade${n === 1 ? "" : "s"}</span>
    </div>
  </a>`;
}

/* One style: its collections, each with its own colours underneath, so the
   journey ends where it should — on a colour, not on another menu. */
function viewStyle(typeId, styleId) {
  const type = findType(typeId);
  const st = type && findStyle(typeId, styleId);
  if (!st) return viewNotFound();
  const others = stylesFor(typeId).filter((s) => s.id !== st.id);

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/catalogue">Catalogue</a> /
    <a href="#/catalogue/${esc(typeId)}">${esc(type.name)}</a> / ${esc(st.name)}</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><p class="kicker">${esc(type.name)}</p>
        <h2>${esc(st.name)}</h2><p>${esc(st.blurb)}</p></div>
      ${VISUALISER_ON ? `<a class="btn btn-solid btn-sm" href="#/visualiser">See it in a room</a>` : ""}
    </div>

    ${st.list.map((r) => {
      const sw = allSwatches().filter((s) => s.rangeId === r.id);
      /* a range whose shade names haven't arrived yet still belongs on the
         page — it is stock we can sell — but as a card, not an empty grid */
      if (!sw.length) return `<div class="style-range">
        <div class="style-range-head">
          <div><h3><a href="#/range/${esc(r.id)}">${esc(r.name)}</a></h3>
            <p class="k">${esc(r.brand)} · shades in the showroom</p></div>
          <a class="btn btn-ghost btn-sm" href="#/range/${esc(r.id)}">About this collection</a>
        </div>
        <p class="empty-note">${esc(r.blurb)}</p>
      </div>`;
      return `<div class="style-range">
        <div class="style-range-head">
          <div><h3><a href="#/range/${esc(r.id)}">${esc(r.name)}</a></h3>
            <p class="k">${esc(r.brand)} · ${sw.length} shade${sw.length === 1 ? "" : "s"}</p></div>
          <a class="btn btn-ghost btn-sm" href="#/range/${esc(r.id)}">About this collection</a>
        </div>
        <div class="swatch-grid">${sw.map((s) => swatchTile(s, { showRange: false })).join("")}</div>
      </div>`;
    }).join("")}

    ${others.length ? `<div class="style-more">
      <p class="kicker">Or try</p>
      <div class="style-chips">${others.map((s) =>
        `<a class="chip" href="#/catalogue/${esc(typeId)}/${esc(s.id)}">${esc(s.name)}<span class="n">${styleCount(s)}</span></a>`).join("")}
        <a class="chip" href="#/catalogue/${esc(typeId)}">Every ${esc(type.name.toLowerCase())} shade</a></div>
    </div>` : ""}
  </div></section>`;
}

function viewCatalogue(typeId, styleId) {
  const type = typeId ? findType(typeId) : null;
  if (typeId && !type) return viewNotFound();
  if (type && styleId) return viewStyle(typeId, styleId);

  if (!type) {
    return `
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Catalogue</p></div>
    <section><div class="wrap">
      <div class="section-head"><div><span class="rule"></span><p class="kicker">${esc(say("catalogueKicker", "Everything we supply"))}</p>
        <h2>${esc(say("catalogueHeading", "The catalogue"))}</h2>
        <p>Every floor we stock, by type. Tap any shade to see it close up, and save
           the ones you like to your list as you go.</p></div></div>
      <div class="cat-grid">${TYPES.map(typeTile).join("")}</div>
    </div></section>`;
  }

  const all = allSwatches(type.id);
  const counts = facetCounts(all, CAT);
  const brands = [...new Set(rangesOfType(type.id).map((r) => r.brand))].sort();
  const families = FAMILIES.filter((f) => all.some((s) => s.family === f));

  let shown = all;
  if (CAT.brand) shown = shown.filter((s) => s.brand === CAT.brand);
  if (CAT.family) shown = shown.filter((s) => s.family === CAT.family);

  const ranges = rangesOfType(type.id).filter((r) => !CAT.brand || r.brand === CAT.brand);
  const styles = stylesFor(type.id);

  /* the active filters, spelled out and individually removable */
  const active = [];
  if (CAT.brand) active.push(`<button class="pill" data-brand="">${esc(CAT.brand)} <i>&times;</i></button>`);
  if (CAT.family) active.push(`<button class="pill" data-family="">${esc(CAT.family)} <i>&times;</i></button>`);

  const chip = (label, n, on, attr, val) =>
    `<button class="chip${on ? " on" : ""}${n === 0 ? " off" : ""}" ${n === 0 ? "disabled" : ""}
       data-${attr}="${esc(val)}">${esc(label)}<span class="n">${n}</span></button>`;

  const body = CAT.view === "ranges"
    ? `<div class="grid cols-3">${ranges.map(rangeCard).join("")}</div>`
    : (shown.length
        ? `<div class="swatch-grid">${shown.map((s) => swatchTile(s)).join("")}</div>`
        : `<p class="empty-note">Nothing matches those two filters together.
             <button class="linkish" data-clear="1">Clear filters</button></p>`);

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/catalogue">Catalogue</a> / ${esc(type.name)}</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><h2>${esc(type.name)}</h2><p>${esc(say("type-" + type.id, type.blurb))}</p></div>
      ${VISUALISER_ON ? `<a class="btn btn-solid btn-sm" href="#/visualiser">See it in a room</a>` : ""}
    </div>

    ${styles.length ? `<div class="styles">
      <h3 class="styles-head">What sort of ${esc(type.name.toLowerCase())} are you after?</h3>
      <div class="style-grid">${((ph) => styles.map((s) => styleTile(s, type.id, ph)).join(""))(stylePhotos(styles))}</div>
      <p class="styles-alt">Or <button class="linkish" data-jump="filters">browse all ${all.length} shades</button>
         by brand and colour.</p>
    </div>` : ""}

    <div class="filters" id="filters">
      <div class="filter-row">
        <span class="filter-label">Brand</span>
        <div class="chips">${chip("All brands", all.length, !CAT.brand, "brand", "")}${
          brands.map((b) => chip(b, counts.brands[b] || 0, CAT.brand === b, "brand", b)).join("")}</div>
      </div>
      <div class="filter-row">
        <span class="filter-label">Colour</span>
        <div class="chips">${chip("All colours", all.length, !CAT.family, "family", "")}${
          families.map((f) => `<button class="chip swatch-chip${CAT.family === f ? " on" : ""}${(counts.families[f] || 0) === 0 ? " off" : ""}"
            ${(counts.families[f] || 0) === 0 ? "disabled" : ""} data-family="${esc(f)}">
            <i style="background:${familySample(f, type.id)}"></i>${esc(f)}<span class="n">${counts.families[f] || 0}</span></button>`).join("")}</div>
      </div>
      <div class="filter-row">
        <span class="filter-label">View</span>
        <div class="chips">
          <button class="chip${CAT.view === "colours" ? " on" : ""}" data-view="colours">Every shade</button>
          <button class="chip${CAT.view === "ranges" ? " on" : ""}" data-view="ranges">By collection</button>
        </div>
      </div>
    </div>

    <div class="result-bar">
      <p class="result-count">${CAT.view === "ranges"
        ? `<b>${ranges.length}</b> collection${ranges.length === 1 ? "" : "s"}`
        : `<b>${shown.length}</b> of ${all.length} shades`}</p>
      ${active.length ? `<div class="active-filters">${active.join("")}
        <button class="linkish" data-clear="1">Clear all</button></div>` : ""}
    </div>

    ${body}
  </div></section>`;
}

/* A representative hex for a family chip, taken from what's actually in stock.
   The middle of the family by lightness, not the first one found: alphabetical
   order put a near-black by Blue and a pale sage by Green, so the chips beside
   the filter names contradicted them. Sorting by lightness and taking the
   median gives the shade a visitor would picture on hearing the name. */
function familySample(family, typeId) {
  const hits = allSwatches(typeId).filter((x) => x.family === family);
  if (!hits.length) return "#ccc";
  hits.sort((a, b) => hsl(a.hex).l - hsl(b.hex).l);
  return hits[Math.floor(hits.length / 2)].hex;
}

function viewRange(id) {
  const r = findRange(id);
  if (!r) return viewNotFound();
  const type = findType(r.type);
  const spec = r.spec ? [["Brand", r.brand], ["Range code", r.code], ["Fibre", r.spec.fibre],
                        ["Pile", r.spec.pile], ["Widths", r.spec.widths], ["Suitability", r.spec.use]]
                      : [["Brand", r.brand], ["Range code", r.code]];
  /* From allSwatches rather than rebuilt here. The local copy this replaced had
     drifted: it never learned about tile filenames or room-only shades, so the
     range page asked for images by the wrong name and showed nothing. */
  const swatches = allSwatches().filter((s) => s.rangeId === r.id);

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/catalogue">Catalogue</a> /
    <a href="${type ? type.route : "#/catalogue"}">${esc(type ? type.name : r.type)}</a> / ${esc(r.name)}</p></div>
  <section><div class="wrap">
    <div class="range-hero">
      ${photo(rangePhoto(r), rangeCaption(r), "4-3")}
      <div><span class="rule"></span><h1>${esc(r.name)}</h1><p class="lede">${esc(r.blurb)}</p>
        <ul class="spec">${spec.map(([k, v]) => `<li><div><span class="sl">${esc(k)}</span>${esc(v)}</div></li>`).join("")}</ul>
        <p style="margin-top:26px">${VISUALISER_ON
          ? `<a class="btn btn-solid" href="#/visualiser/${esc(r.id)}">See this range in a room</a>`
          : `<a class="btn btn-solid" href="#/contact">Ask us about this range</a>`}</p></div>
    </div>
  </div></section>
  <section class="sec-alt"><div class="wrap">
    <div class="colours-head"><div><span class="rule"></span>
      <p class="kicker">${swatches.length ? `${swatches.length} shades` : "Shades"}</p><h2>Colours</h2></div>
      ${swatches.length ? `<span class="hint">Tap a shade to see it close up. Tap ♥ to save it — kept on this device, nothing is sent.</span>` : ""}</div>
    ${swatches.length
      ? `<div class="swatch-grid">${swatches.map((s) => swatchTile(s, { showRange: false })).join("")}</div>`
      : `<p class="empty-note">We haven't got the shade names for this range on the site yet —
           ${esc(BUSINESS.name)} has the full book in the showroom.
           <a class="arrow-link" href="#/contact">Ask us about it →</a></p>`}
  </div></section>`;
}

function viewFavourites(keys) {
  if (keys) favFromKeys(keys);
  if (!FAVS.length) {
    return `
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / My list</p></div>
    <section><div class="wrap">
      <span class="rule"></span><p class="kicker">Nothing saved yet</p>
      <h2>Your shortlist is empty</h2>
      <p class="lede" style="margin-top:14px;max-width:56ch">Tap the ♥ on any colour and it lands here.
        The list stays on this device, so you can close the tab and pick up where you left off.</p>
      <p style="margin-top:24px"><a class="btn btn-solid" href="#/catalogue">Browse the catalogue</a></p>
    </div></section>`;
  }

  const byType = {};
  for (const f of FAVS) (byType[f.type] = byType[f.type] || []).push(f);

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / My list</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><p class="kicker">${FAVS.length} shade${FAVS.length === 1 ? "" : "s"} saved</p>
        <h2>My list</h2>
        <p>Saved on this device. Send yourself the link to open it on another one, or bring it
           into the showroom and we'll get those books out.</p></div>
      <div class="fav-actions">
        <button class="btn btn-ghost btn-sm" id="favShare">Copy link to my list</button>
        <a class="btn btn-solid btn-sm" href="#/contact" id="favEnquire">Ask us about these</a>
      </div>
    </div>
    ${Object.entries(byType).map(([t, list]) => {
      const type = findType(t);
      return `<div class="fav-group">
        <h3>${esc(type ? type.name : t)} <span class="n">${list.length}</span></h3>
        <div class="swatch-grid">${list.map((s) => swatchTile(s)).join("")}</div>
      </div>`;
    }).join("")}
    <p class="form-note" style="margin-top:26px">
      <button class="linkish" id="favClear">Clear my list</button>
    </p>
  </div></section>`;
}

function viewAbout() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / About us</p></div>
  <section><div class="wrap">
    <div class="split">
      <div class="split-copy"><span class="rule"></span>
        <p class="kicker">Family run · Hounslow · ${esc(say("since", BUSINESS.since))}</p>
        <h2>${esc(say("aboutLead", ABOUT.lead))}</h2></div>
      <div class="split-media">${photo(siteImage("showroom", IMG.showroom), caption("showroom", "Inside the Hari's Carpets showroom"), "3-2")}</div>
    </div>
    <div class="prose" style="margin-top:clamp(30px,4vw,52px)">${sayLines("aboutBody", ABOUT.body).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  </div></section>
  <section class="band"><div class="wrap">
    <div class="section-head"><div><span class="rule on-dark"></span><p class="kicker">${esc(say("servicesKicker", "Our service"))}</p><h2>${esc(say("servicesHeading", "What you get"))}</h2></div></div>
    ${servicesGrid()}
    <div style="margin-top:30px"><a class="btn btn-yellow" href="#/contact">Book a free measure</a></div>
  </div></section>`;
}

function viewContact() {
  const socials = SOCIALS.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("");
  const map = say("mapEmbed", CONTACT.mapEmbed);
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visit us</p></div>
  <section><div class="wrap">
    <div class="contact-grid">
      <div>
        <span class="rule"></span>
        <p class="kicker">${esc(say("visitKicker", "Come in, or we\'ll come to you"))}</p><h2>${esc(say("visitHeading", "Visit the showroom"))}</h2>
        <p class="lede" style="margin-top:14px">Pop into the Hounslow showroom, or book a free home measure and we'll come to you across ${esc(say("area", CONTACT.area))}.</p>
        <div style="margin-top:24px">
          <div class="info-row"><span class="il">Showroom</span><span><a href="${CONTACT.mapsUrl}" target="_blank" rel="noopener">${esc(say("address", CONTACT.address))}</a></span></div>
          <div class="info-row"><span class="il">Phone</span><span><a href="${telHref(say("phone", CONTACT.phone))}">${esc(say("phone", CONTACT.phone))}</a></span></div>
          <div class="info-row"><span class="il">Email</span><span><a href="mailto:${esc(say("email", CONTACT.email))}">${esc(say("email", CONTACT.email))}</a></span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(say("hours", CONTACT.hours))}</span></div>
          <div class="info-row"><span class="il">Follow</span><span class="socials">${socials}</span></div>
        </div>
        <p style="margin-top:26px"><a class="btn btn-solid" href="#/enquire">Send an enquiry</a></p>
      </div>
      <div>
        ${photo(siteImage("showroom", IMG.showroom), caption("showroom", "Inside the Hari's Carpets showroom"), "3-2")}
      </div>
    </div>
  </div></section>

  ${map ? `<section class="sec-alt"><div class="wrap">
    <div class="section-head"><div><span class="rule"></span><h2>${esc(say("mapHeading", "Find us"))}</h2>
      <p>${esc(say("mapText", "Two minutes from Hounslow West, with parking on Hanworth Road."))}</p></div>
      <a class="btn btn-ghost btn-sm" href="${CONTACT.mapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a></div>
    <div class="map-embed">
      <iframe src="${esc(map)}" title="Map showing Hari's Carpets on Hanworth Road, Hounslow"
              loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
  </div></section>` : ""}`;
}

/* The enquiry form on its own page. It was a column beside the address, where
   it read as an afterthought; on its own it is the thing the page is for. */
function viewEnquire() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Get in touch</p></div>
  <section><div class="wrap">
    <div class="enquire-grid">
      <div>
        <span class="rule"></span>
        <p class="kicker">${esc(say("enquireKicker", "No pressure, no obligation"))}</p>
        <h2>${esc(say("enquireHeading", "Get in touch"))}</h2>
        <p class="lede" style="margin-top:14px">Tell us roughly what you're after and we'll come back to you.
          Home measures are free, and we'll bring samples to your door so you can see them in your own light.</p>
        <div style="margin-top:26px">
          <div class="info-row"><span class="il">Call</span><span><a href="${telHref(say("phone", CONTACT.phone))}">${esc(say("phone", CONTACT.phone))}</a></span></div>
          <div class="info-row"><span class="il">Email</span><span><a href="mailto:${esc(say("email", CONTACT.email))}">${esc(say("email", CONTACT.email))}</a></span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(say("hours", CONTACT.hours))}</span></div>
        </div>
        <p style="margin-top:24px"><a class="arrow-link" href="#/contact">Or visit the showroom →</a></p>
      </div>
      <div><div class="form-card">
        <h3 style="margin-bottom:10px">Send an enquiry</h3>
        <form id="enquiry" novalidate>
          <div class="field"><label for="n">Name</label><input id="n" name="name" required></div>
          <div class="field"><label for="e">Email</label><input id="e" name="email" type="email" required></div>
          <div class="field"><label for="p">Phone</label><input id="p" name="phone"></div>
          <div class="field"><label for="w">What can we help with?</label>
            <select id="w" name="topic">
              <option>Book a free home measure</option>
              ${SAMPLES_ON ? "<option>Request carpet samples</option>" : ""}
              ${TYPES.map((t) => `<option>${esc(t.name)}</option>`).join("")}
              <option>Something else</option>
            </select></div>
          <div class="field"><label for="m">Message</label><textarea id="m" name="message" rows="4"></textarea></div>
          <button class="btn btn-solid" type="submit" style="width:100%;justify-content:center">Send enquiry</button>
          <p class="form-note">Demo form — not connected yet. Wire it to Formspree or Netlify Forms to receive enquiries.</p>
        </form>
      </div></div>
    </div>
  </div></section>`;
}

function viewNotFound() {
  return `<section><div class="wrap"><span class="rule"></span><p class="kicker">404</p>
    <h2>We couldn't find that page</h2><p style="margin-top:14px"><a class="arrow-link" href="#/">Back to home →</a></p></div></section>`;
}

/* The visualiser lives in visualiser.js and is optional — see FEATURES.
   The site only ever reaches it through window.Visualiser, so the module can be
   deleted outright without touching anything here. */
const VISUALISER_ON = typeof FEATURES !== "undefined" && FEATURES.visualiser && !!window.Visualiser;

/* =========================================================================
   ROUTER
   ========================================================================= */
function render() {
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  let html, top = parts[0];
  switch (top) {
    case undefined:    html = viewHome(); break;
    case "catalogue":  html = viewCatalogue(parts[1], parts[2]); break;
    case "range":      html = viewRange(parts[1]); break;
    case "favourites": html = viewFavourites(parts[1]); break;
    case "visualiser": html = VISUALISER_ON ? window.Visualiser.view(parts[1]) : viewNotFound(); break;
    case "about":      html = viewAbout(); break;
    case "contact":    html = viewContact(); break;
    case "enquire":    html = viewEnquire(); break;
    default:           html = viewNotFound();
  }
  app().innerHTML = html;
  applyContentToChrome();

  const hash = location.hash || "#/";
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === "#/" ? hash === "#/" : (hash === href || hash.startsWith(href + "/")));
  });
  $(".nav")?.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "auto" });
  favSyncCount();
  if (top === "contact") wireEnquiry();
  if (top === "visualiser" && VISUALISER_ON) window.Visualiser.mount();
  reveal();
}

function wireEnquiry() {
  const form = $("#enquiry");
  if (!form) return;
  /* arriving from the shortlist brings the list with it */
  if (sessionStorage.getItem("haris.enquiry.prefill")) {
    const m = $("#m");
    if (m) m.value = sessionStorage.getItem("haris.enquiry.prefill");
    sessionStorage.removeItem("haris.enquiry.prefill");
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.name.value || !f.email.value) { alert("Please add your name and email."); return; }
    f.innerHTML = `<h3 style="margin-bottom:8px">Thanks — we'll be in touch.</h3>
      <p class="desc">This is a demo confirmation. Wire the form to a real endpoint to receive enquiries.</p>`;
  });
}

/* Sections fade up once as they come into view. Deliberately restrained: one
   short transform, only on first sight, and skipped entirely when the visitor
   has asked for reduced motion. */
let revealObserver;
function reveal() {
  const wants = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll("#app section, #app .cat-tile, #app .card");
  if (!wants || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("seen"));
    return;
  }
  /* threshold must be 0. A percentage threshold cannot be met by an element
     taller than the viewport — the catalogue section is 600+ swatches tall, so
     4% of it never fits on screen, the observer never fired, and the section
     stayed at opacity 0 with nothing on the page. */
  revealObserver ||= new IntersectionObserver((entries, obs) => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add("seen"); obs.unobserve(en.target); }
    }
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
  targets.forEach((el) => { el.classList.add("will-reveal"); revealObserver.observe(el); });

  /* Safety net: whatever happens with the observer, nothing stays invisible.
     A missed animation is a blemish; a blank page is a broken site. */
  clearTimeout(reveal.failsafe);
  reveal.failsafe = setTimeout(() => targets.forEach((el) => el.classList.add("seen")), 1200);
}

/* ---------- global events ---------- */
document.addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) return favToggle(fav.dataset.fav);

  const zoom = e.target.closest("[data-zoom]");
  if (zoom) return openZoom(zoom.dataset.zoom);
  if (e.target.closest("[data-zoom-close]") || e.target.id === "zoomClose"
      || e.target.id === "zoom") return closeZoom();

  const clear = e.target.closest("[data-clear]");
  if (clear) { CAT.brand = ""; CAT.family = ""; return render(); }

  const jump = e.target.closest("[data-jump]");
  if (jump) { document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }

  const brand = e.target.closest("[data-brand]");
  if (brand) { CAT.brand = brand.dataset.brand; return render(); }
  const family = e.target.closest("[data-family]");
  if (family) {
    CAT.family = family.dataset.family;
    if (CAT.family) CAT.view = "colours";   /* a colour filter is meaningless on collection cards */
    return render();
  }
  const view = e.target.closest("[data-view]");
  if (view) { CAT.view = view.dataset.view; return render(); }

  if (e.target.id === "favShare") {
    const link = favLink();
    navigator.clipboard?.writeText(link).then(
      () => { e.target.textContent = "Link copied ✓"; setTimeout(() => { e.target.textContent = "Copy link to my list"; }, 2200); },
      () => { prompt("Copy your list link:", link); });
    return;
  }
  if (e.target.id === "favEnquire") {
    sessionStorage.setItem("haris.enquiry.prefill",
      "I'd like to ask about these shades:\n" +
      FAVS.map((f) => `• ${f.name} (${f.code}) — ${f.brand} ${f.range}`).join("\n"));
    return;
  }
  if (e.target.id === "favClear") {
    if (confirm("Clear all saved shades?")) { FAVS = []; favSave(); render(); }
  }
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeZoom(); });
window.addEventListener("hashchange", () => { closeZoom(); render(); });
window.addEventListener("DOMContentLoaded", () => {
  if (!SAMPLES_ON) ["#trayBtn", "#tray", "#scrim"].forEach((s) => $(s)?.remove());
  favLoad();
  if (!VISUALISER_ON) {
    document.querySelectorAll('a[href^="#/visualiser"]').forEach((a) => a.remove());
  }
  render();
  favSyncCount();
  $("#navToggle").addEventListener("click", () => $(".nav").classList.toggle("show"));

  /* Render first, merge second. The generated catalogue is already in the page,
     so the shop is readable before this request is even sent; when it lands,
     anything the admin changed redraws. Deliberately not awaited — a slow or
     missing API must cost the visitor nothing. */
  Promise.all([loadOverlay(), loadInstagram()]).then(([overlay, insta]) => {
    if (overlay || insta) { favSyncCount(); render(); }
  });
});
