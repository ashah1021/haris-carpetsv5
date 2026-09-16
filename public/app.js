/* =========================================================================
   HARI'S CARPETS — app (vanilla JS, no build step)
   Routes:
     #/                       home
     #/collections              every flooring type
     #/collections/<type>       one type, filterable by brand and colour
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
let SITE = { version: 0, content: {}, off: {}, featured: null, styles: {},
             overrides: {}, ranges: [], portfolio: [] };

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
/* Empty box and switched-off are two different intentions, and the shop needs
   both. Clearing a box puts the shipped wording back — that is what the faint
   grey text in /admin is promising, and it means no amount of typing can leave
   a page with a hole in it. Switching a line off is the deliberate act: it is
   recorded separately, so the words are still there when it is switched back on.

   `off` is read here and nowhere else. The first version had say() and
   sayLines() checking it independently, and sayLines() got it wrong — it tests
   its own result for truthiness, so a switched-off value came back as "" and
   fell straight through to the shipped default. The About body would have been
   the one paragraph on the site that could not be turned off. */
const say = (key, fallback) => {
  if (SITE.off && SITE.off[key] === true) return "";
  const v = SITE.content && SITE.content[key];
  return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
};

/* Paragraphs, split on blank lines so the shop writes in a plain box. */
const sayLines = (key, fallback) => {
  if (SITE.off && SITE.off[key] === true) return [];
  const v = say(key, null);
  return v ? v.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean) : fallback;
};

/* An element, or nothing at all. A switched-off heading has to take its <h2>
   with it: an empty heading still occupies space, still reads as a heading to a
   screen reader, and still shows the section rule above it. Every heading,
   kicker and paragraph the shop can change goes through these, so "off" means
   gone rather than blank. */
const tag = (name, key, fallback, cls, style) => {
  const v = say(key, fallback);
  if (!v) return "";
  return `<${name}${cls ? ` class="${cls}"` : ""}${style ? ` style="${style}"` : ""}>${esc(v)}</${name}>`;
};
const kicker = (key, fallback) => tag("p", key, fallback, "kicker");
const head = (key, fallback) => tag("h2", key, fallback);
const para = (key, fallback, cls, style) => tag("p", key, fallback, cls, style);

/* A button whose label the shop can change, and which disappears when they
   empty it — a button with no words on it is worse than no button. */
const cta = (key, fallback, href, cls) => {
  const v = say(key, fallback);
  return v ? `<a class="${cls}" href="${esc(href)}">${esc(v)}</a>` : "";
};

/* Social marks, drawn rather than fetched. Every icon on this site is either a
   text glyph or CSS — there is not one image file used as an icon — and a
   remote icon font or sprite sheet would be a third-party request on a page
   that currently makes none. Simple single-path silhouettes, sized by the
   surrounding font, currentColor so they follow the link colour. */
const SOCIAL_ICON = {
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17.8 6a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
  facebook: "M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5h1.65V4.6A22 22 0 0 0 14.3 4.5c-2.4 0-4 1.45-4 4.13v2.28H7.6V14h2.7v8z",
  tiktok: "M16.5 2h-3v13.2a2.6 2.6 0 1 1-2-2.53V9.6a5.7 5.7 0 1 0 5 5.66V9.2a6.8 6.8 0 0 0 4 1.3V7.4a3.9 3.9 0 0 1-4-3.9z",
  whatsapp: "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 0 16 8 8 0 0 1-4.1-1.1l-.3-.2-2.5.7.7-2.4-.2-.3A8 8 0 0 1 12 4zm-3.4 4.2h.5c.1 0 .3 0 .5.4l.8 1.9v.5l-.3.5-.4.5c-.1.1-.2.2-.1.5a7.3 7.3 0 0 0 1.4 1.7 6.5 6.5 0 0 0 1.9 1.2c.2.1.4.1.5-.1l.8-1c.2-.2.4-.1.6-.1l1.7.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2-.2.6-1.1 1.2-1.6 1.2-.4.1-.9.2-3-.6-2.6-1-4.2-3.6-4.3-3.8-.1-.1-1-1.4-1-2.6s.7-1.7.9-2.1c.2-.4.5-.4.7-.4z",
  twitter: "M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1-5.8 6.1H1.5l7.5-8.6L1.2 3h6.6l4.5 5.6zm-1.1 16.2h1.8L7.7 4.7H5.8z",
};
const socialIcon = (id) => SOCIAL_ICON[id]
  ? `<svg class="si" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${SOCIAL_ICON[id]}"/></svg>`
  : "";

