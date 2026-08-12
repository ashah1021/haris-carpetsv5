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

const findRange = (id) => CATALOGUE.find((r) => r.id === id);
const findType = (id) => TYPES.find((t) => t.id === id);
const rangesOfType = (type) => CATALOGUE.filter((r) => r.type === type);
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
  for (const range of CATALOGUE) {
    if (typeId && range.type !== typeId) continue;
    for (const col of range.colours) {
      out.push({
        /* keyed on the colour name, not the generated code: codes are renumbered
           whenever the catalogue is rebuilt, which would break saved lists and
           every shared link. */
        key: range.id + ":" + slugify(col.name),
        name: col.name, code: col.code, hex: col.hex,
        rangeId: range.id, range: range.name, brand: range.brand, type: range.type,
        family: colourFamily(col.hex), room: col.room,
        /* false on the two placeholder ranges, which have no photographed
           chips. Without this the tiles request swatch jpgs that were never
           taken — a dozen 404s per page load for an image that can't exist. */
        shot: range.real !== false,
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
function photo(src, alt, ratio = "4-3", cls = "") {
  const label = esc(alt || "Photograph");
  return `<div class="ph r-${ratio} ${cls}" data-ph="${label}">
    <img src="${esc(src)}" alt="${label}" loading="lazy" onerror="this.remove()">
  </div>`;
}

/* Must match slug() in tools/emit-catalogue.py — these build the paths that
   script uploaded to, so the two have to agree exactly. */
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const swatchImg = (sw) => P("swatches/" + sw.rangeId + "/" + slugify(sw.name) + ".jpg");
const roomImg = (sw) => P("roomsets/" + sw.rangeId + "/" + slugify(sw.name) + ".jpg");

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
      ${sw.shot ? `<img src="${swatchImg(sw)}" alt="${esc(sw.name)} — ${esc(sw.range)}" loading="lazy" onerror="this.remove()">` : ""}
      ${sw.room ? `<span class="pin" title="Photographed in a room">Room</span>` : ""}
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
        ${sw.shot ? `<img src="${swatchImg(sw)}" alt="${esc(sw.name)}" onerror="this.remove()">` : ""}
      </div>
      ${sw.room ? `<div class="zoom-room"><img src="${roomImg(sw)}" alt="${esc(sw.name)} in a room" onerror="this.closest('.zoom-room').remove()">
        <span class="zoom-cap">${esc(sw.name)} photographed in a room</span></div>` : ""}
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
    ${photo(r.photo, r.alt || `${r.name} flooring`, "4-3")}
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
    ${photo(t.photo, t.alt || t.name, lead ? "16-9" : "4-3")}
    <div class="cat-cap"><h3>${esc(t.name)}</h3><p>${esc(t.blurb)}</p>
      <span class="go">View ${esc(t.name)}</span></div></a>`;
}

const servicesGrid = () =>
  `<div class="grid cols-4">${SERVICES.map((s) => `<div class="svc"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join("")}</div>`;

/* =========================================================================
   VIEWS
   ========================================================================= */
function viewHome() {
  const featured = FEATURED.map(findRange).filter(Boolean).map(rangeCard).join("");
  return `
  <section class="hero">
    ${photo(IMG.hero, "Wool carpet in a family living room", "16-9")}
    <div class="hero-scrim"></div>
    <div class="wrap">
      <p class="kicker">${esc(BUSINESS.since)}</p>
      <h1>The flooring shop on Hanworth Road.</h1>
      <p>Family-run since the nineties. Carpets, wood, LVT, vinyl and rugs — supplied
         and fitted by our own team, right across London and the Home Counties.</p>
      <div class="hero-cta">
        <a class="btn btn-yellow" href="#/contact">Book a free measure</a>
        <a class="btn btn-ghost on-dark" href="#/catalogue">Browse the catalogue</a>
      </div>
    </div>
  </section>

  <div class="proof"><div class="wrap">
    <span><b>30+ years</b> family run</span>
    <span><b>Our own fitters</b> — not subcontractors</span>
    <span><b>Free</b> home measure &amp; plan</span>
    <span><b>Old flooring</b> lifted &amp; taken away</span>
  </div></div>

  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><h2>Every floor, one showroom</h2>
        <p>Wool carpet, engineered wood, laminate, LVT, sheet vinyl and rugs — all under
           one roof on Hanworth Road, and all fitted by us.</p></div>
      ${VISUALISER_ON ? `<a class="arrow-link" href="#/visualiser">Try colours in a room →</a>` : ""}
    </div>
    <div class="cat-grid">${TYPES.map(typeTile).join("")}</div>
  </div></section>

  <section class="sec-alt"><div class="wrap">
    <div class="split">
      <div class="split-media stack">
        ${photo(IMG.showroom, "Inside the Hari's Carpets showroom in Hounslow", "3-2")}
        <div class="inset">${photo(IMG.samples, "Carpet sample swatches on the showroom counter", "1-1")}</div>
      </div>
      <div class="split-copy">
        <span class="rule"></span>
        <p class="kicker">Come and see it in daylight</p>
        <h2>A screen won't tell you how it feels underfoot</h2>
        <p class="lede">Colour shifts under different light, and pile you love in a photograph can
           feel wrong the moment you stand on it. That's what the showroom is for.</p>
        <p>Save the shades you like as you browse and bring the list in — we'll pull those
           books out and you won't have to start again.</p>
        <p style="margin-top:22px"><a class="arrow-link" href="#/contact">Find us &amp; opening hours →</a></p>
      </div>
    </div>
  </div></section>

  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><h2>Carpets we're fitting a lot of</h2>
        <p>Wool-rich ranges from British mills, picked because they wear well in real houses.</p></div>
      <a class="arrow-link" href="#/catalogue/carpets">All carpets →</a>
    </div>
    <div class="grid cols-3">${featured}</div>
  </div></section>

  <section class="band"><div class="wrap">
    <div class="split flip">
      <div class="split-media">${photo(IMG.fitting, "A carpet fitter finishing an edge with a knee kicker", "3-2")}</div>
      <div class="split-copy">
        <span class="rule on-dark"></span>
        <p class="kicker">How we work</p>
        <h2>Supplied and fitted, properly</h2>
        <p class="lede">The same team measures the job and comes back to fit it. Nothing gets
           handed to a subcontractor who's never seen your house.</p>
        <p style="margin-top:24px"><a class="btn btn-yellow" href="#/contact">Book a free measure</a></p>
      </div>
    </div>
    <div style="margin-top:clamp(34px,5vw,60px)">${servicesGrid()}</div>
  </div></section>

  <section><div class="wrap">
    <div class="section-head"><div><span class="rule"></span><h2>Recently fitted</h2>
      <p>Stairs, bedrooms, living rooms — a few of the floors we've put down around west London.</p></div></div>
    <div class="strip">${GALLERY.map((g) => photo(g.src, g.alt, "3-4")).join("")}</div>
  </div></section>

  <section class="sec-alt"><div class="wrap">
    <div class="split">
      <div class="split-copy">
        <span class="rule"></span><p class="kicker">Family run, Hounslow</p>
        <h2>${esc(ABOUT.lead)}</h2>
        <p class="lede" style="margin-top:14px">${esc(ABOUT.body[0])}</p>
        <p style="margin-top:22px"><a class="btn btn-ghost" href="#/about">More about us</a></p>
      </div>
      <div class="split-media">${photo(IMG.stairs, "Wool twist carpet fitted to a staircase and landing", "3-2")}</div>
    </div>
  </div></section>`;
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

function viewCatalogue(typeId) {
  const type = typeId ? findType(typeId) : null;
  if (typeId && !type) return viewNotFound();

  if (!type) {
    return `
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Catalogue</p></div>
    <section><div class="wrap">
      <div class="section-head"><div><span class="rule"></span><p class="kicker">Everything we supply</p>
        <h2>The catalogue</h2>
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
      <div><span class="rule"></span><h2>${esc(type.name)}</h2><p>${esc(type.blurb)}</p></div>
      ${VISUALISER_ON ? `<a class="btn btn-solid btn-sm" href="#/visualiser">See it in a room</a>` : ""}
    </div>

    <div class="filters">
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
  const swatches = r.colours.map((col) => ({
    key: r.id + ":" + slugify(col.name), name: col.name, code: col.code, hex: col.hex,
    rangeId: r.id, range: r.name, brand: r.brand, type: r.type,
    family: colourFamily(col.hex), room: col.room,
  }));

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/catalogue">Catalogue</a> /
    <a href="${type ? type.route : "#/catalogue"}">${esc(type ? type.name : r.type)}</a> / ${esc(r.name)}</p></div>
  <section><div class="wrap">
    <div class="range-hero">
      ${photo(r.photo, r.alt || `${r.name} flooring`, "4-3")}
      <div><span class="rule"></span><h1>${esc(r.name)}</h1><p class="lede">${esc(r.blurb)}</p>
        <ul class="spec">${spec.map(([k, v]) => `<li><div><span class="sl">${esc(k)}</span>${esc(v)}</div></li>`).join("")}</ul>
        <p style="margin-top:26px">${VISUALISER_ON
          ? `<a class="btn btn-solid" href="#/visualiser/${esc(r.id)}">See this range in a room</a>`
          : `<a class="btn btn-solid" href="#/contact">Ask us about this range</a>`}</p></div>
    </div>
  </div></section>
  <section class="sec-alt"><div class="wrap">
    <div class="colours-head"><div><span class="rule"></span>
      <p class="kicker">${r.colours.length} shades</p><h2>Colours</h2></div>
      <span class="hint">Tap a shade to see it close up. Tap ♥ to save it — kept on this device, nothing is sent.</span></div>
    <div class="swatch-grid">${swatches.map((s) => swatchTile(s, { showRange: false })).join("")}</div>
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
        <p class="kicker">Family run · Hounslow · ${esc(BUSINESS.since)}</p>
        <h2>${esc(ABOUT.lead)}</h2></div>
      <div class="split-media">${photo(IMG.showroom, "Inside the Hari's Carpets showroom", "3-2")}</div>
    </div>
    <div class="prose" style="margin-top:clamp(30px,4vw,52px)">${ABOUT.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  </div></section>
  <section class="band"><div class="wrap">
    <div class="section-head"><div><span class="rule on-dark"></span><p class="kicker">Our service</p><h2>What you get</h2></div></div>
    ${servicesGrid()}
    <div style="margin-top:30px"><a class="btn btn-yellow" href="#/contact">Book a free measure</a></div>
  </div></section>`;
}

function viewContact() {
  const socials = SOCIALS.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("");
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visit us</p></div>
  <section><div class="wrap">
    <div class="contact-grid">
      <div>
        <span class="rule"></span>
        <p class="kicker">Come in, or we'll come to you</p><h2>Visit the showroom</h2>
        <p class="lede" style="margin-top:14px">Pop into the Hounslow showroom, or book a free home measure and we'll come to you across ${esc(CONTACT.area)}.</p>
        <div style="margin-top:24px">
          <div class="info-row"><span class="il">Showroom</span><span><a href="${CONTACT.mapsUrl}" target="_blank" rel="noopener">${esc(CONTACT.address)}</a></span></div>
          <div class="info-row"><span class="il">Phone</span><span><a href="${CONTACT.phoneHref}">${esc(CONTACT.phone)}</a></span></div>
          <div class="info-row"><span class="il">Email</span><span><a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(CONTACT.hours)}</span></div>
          <div class="info-row"><span class="il">Follow</span><span class="socials">${socials}</span></div>
        </div>
        <div style="margin-top:28px">${photo(IMG.showroom, "Inside the Hari's Carpets showroom", "3-2")}</div>
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
    case "catalogue":  html = viewCatalogue(parts[1]); break;
    case "range":      html = viewRange(parts[1]); break;
    case "favourites": html = viewFavourites(parts[1]); break;
    case "visualiser": html = VISUALISER_ON ? window.Visualiser.view(parts[1]) : viewNotFound(); break;
    case "about":      html = viewAbout(); break;
    case "contact":    html = viewContact(); break;
    default:           html = viewNotFound();
  }
  app().innerHTML = html;

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
});