/* Which networks the shop is actually on. One list, read by the Visit us row
   and the footer alike, so a link changed in /admin changes in both. A network
   whose box has been emptied drops out rather than leaving a link to nowhere. */
const socialsInUse = () => SOCIALS
  .map((s) => ({ ...s, url: say("social" + s.id[0].toUpperCase() + s.id.slice(1), s.url) }))
  .filter((s) => s.url);

/* The Follow row on Visit us: mark and name, because there is room for both and
   the row is read rather than scanned. */
function socialRow() {
  const links = socialsInUse().map((s) =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener">${socialIcon(s.id)}${esc(s.name)}</a>`
  ).join("");
  return links
    ? `<div class="info-row"><span class="il">Follow</span><span class="socials">${links}</span></div>`
    : "";
}

/* The WhatsApp number, as a wa.me link, or "" when the shop has not given one
   — in which case nothing about WhatsApp appears anywhere on the site. wa.me
   wants digits in international form, so a number typed the way it is said
   ("07700 900123") is converted the same way the dial links are.

   A landline will not do: WhatsApp needs the number the account is on. */
const whatsappLink = () => {
  const raw = String(say("whatsapp", "")).replace(/[^\d+]/g, "");
  if (!raw) return "";
  const digits = raw.startsWith("+") ? raw.slice(1)
    : raw.startsWith("0") ? "44" + raw.slice(1)
    : raw;
  return digits.length < 10 ? "" : "https://wa.me/" + digits;
};

/* Wrap something in a <p> only if there is anything to wrap. Saves every
   caller from leaving an empty paragraph — and its margin — behind. */
const pWrap = (inner, style, cls) =>
  inner ? `<p${cls ? ` class="${cls}"` : ""}${style ? ` style="${style}"` : ""}>${inner}</p>` : "";

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
  /* The footer showed the address the site shipped with while the contact page
     showed the shop's — one address per site, please.

     Line by line, not textContent. The markup ships with a <br> in it and
     setting textContent flattened the address to one long line on every
     render, which is why nobody could get it onto four lines from /admin. */
  const foot = document.getElementById("footAddress");
  if (foot) {
    foot.innerHTML = addressLines(say("address", CONTACT.address))
      .map((line) => esc(line)).join("<br>");
  }
  const maps = say("mapsUrl", CONTACT.mapsUrl);
  if (foot && maps) foot.href = maps;

  const blurb = document.getElementById("footBlurb");
  if (blurb) blurb.textContent = say("footerBlurb", BUSINESS.blurbShort);

  /* The line under the wordmark. It was a literal in index.html and nothing
     patched it, so the shop could correct how old the business is everywhere
     except the one place it sits beside the name. */
  /* Marks only in the footer — a column of link text with four more words in it
     reads as more list, where a row of marks reads as "we are on these". Each
     one still carries its name for a screen reader. */
  const socials = document.getElementById("footSocials");
  if (socials) {
    socials.innerHTML = socialsInUse().map((s) =>
      `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.name)}"
          title="${esc(s.name)}">${socialIcon(s.id)}</a>`).join("");
  }

  /* The floating button. Lives outside the router's <main>, so it survives
     every page change and is rendered once rather than by each view. */
  const wa = whatsappLink();
  let float = document.getElementById("waFloat");
  if (wa && !float) {
    float = document.createElement("a");
    float.id = "waFloat";
    float.className = "wa-float";
    float.target = "_blank";
    float.rel = "noopener";
    float.setAttribute("aria-label", "Message us on WhatsApp");
    float.innerHTML = socialIcon("whatsapp") + '<span>WhatsApp</span>';
    document.body.appendChild(float);
  }
  if (float) {
    float.href = wa;
    float.hidden = !wa;
  }

  const mark = document.querySelector(".brand-mark small");
  if (mark) {
    const line = say("tagline", BUSINESS.tagline);
    mark.textContent = line;
    mark.hidden = !line;
  }
}

/* An address as the shop typed it. They can use real line breaks, or the
   commas that were there before — either way it comes out as lines. */
const addressLines = (s) =>
  String(s || "").split(/\n|,/).map((x) => x.trim()).filter(Boolean);

const rangePhoto = (r) => siteImage("range:" + r.id, r.photo);

/* The four claims across the top of the home page. Two boxes each in /admin:
   the bold phrase, then the rest of the line. */
const PROOF = [
  ["proof1", "32 years", "family run"],
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
        ${heart(sw.key)}<span class="zoom-favlabel">Save to my favourites</span>
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
      ${/* The mill's own range code (CC-AE, VC-UP) used to sit here beside the
            brand. It means nothing to a customer and reads like a fault on the
            page; it stays in the catalogue data, where the shop can still
            match a collection to a supplier's paperwork. */""}
      <span class="k">${esc(r.brand)}</span>
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

/* The four service cards. Each is two boxes in /admin, and a card whose title
   has been emptied drops out of the row rather than leaving a gap — which is
   how the shop removes one without needing us. */
const servicesGrid = () => {
  const cards = SERVICES.map((s, i) => {
    const n = "service" + (i + 1);
    const title = say(n + "Title", s.title);
    if (!title) return "";
    return `<div class="svc"><h3>${esc(title)}</h3>${para(n + "Body", s.body)}</div>`;
  }).filter(Boolean);
  return cards.length ? `<div class="grid cols-4">${cards.join("")}</div>` : "";
};

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
      ${/* No "Review us on Google" button. Asking for reviews on the page that
            is showing off the reviews you already have reads as fishing, and
            the shop asked for it gone. The listing link is still stored — the
            rating and star count are what it is for. */""}
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
let IG_PROFILE = null;   /* handle and counts, when Instagram will give them */

async function loadInstagram() {
  try {
    const res = await fetch("api/instagram", { headers: { accept: "application/json" } });
    if (!res.ok) return false;
    const body = await res.json();
    if (!body?.posts?.length) return false;
    IG_LIVE = body.posts;
    IG_PROFILE = body.profile || null;
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

  const tile = (p, i) => {
    const src = /^https?:\/\//.test(p.image) ? p.image : P(p.image);
    const cap = String(p.caption || "").trim();
    const inner = `<img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" onerror="this.remove()">`
      + (cap ? `<span class="ig-cap"><span>${esc(cap)}</span></span>` : "");
    const cls = "ig-tile" + (i === 0 ? " lead" : "");
    return p.link
      ? `<a class="${cls}" href="${esc(p.link)}" target="_blank" rel="noopener">${inner}</a>`
      : `<span class="${cls}">${inner}</span>`;
  };

  /* `g?.url`, not `g.url`. A live feed can arrive while the overlay fetch has
     failed, which leaves SITE.instagram undefined — and this line then threw
     inside the render and took the whole home page with it. */
  const url = g?.url || (IG_PROFILE ? "https://www.instagram.com/" + IG_PROFILE.username + "/" : "");
  const follow = url
    ? `<a class="btn btn-ghost btn-sm ig-follow" href="${esc(url)}" target="_blank" rel="noopener">
        ${socialIcon("instagram")}Follow us</a>`
    : "";

  /* The account itself, when Instagram will tell us. A follower count is the
     part that makes a feed read as a live account rather than a gallery. */
  const n = (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k"
    : String(v));
  const who = IG_PROFILE ? `
    <div class="ig-who">
      <b>@${esc(IG_PROFILE.username)}</b>
      ${IG_PROFILE.posts ? `<span>${n(IG_PROFILE.posts)} posts</span>` : ""}
      ${IG_PROFILE.followers ? `<span>${n(IG_PROFILE.followers)} followers</span>` : ""}
    </div>` : "";

  /* Nine, and the first one twice the size. Nine is not arbitrary: with the
     lead tile spanning two columns and two rows, nine fills the wall exactly at
     two, three and four columns, so no width leaves a hole or an orphan on a
     row of its own. Eight equal squares gave seven and a straggler. */
  return `
  <section class="sec-alt"><div class="wrap">
    <div class="section-head"><div><span class="rule"></span>
      ${kicker("instaKicker", "On Instagram")}${head("instaHeading", "Recent work")}
      ${para("instaText", HOME.instaText)}${who}</div>
      ${follow}</div>
    <div class="ig-wall">${posts.slice(0, 9).map(tile).join("")}</div>
  </div></section>`;
}

/* The banner pictures, in order, skipping any the shop has emptied. The words
   over the top never move — only the photograph behind them changes — so a
   visitor reading the headline is not chasing it around the screen. */
const HERO_SLOTS = [
  ["hero",  "Wool carpet in a family living room"],
  ["hero2", "Velvet pile carpet in a bay-window living room"],
  ["hero3", "Herringbone wood flooring in a kitchen"],
];
const heroSlides = () =>
  HERO_SLOTS
    .map(([slot, alt]) => [siteImage(slot, IMG[slot]), caption(slot, alt)])
    .filter(([src]) => Boolean(src));

function viewHome() {
  /* An optional line the shop can put across the top — a bank holiday, a
     delivery delay, a sale. Empty means no strip at all rather than an empty
     one, so leaving it blank is the normal state. */
  const notice = say("notice", "");
  const slides = heroSlides();
  return `
  ${notice ? `<div class="notice"><div class="wrap">${esc(notice)}</div></div>` : ""}
  <section class="hero">
    <div class="hero-slides" id="heroSlides">
      ${slides.map(([src, alt], i) =>
        `<div class="hero-slide${i === 0 ? " on" : ""}">${photo(src, alt, "16-9")}</div>`).join("")}
    </div>
    <div class="hero-scrim"></div>
    <div class="wrap">
      ${/* No shipped wording: the shop asked for this line gone, and an empty
             default is how "gone unless you want it" is said here — same as the
             notice strip above. Type something in /admin and it appears. */
        kicker("since", "")}
      ${tag("h1", "heroTitle", "The flooring shop on Hanworth Road.")}
      ${para("heroText", HOME.heroText)}
      <div class="hero-cta">
        ${cta("heroCta", "Make an enquiry", "#/enquire", "btn btn-yellow")}
        ${cta("heroCta2", "Explore our collections", "#/collections", "btn btn-ghost on-dark")}
      </div>
    </div>
    ${slides.length > 1 ? `<div class="hero-dots" id="heroDots"><div class="wrap">
      ${slides.map((_, i) =>
        `<button type="button" class="${i === 0 ? "on" : ""}"
           aria-label="Show banner picture ${i + 1} of ${slides.length}"
           aria-current="${i === 0}"></button>`).join("")}
    </div></div>` : ""}
  </section>

  <div class="proof"><div class="wrap">
    ${PROOF.map(([k, b, r]) => `<span><b>${esc(say(k + "Bold", b))}</b> ${esc(say(k, r))}</span>`).join("")}
  </div></div>


  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span>${head("typesHeading", "Every floor, one showroom")}
        ${para("typesText", HOME.typesText)}</div>
      ${VISUALISER_ON ? `<a class="arrow-link" href="#/visualiser">Try colours in a room →</a>` : ""}
    </div>
    <div class="cat-grid">${TYPES.map(typeTile).join("")}</div>
  </div></section>

  ${instagramGrid()}

  <section class="band"><div class="wrap">
    <div class="split flip">
      <div class="split-media">${photo(siteImage("fitting", IMG.fitting), caption("fitting", "A carpet fitter finishing an edge with a knee kicker"), "3-2")}</div>
      <div class="split-copy">
        <span class="rule on-dark"></span>
        ${kicker("serviceKicker", "How we work")}
        ${head("serviceHeading", "Supplied and installed, properly")}
        ${para("serviceText", HOME.serviceText, "lede")}
        ${pWrap(cta("serviceCta", "Discuss your project", "#/enquire", "btn btn-yellow"), "margin-top:24px")}
      </div>
    </div>
    <div style="margin-top:clamp(34px,5vw,60px)">${servicesGrid()}</div>
  </div></section>


  <section class="sec-alt"><div class="wrap">
    <div class="split">
      <div class="split-copy">
        <span class="rule"></span>${kicker("familyKicker", "Family-run for over 32 years")}
        ${/* Its own heading and paragraph. They used to be borrowed from the
              About page — the same two keys rendered twice — which meant this
              block had no boxes of its own on the Home page tab, and the shop
              reported the front page as un-editable because the only way to
              change it was on a tab about a different page. */
          head("familyHeading", HOME.familyHeading)}
        ${para("familyText", HOME.familyText, "lede", "margin-top:14px")}
        ${pWrap(cta("familyCta", "Discover our story →", "#/about", "btn btn-ghost"), "margin-top:22px")}
      </div>
      <div class="split-media">${photo(siteImage("stairs", IMG.stairs), caption("stairs", "Wool twist carpet fitted to a staircase and landing"), "3-2")}</div>
    </div>
  </div></section>

  ${reviewsStrip()}`;
}

/* ---------- collections: filterable by brand and colour family ---------- */
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

/* What a style is called, what it says, and which photograph it shows — all
   three editable, all three in one place so the tile, the style's own page and
   the admin cannot end up calling the same thing different names.

   The key carries the floor type as well as the style: "herringbone" exists
   under both Wood and LVT and they are not the same style. */
const styleRef = (typeId, st) => typeId + "-" + st.id;
const styleName = (typeId, st) => say("styleName-" + styleRef(typeId, st), st.name);
const styleBlurb = (typeId, st) => say("styleText-" + styleRef(typeId, st), st.blurb);
const styleSlot = (typeId, st) => "style-" + styleRef(typeId, st);

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
  const name = styleName(typeId, st);
  /* The borrowed photograph is only a fallback now. It is taken from the first
     collection under the style that has one, which is why a style whose
     collections have no photograph showed an empty frame and nothing in /admin
     could fill it — there was no slot to upload to. There is one now. */
  const pic = siteImage(styleSlot(typeId, st), photos[st.id]);
  return `<a class="style-tile" href="#/collections/${esc(typeId)}/${esc(st.id)}">
    <div class="style-ph">
      ${pic ? `<img src="${esc(pic)}" alt="${esc(caption(styleSlot(typeId, st), name))}"
        loading="lazy" onerror="this.remove()">` : ""}
      <span class="style-swatches">${st.list.flatMap((r) => r.colours).slice(0, 6)
        .map((x) => `<span style="background:${x.hex}"></span>`).join("")}</span>
    </div>
    <div class="style-cap">
      <h3>${esc(name)}</h3>
      <p>${esc(styleBlurb(typeId, st))}</p>
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
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/collections">Collections</a> /
    <a href="#/collections/${esc(typeId)}">${esc(type.name)}</a> / ${esc(styleName(typeId, st))}</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><p class="kicker">${esc(type.name)}</p>
        <h2>${esc(styleName(typeId, st))}</h2><p>${esc(styleBlurb(typeId, st))}</p></div>
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
        `<a class="chip" href="#/collections/${esc(typeId)}/${esc(s.id)}">${esc(styleName(typeId, s))}<span class="n">${styleCount(s)}</span></a>`).join("")}
        <a class="chip" href="#/collections/${esc(typeId)}">Every ${esc(type.name.toLowerCase())} shade</a></div>
    </div>` : ""}
  </div></section>`;
}

function viewCollections(typeId, styleId) {
  const type = typeId ? findType(typeId) : null;
  if (typeId && !type) return viewNotFound();
  if (type && styleId) return viewStyle(typeId, styleId);

  if (!type) {
    return `
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Collections</p></div>
    <section><div class="wrap">
      <!-- the saved keys stay "catalogue*": renaming them would throw away
           whatever the shop has already typed into those two boxes -->
      <div class="section-head"><div><span class="rule"></span>
        ${kicker("catalogueKicker", "Everything we supply")}
        ${head("catalogueHeading", "Our collections")}
        ${para("catalogueText", PAGES.catalogueText)}</div></div>
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
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/collections">Collections</a> / ${esc(type.name)}</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><h2>${esc(type.name)}</h2><p>${esc(say("type-" + type.id, type.blurb))}</p></div>
      ${VISUALISER_ON ? `<a class="btn btn-solid btn-sm" href="#/visualiser">See it in a room</a>` : ""}
    </div>

    ${styles.length ? `<div class="styles">
      ${/* One box per floor type, so "What sort of carpets are you after?" can be
            reworded or switched off on the Carpets page without touching LVT. */
        tag("h3", "styleHead-" + type.id,
            `What sort of ${type.name.toLowerCase()} are you after?`, "styles-head")}
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
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/collections">Collections</a> /
    <a href="${type ? type.route : "#/collections"}">${esc(type ? type.name : r.type)}</a> / ${esc(r.name)}</p></div>
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
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / My Favourites</p></div>
    <section><div class="wrap">
      <span class="rule"></span><p class="kicker">Nothing saved yet</p>
      <h2>Your shortlist is empty</h2>
      <p class="lede" style="margin-top:14px;max-width:56ch">Tap the ♥ on any colour and it lands here.
        The list stays on this device, so you can close the tab and pick up where you left off.</p>
      <p style="margin-top:24px"><a class="btn btn-solid" href="#/collections">Browse collections</a></p>
    </div></section>`;
  }

  const byType = {};
  for (const f of FAVS) (byType[f.type] = byType[f.type] || []).push(f);

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / My Favourites</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><p class="kicker">${FAVS.length} shade${FAVS.length === 1 ? "" : "s"} saved</p>
        <h2>My Favourites</h2>
        <p>Saved on this device. Send yourself the link to open it on another one, or bring it
           into the showroom and we'll get those books out.</p></div>
      <div class="fav-actions">
        <button class="btn btn-ghost btn-sm" id="favShare">Copy link to my favourites</button>
        <a class="btn btn-solid btn-sm" href="#/enquire" id="favEnquire">Ask us about these</a>
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
      <button class="linkish" id="favClear">Clear my favourites</button>
    </p>
  </div></section>`;
}

function viewAbout() {
  /* The heading used to sit alone in one column of a split with the photograph
     in the other, and every paragraph below both — so a two-line heading beside
     a tall photograph left a hole the height of the picture before the text
     started. The opening paragraphs come up into the column with the heading
     now, and only what does not fit runs on underneath. */
  const paras = sayLines("aboutBody", ABOUT.body);
  const beside = paras.slice(0, 2), below = paras.slice(2);
  const para_ = (t) => `<p>${esc(t)}</p>`;
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / About us</p></div>
  <section><div class="wrap">
    <div class="split split-top">
      <div class="split-copy"><span class="rule"></span>
        ${/* one key for the whole line. It used to be the literal "Family run ·
              Hounslow · " with say("since") stuck on the end, and since's own
              default starts "Hounslow ·" — so the page read "Family run ·
              Hounslow · Hounslow · Over 30 years". */
          kicker("aboutKicker", ABOUT.kicker)}
        ${head("aboutLead", ABOUT.lead)}
        <div class="prose">${beside.map(para_).join("")}</div></div>
      ${/* Its own slot. It shared "showroom" with the Visit us page, so changing
            one changed the other; it ships with the same photograph, which is
            why nothing looks different until somebody uploads one. */""}
      <div class="split-media">${photo(siteImage("about", IMG.about),
        caption("about", "Inside the Hari's Carpets showroom"), "3-2")}</div>
    </div>
    ${below.length ? `<div class="prose" style="margin-top:clamp(24px,3vw,40px)">${
      below.map(para_).join("")}</div>` : ""}
  </div></section>`;
}

function viewContact() {
  const map = say("mapEmbed", CONTACT.mapEmbed);
  const maps = say("mapsUrl", CONTACT.mapsUrl);
  const lede = say("visitText", PAGES.visitText);
  /* The area covered used to be glued onto the end of that sentence. It read as
     part of the paragraph, so switching it off in /admin looked like it had done
     nothing to the words the shop was actually pointing at, and there was no
     wording anywhere that said which box those words came from. As its own
     labelled line it is plainly one thing, and the switch plainly removes it. */
  const area = say("area", CONTACT.area);
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visit us</p></div>
  <section><div class="wrap">
    <div class="contact-grid">
      <div>
        <span class="rule"></span>
        ${kicker("visitKicker", "Come in, or we'll come to you")}
        ${head("visitHeading", "Visit Our Showroom")}
        ${pWrap(lede ? esc(lede) : "", "margin-top:14px", "lede")}
        <div style="margin-top:24px">
          <div class="info-row"><span class="il">Showroom</span><span><a href="${esc(maps)}" target="_blank" rel="noopener">${
            addressLines(say("address", CONTACT.address)).map(esc).join("<br>")}</a></span></div>
          <div class="info-row"><span class="il">Phone</span><span><a href="${telHref(say("phone", CONTACT.phone))}">${esc(say("phone", CONTACT.phone))}</a></span></div>
          <div class="info-row"><span class="il">Email</span><span><a href="mailto:${esc(say("email", CONTACT.email))}">${esc(say("email", CONTACT.email))}</a></span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(say("hours", CONTACT.hours))}</span></div>
          ${area ? `<div class="info-row"><span class="il">We cover</span><span>${esc(area)}</span></div>` : ""}
          ${socialRow()}
        </div>
        ${pWrap(cta("visitCta", "Send an enquiry", "#/enquire", "btn btn-solid"), "margin-top:26px")}
      </div>
      <div>
        ${photo(siteImage("showroom", IMG.showroom), caption("showroom", "Inside the Hari's Carpets showroom"), "3-2")}
      </div>
    </div>
  </div></section>

  ${map ? `<section class="sec-alt"><div class="wrap">
    <div class="section-head"><div><span class="rule"></span>${head("mapHeading", "Find us")}
      ${para("mapText", "Two minutes from Hounslow West, with parking on Hanworth Road.")}</div>
      ${maps ? `<a class="btn btn-ghost btn-sm" href="${esc(maps)}" target="_blank" rel="noopener">Open in Google Maps</a>` : ""}</div>
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
        ${kicker("enquireKicker", "No pressure, no obligation")}
        ${head("enquireHeading", "Get in Touch")}
        ${para("enquireText", PAGES.enquireText, "lede", "margin-top:14px")}
        <div style="margin-top:26px">
          <div class="info-row"><span class="il">Call</span><span><a href="${telHref(say("phone", CONTACT.phone))}">${esc(say("phone", CONTACT.phone))}</a></span></div>
          <div class="info-row"><span class="il">Email</span><span><a href="mailto:${esc(say("email", CONTACT.email))}">${esc(say("email", CONTACT.email))}</a></span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(say("hours", CONTACT.hours))}</span></div>
        </div>
        <p style="margin-top:24px"><a class="arrow-link" href="#/contact">Or visit the showroom →</a></p>
      </div>
      <div><div class="form-card">
        <h3 style="margin-bottom:10px">${esc(say("formHeading", "Submit an enquiry"))}</h3>
        <form id="enquiry" novalidate>
          <div class="field"><label for="n">Name</label><input id="n" name="name" autocomplete="name" required></div>
          <div class="field"><label for="e">Email</label><input id="e" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="p">Phone</label><input id="p" name="phone" autocomplete="tel"></div>
          <div class="field"><label for="w">What can we help with?</label>
            <select id="w" name="topic">
              ${SAMPLES_ON ? "<option>Request carpet samples</option>" : ""}
              ${TYPES.map((t) => `<option>${esc(t.name)}</option>`).join("")}
              <option>Something else</option>
            </select></div>
          <div class="field"><label for="m">Message</label><textarea id="m" name="message" rows="4"></textarea></div>
          ${/* The honeypot. Named like a real field so a form-filling bot fills
                it in, hidden in CSS rather than with type=hidden, which bots
                know to skip. A submission that has touched it is answered with
                a cheerful 200 and thrown away — an error would only teach the
                bot what to correct. */""}
          <div class="hp" aria-hidden="true">
            <label for="website">Website</label>
            <input id="website" name="website" type="text" tabindex="-1" autocomplete="off">
          </div>
          <button class="btn btn-solid" type="submit" style="width:100%;justify-content:center"
                  id="enquirySend">${esc(say("formCta", "Send enquiry"))}</button>
          <p class="form-note" id="enquiryNote" role="status"></p>
        </form>
      </div></div>
    </div>
  </div></section>`;
}

/* Jobs the shop has finished, in their own words and their own photographs.
   Everything here comes from /admin — there is nothing shipped with the site to
   fall back on, because a portfolio of stock photography is worse than no
   portfolio. Until the shop adds one, the page says so plainly. */
function viewPortfolio() {
  const items = (SITE.portfolio || []).filter((p) => p && p.image);
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Portfolio</p></div>
  <section><div class="wrap">
    <div class="section-head"><div><span class="rule"></span>
      ${kicker("portfolioKicker", "Our work")}
      ${head("portfolioHeading", "Recently installed")}
      ${para("portfolioText", PAGES.portfolioText)}</div>
      ${pWrap(cta("portfolioCta", "Discuss your project", "#/enquire", "btn btn-solid btn-sm"))}</div>
    ${items.length ? `<div class="folio">${items.map((p) => `
      <figure class="folio-item">
        ${photo(P(p.image), p.caption || p.title || "A floor installed by Hari's Carpets", "4-3")}
        ${p.title || p.caption ? `<figcaption>
          ${p.title ? `<h3>${esc(p.title)}</h3>` : ""}
          ${p.caption ? `<p>${esc(p.caption)}</p>` : ""}
        </figcaption>` : ""}
      </figure>`).join("")}</div>`
    : `<p class="empty-note">We're putting this gallery together — in the meantime,
         pop into the showroom and we'll show you what we've been installing.</p>`}
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
    case undefined:      html = viewHome(); break;
    case "collections":  html = viewCollections(parts[1], parts[2]); break;
    /* "Catalogue" is what the trade calls it; a customer looking for a carpet
       is looking for a collection. The old path still resolves so anything
       already printed, linked or bookmarked lands on the right page. */
    case "catalogue":    location.replace("#/collections" + parts.slice(1).map((p) => "/" + p).join("")); return;
    case "portfolio":    html = viewPortfolio(); break;
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
  /* The form moved to its own page; this still said "contact", so the enquiry
     form rendered but nothing was listening to it. */
  if (top === "enquire") wireEnquiry();
  if (top === undefined) mountHero();
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

  /* When the form was put on screen. The server refuses anything submitted
     inside three seconds of it. */
  const opened = Date.now();
  const note = $("#enquiryNote");
  const send = $("#enquirySend");
  const label = send ? send.textContent : "Send enquiry";
  const said = (text, bad) => {
    if (!note) return;
    note.textContent = text;
    note.className = "form-note" + (bad ? " bad" : "");
  };

  /* Somewhere else to go when we cannot take the message ourselves. Their own
     mail client is a completely separate path from our sending provider, which
     is the thing that has just failed. */
  const mailtoFallback = (v) => {
    const to = say("email", CONTACT.email);
    const body = [`Name: ${v.name}`, v.phone ? `Phone: ${v.phone}` : "", "", v.message]
      .filter(Boolean).join("\n");
    const href = `mailto:${to}?subject=${encodeURIComponent("Website enquiry — " + (v.topic || ""))
      }&body=${encodeURIComponent(body)}`;
    return ` <a href="${esc(href)}">Open it in your email app</a>, or ring us on `
      + `<a href="${telHref(say("phone", CONTACT.phone))}">${esc(say("phone", CONTACT.phone))}</a>.`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    /* new FormData, not f.name — on a form element, `.name` resolves to the
       input called "name" and shadows the element's own property. */
    const data = Object.fromEntries(new FormData(form).entries());

    if (!data.name || !data.email) {
      said("Please add your name and email.", true);
      form.querySelector(data.name ? "#e" : "#n")?.focus();
      return;
    }

    if (send) { send.disabled = true; send.textContent = "Sending…"; }
    said("");

    let body = null, ok = false;
    try {
      const res = await fetch("api/enquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, t: opened, page: location.hash || "#/enquire" }),
      });
      body = await res.json().catch(() => null);
      ok = res.ok && body && body.ok;
    } catch { /* offline, or the request never landed */ }

    if (ok) {
      form.innerHTML = `<h3 style="margin-bottom:8px">Thanks — we'll be in touch.</h3>
        <p class="desc">${esc(say("formThanks",
          "We've got your message. We usually come back the same day, or the next working day."))}</p>`;
      return;
    }

    /* Everything typed stays exactly where it is: whatever went wrong, making
       somebody retype it would be the second thing to go wrong. */
    if (send) { send.disabled = false; send.textContent = label; }
    if (body && body.field) form.querySelector(body.field === "email" ? "#e" : "#n")?.focus();
    const message = (body && body.error) || "We couldn't send that just now.";
    if (!body || body.fallback || !body.field) {
      note.innerHTML = esc(message) + mailtoFallback(data);
      note.className = "form-note bad";
    } else {
      said(message, true);
    }
  });
}

/* ---------- the banner carousel ----------
   One photograph is the normal state, not a special case: with a single slide
   there are no dots, no timer and nothing to go wrong, and the banner behaves
   exactly as it did before. The first slide is marked `on` in the markup, so
   if this never runs the banner is still a picture rather than a black box. */
let heroTimer;
function mountHero() {
  clearInterval(heroTimer);
  const box = document.getElementById("heroSlides");
  const slides = box ? [...box.children] : [];
  if (slides.length < 2) return;

  const dots = [...document.querySelectorAll("#heroDots button")];
  let at = 0;
  const show = (n) => {
    at = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle("on", i === at));
    dots.forEach((d, i) => { d.classList.toggle("on", i === at); d.setAttribute("aria-current", i === at); });
  };
  dots.forEach((d, i) => d.addEventListener("click", () => { show(i); start(); }));

  /* Somebody who has asked for reduced motion gets the first picture and the
     dots, and moves through them by hand. Nothing advances on its own — the
     check lives inside start() so no later call can restart the timer. */
  const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start() {
    clearInterval(heroTimer);
    if (!wantsMotion) return;
    /* A background tab would otherwise burn through the whole set unseen and
       come back somewhere arbitrary. */
    heroTimer = setInterval(() => { if (!document.hidden) show(at + 1); }, 6000);
  }
  const hero = box.closest(".hero");
  hero.addEventListener("pointerenter", () => clearInterval(heroTimer));
  hero.addEventListener("pointerleave", start);
  hero.addEventListener("focusin", () => clearInterval(heroTimer));
  hero.addEventListener("focusout", start);
  start();
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
      () => { e.target.textContent = "Link copied ✓"; setTimeout(() => { e.target.textContent = "Copy link to my favourites"; }, 2200); },
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
/* Cloudflare Web Analytics, and only when a token has been set — see ANALYTICS
   in data.js. Injected rather than written into index.html so that "no token,
   no third-party request at all" is the default, and so the one place that
   decides whether this site talks to anybody else is a single empty string. */
function mountAnalytics() {
  const token = typeof ANALYTICS !== "undefined" && ANALYTICS.token;
  if (!token) return;
  const beacon = document.createElement("script");
  beacon.defer = true;
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(beacon);
}

window.addEventListener("DOMContentLoaded", () => {
  mountAnalytics();
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
