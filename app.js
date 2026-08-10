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
  if (l <= 0.18) return "Charcoal & Black";
  /* near-neutral: split by lightness rather than hue, which is meaningless here */
  if (s < 0.08) return l >= 0.85 ? "Cream & White" : l >= 0.30 ? "Grey" : "Charcoal & Black";
  if (h >= 60 && h < 170) return "Green";
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
        key: range.id + ":" + col.code,
        name: col.name, code: col.code, hex: col.hex,
        rangeId: range.id, range: range.name, brand: range.brand, type: range.type,
        family: colourFamily(col.hex),
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

const heart = (key) => `<button class="fav${isFav(key) ? " on" : ""}" data-fav="${esc(key)}"
  aria-pressed="${isFav(key)}" title="${isFav(key) ? "Saved — click to remove" : "Save this shade"}"
  aria-label="Save this shade">♥</button>`;

/* one colour tile, used on catalogue, range and favourites pages */
function swatchTile(sw, opts = {}) {
  return `<div class="swatch">
    ${heart(sw.key)}
    <a class="col" style="background:${sw.hex}" href="#/range/${esc(sw.rangeId)}"
       aria-label="${esc(sw.name)} — ${esc(sw.range)}"></a>
    <span class="meta">
      <span class="cn">${esc(sw.name)}</span>
      <span class="cc">${esc(sw.code)}</span>
      ${opts.showRange === false ? "" : `<span class="cr">${esc(sw.brand)} · ${esc(sw.range)}</span>`}
    </span>
  </div>`;
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
      <a class="arrow-link" href="#/visualiser">Try colours in a room →</a>
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
const CAT = { view: "ranges", brand: "", family: "" };

function viewCatalogue(typeId) {
  const type = typeId ? findType(typeId) : null;
  if (typeId && !type) return viewNotFound();

  if (!type) {
    return `
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Catalogue</p></div>
    <section><div class="wrap">
      <div class="section-head"><div><span class="rule"></span><p class="kicker">Everything we supply</p>
        <h2>The catalogue</h2>
        <p>Every floor we stock, by type. Browse by range or straight by colour, and save
           anything you like to your list as you go.</p></div></div>
      <div class="cat-grid">${TYPES.map(typeTile).join("")}</div>
    </div></section>`;
  }

  const ranges = rangesOfType(type.id);
  const brands = [...new Set(ranges.map((r) => r.brand))].sort();
  let swatches = allSwatches(type.id);
  const familiesPresent = FAMILIES.filter((f) => swatches.some((s) => s.family === f));

  if (CAT.brand) swatches = swatches.filter((s) => s.brand === CAT.brand);
  if (CAT.family) swatches = swatches.filter((s) => s.family === CAT.family);
  const shown = CAT.brand ? ranges.filter((r) => r.brand === CAT.brand) : ranges;

  const chip = (label, active, attr, val) =>
    `<button class="chip${active ? " on" : ""}" data-${attr}="${esc(val)}">${esc(label)}</button>`;

  const body = CAT.view === "colours" || CAT.family
    ? (swatches.length
        ? `<div class="swatch-grid">${swatches.map((s) => swatchTile(s)).join("")}</div>`
        : `<p class="empty-note">No colours match those filters.</p>`)
    : (shown.length
        ? `<div class="grid cols-3">${shown.map(rangeCard).join("")}</div>`
        : `<p class="empty-note">No ranges match those filters.</p>`);

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/catalogue">Catalogue</a> / ${esc(type.name)}</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><p class="kicker">${ranges.length} range${ranges.length === 1 ? "" : "s"} · ${allSwatches(type.id).length} colours</p>
        <h2>${esc(type.name)}</h2><p>${esc(type.blurb)}</p></div>
      <a class="btn btn-solid btn-sm" href="#/visualiser">See it in a room</a>
    </div>

    <div class="filters">
      <div class="filter-row">
        <span class="filter-label">Type</span>
        <div class="chips">${TYPES.map((t) =>
          `<a class="chip${t.id === type.id ? " on" : ""}" href="${t.route}">${esc(t.name)}</a>`).join("")}</div>
      </div>
      <div class="filter-row">
        <span class="filter-label">Brand</span>
        <div class="chips">${chip("All", !CAT.brand, "brand", "")}${brands.map((b) => chip(b, CAT.brand === b, "brand", b)).join("")}</div>
      </div>
      <div class="filter-row">
        <span class="filter-label">Colour</span>
        <div class="chips">${chip("All", !CAT.family, "family", "")}${familiesPresent.map((f) =>
          `<button class="chip swatch-chip${CAT.family === f ? " on" : ""}" data-family="${esc(f)}">
             <i style="background:${familySample(f, type.id)}"></i>${esc(f)}</button>`).join("")}</div>
      </div>
      <div class="filter-row">
        <span class="filter-label">Show</span>
        <div class="chips">
          ${chip("Ranges", CAT.view === "ranges" && !CAT.family, "view", "ranges")}
          ${chip("Every colour", CAT.view === "colours" || !!CAT.family, "view", "colours")}
        </div>
      </div>
    </div>

    ${body}
  </div></section>`;
}

/* a representative hex for a family chip, taken from what's actually in stock */
function familySample(family, typeId) {
  const s = allSwatches(typeId).find((x) => x.family === family);
  return s ? s.hex : "#ccc";
}

function viewRange(id) {
  const r = findRange(id);
  if (!r) return viewNotFound();
  const type = findType(r.type);
  const spec = r.spec ? [["Brand", r.brand], ["Range code", r.code], ["Fibre", r.spec.fibre],
                        ["Pile", r.spec.pile], ["Widths", r.spec.widths], ["Suitability", r.spec.use]]
                      : [["Brand", r.brand], ["Range code", r.code]];
  const swatches = r.colours.map((col) => ({
    key: r.id + ":" + col.code, name: col.name, code: col.code, hex: col.hex,
    rangeId: r.id, range: r.name, brand: r.brand, type: r.type, family: colourFamily(col.hex),
  }));

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/catalogue">Catalogue</a> /
    <a href="${type ? type.route : "#/catalogue"}">${esc(type ? type.name : r.type)}</a> / ${esc(r.name)}</p></div>
  <section><div class="wrap">
    <div class="range-hero">
      ${photo(r.photo, r.alt || `${r.name} flooring`, "4-3")}
      <div><span class="rule"></span><h1>${esc(r.name)}</h1><p class="lede">${esc(r.blurb)}</p>
        <ul class="spec">${spec.map(([k, v]) => `<li><div><span class="sl">${esc(k)}</span>${esc(v)}</div></li>`).join("")}</ul>
        <p style="margin-top:26px">
          <a class="btn btn-solid" href="#/visualiser/${esc(r.id)}">See this range in a room</a></p></div>
    </div>
  </div></section>
  <section class="sec-alt"><div class="wrap">
    <div class="colours-head"><div><span class="rule"></span>
      <p class="kicker">${r.colours.length} shades</p><h2>Colours</h2></div>
      <span class="hint">Tap ♥ to save a shade to your list — it's kept on this device, nothing is sent.</span></div>
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

/* =========================================================================
   VISUALISER
   Recolours the floor of a roomset while keeping the photograph's own
   lighting: each pixel's luminance is measured against the mean luminance of
   the floor and the chosen colour scaled by that ratio, so a shadow stays a
   shadow and the pile texture survives. A flat fill reads as a sticker.
   ========================================================================= */
const VIS = { type: null, room: null, colour: null, cache: {}, busy: false, dead: {} };

const visRoom = (id) => VIS_ROOMS.find((r) => r.id === id);
const visRoomsFor = (type) => (type.rooms || []).map(visRoom).filter((r) => r && !VIS.dead[r.id]);

/* palette comes straight from the catalogue, grouped by range */
const visPalette = (type) =>
  rangesOfType(type.id).map((r) => ({ label: `${r.brand} · ${r.name}`, rangeId: r.id, colours: r.colours }));

const visFlat = (type) => visPalette(type).flatMap((g) =>
  g.colours.map((c) => ({ ...c, rangeId: g.rangeId })));

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("could not load " + src));
    im.src = src;
  });
}

async function visPrepare(room) {
  if (VIS.cache[room.id]) return VIS.cache[room.id];
  const [photoImg, maskImg] = await Promise.all([loadImage(room.photo), loadImage(room.mask)]);
  const w = Math.min(1400, photoImg.naturalWidth);
  const h = Math.round((photoImg.naturalHeight / photoImg.naturalWidth) * w);

  const pc = document.createElement("canvas"); pc.width = w; pc.height = h;
  const px = pc.getContext("2d", { willReadFrequently: true });
  px.drawImage(photoImg, 0, 0, w, h);
  const mc = document.createElement("canvas"); mc.width = w; mc.height = h;
  const mx = mc.getContext("2d", { willReadFrequently: true });
  mx.drawImage(maskImg, 0, 0, w, h);

  const base = px.getImageData(0, 0, w, h);
  const mdat = mx.getImageData(0, 0, w, h).data;

  let sum = 0, n = 0;
  const alpha = new Float32Array(w * h), lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < mdat.length; i += 4, p++) {
    const a = mdat[i] / 255;
    alpha[p] = a;
    const L = (0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2]) / 255;
    lum[p] = L;
    if (a > 0.5) { sum += L; n++; }
  }
  return (VIS.cache[room.id] = { w, h, base, alpha, lum, ref: n ? sum / n : 0.6 });
}

function visPaint(buf, hex) {
  const t = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const src = buf.base.data;
  const out = new ImageData(new Uint8ClampedArray(src), buf.w, buf.h);
  const d = out.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = buf.alpha[p];
    if (a <= 0.004) continue;
    const ratio = buf.lum[p] / buf.ref;
    for (let k = 0; k < 3; k++) {
      const lit = t[k] * ratio;
      d[i + k] = src[i + k] * (1 - a) + (lit > 255 ? 255 : lit) * a;
    }
  }
  return out;
}

async function visRender() {
  const cv = $("#visCanvas");
  if (!cv || VIS.busy || !VIS.room) return;
  VIS.busy = true;
  const status = $("#visStatus");
  try {
    const buf = await visPrepare(VIS.room);
    cv.width = buf.w; cv.height = buf.h;
    cv.getContext("2d").putImageData(visPaint(buf, VIS.colour.hex), 0, 0);
    if (status) status.textContent = "";
    cv.style.visibility = "visible";
  } catch (e) {
    if (location.protocol === "file:") {
      if (status) status.innerHTML = `The visualiser needs the site served over http, not opened as a file.
        Run <code>npx http-server</code> in the project folder and reload.`;
    } else {
      VIS.dead[VIS.room.id] = true;
      VIS.busy = false;
      const left = visRoomsFor(VIS.type);
      if (left.length) return visSelectRoom(left[0].id);
      if (status) status.textContent = "No rooms are available for this flooring type yet.";
    }
  } finally { VIS.busy = false; }
}

function visSyncCurrent() {
  const sw = $("#visSwatch"); if (!sw) return;
  sw.style.background = VIS.colour.hex;
  $("#visName").textContent = VIS.colour.name;
  $("#visCode").textContent = VIS.colour.code;
  const fav = $("#visFav");
  if (fav && VIS.colour.rangeId) {
    const key = VIS.colour.rangeId + ":" + VIS.colour.code;
    fav.outerHTML = heart(key).replace('class="fav', 'id="visFav" class="fav');
  }
}

function visSelectType(id) {
  VIS.type = TYPES.find((t) => t.id === id) || TYPES[0];
  VIS.colour = visFlat(VIS.type)[0];
  VIS.room = visRoomsFor(VIS.type)[0] || null;
  const rooms = $("#visRooms"); if (rooms) rooms.innerHTML = visRoomsHtml();
  const host = $("#visControls"); if (host) host.innerHTML = visControlsHtml();
  const note = $("#visNote"); if (note && VIS.room) note.textContent = VIS.room.note;
  visSyncCurrent();
  visRender();
}

function visSelectRoom(id) {
  VIS.room = visRoom(id) || visRoomsFor(VIS.type)[0];
  const rooms = $("#visRooms"); if (rooms) rooms.innerHTML = visRoomsHtml();
  const note = $("#visNote"); if (note && VIS.room) note.textContent = VIS.room.note;
  visRender();
}

const visRoomsHtml = () => visRoomsFor(VIS.type).map((r) =>
  `<button class="chip${VIS.room && r.id === VIS.room.id ? " on" : ""}" data-vis-room="${esc(r.id)}">${esc(r.name)}</button>`).join("");

const visControlsHtml = () => visPalette(VIS.type).map((g) => `
  <div class="vis-group">
    <h4><a href="#/range/${esc(g.rangeId)}">${esc(g.label)}</a></h4>
    <div class="vis-chips">
      ${g.colours.map((col) => `<button class="vis-chip${VIS.colour && col.code === VIS.colour.code && g.rangeId === VIS.colour.rangeId ? " on" : ""}"
          style="background:${col.hex}" data-vis-colour="${esc(g.rangeId + ":" + col.code)}"
          title="${esc(col.name)} · ${esc(col.code)}" aria-label="${esc(col.name)}"></button>`).join("")}
    </div>
  </div>`).join("");

function viewVisualiser(rangeId) {
  /* arriving from a range page preselects that range's type and first colour */
  if (rangeId) {
    const r = findRange(rangeId);
    if (r) {
      VIS.type = findType(r.type) || TYPES[0];
      VIS.colour = { ...r.colours[0], rangeId: r.id };
      VIS.room = visRoomsFor(VIS.type)[0] || null;
    }
  }
  VIS.type = VIS.type || TYPES[0];
  VIS.colour = VIS.colour || visFlat(VIS.type)[0];
  VIS.room = VIS.room || visRoomsFor(VIS.type)[0];
  const favKey = VIS.colour.rangeId ? VIS.colour.rangeId + ":" + VIS.colour.code : "";

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visualiser</p></div>
  <section><div class="wrap">
    <div class="section-head">
      <div><span class="rule"></span><p class="kicker">See it before you buy it</p>
        <h2>Floor visualiser</h2>
        <p>Pick a flooring type, choose a room, then try shades against it. The lighting in
           the photograph is kept, so you get a fair idea of how a colour sits in a space.</p></div>
    </div>

    <div class="vis">
      <div class="vis-stage">
        <div class="vis-step"><span class="vis-step-n">1</span><span class="vis-step-l">Flooring</span>
          <div class="vis-opts">${TYPES.map((t) =>
            `<button class="chip${t.id === VIS.type.id ? " on" : ""}" data-vis-type="${esc(t.id)}">${esc(t.name)}</button>`).join("")}</div>
        </div>
        <div class="vis-step"><span class="vis-step-n">2</span><span class="vis-step-l">Room</span>
          <div class="vis-opts" id="visRooms">${visRoomsHtml()}</div>
        </div>
        <div class="vis-frame">
          <canvas id="visCanvas" style="visibility:hidden"></canvas>
          <p class="vis-status" id="visStatus">Loading room…</p>
        </div>
        <p class="vis-note"><span id="visNote">${esc(VIS.room ? VIS.room.note : "")}</span>
           Colours on screen are a guide only — screens vary, and wool takes light differently
           to a photograph. Come and see the real thing.</p>
      </div>

      <aside class="vis-side">
        <span class="vis-step-l" style="display:block;margin-bottom:10px">3 · Shade</span>
        <div class="vis-current">
          <span class="sw" id="visSwatch" style="background:${VIS.colour.hex}"></span>
          <div><strong id="visName">${esc(VIS.colour.name)}</strong>
            <small id="visCode">${esc(VIS.colour.code)}</small></div>
          ${favKey ? heart(favKey).replace('class="fav', 'id="visFav" class="fav') : ""}
        </div>
        <div id="visControls">${visControlsHtml()}</div>
        <a class="btn btn-solid btn-sm" href="#/contact" style="width:100%;justify-content:center;margin-top:20px">Ask us about this colour</a>
      </aside>
    </div>
  </div></section>`;
}

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
    case "visualiser": html = viewVisualiser(parts[1]); break;
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
  if (top === "visualiser") visRender();
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

/* ---------- global events ---------- */
document.addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) return favToggle(fav.dataset.fav);

  const brand = e.target.closest("[data-brand]");
  if (brand) { CAT.brand = brand.dataset.brand; return render(); }
  const family = e.target.closest("[data-family]");
  if (family) { CAT.family = family.dataset.family; return render(); }
  const view = e.target.closest("[data-view]");
  if (view) { CAT.view = view.dataset.view; if (view.dataset.view === "ranges") CAT.family = ""; return render(); }

  const vt = e.target.closest("[data-vis-type]");
  if (vt) {
    document.querySelectorAll("[data-vis-type]").forEach((b) => b.classList.toggle("on", b === vt));
    return visSelectType(vt.dataset.visType);
  }
  const vr = e.target.closest("[data-vis-room]");
  if (vr) return visSelectRoom(vr.dataset.visRoom);
  const vc = e.target.closest("[data-vis-colour]");
  if (vc) {
    const [rangeId, code] = vc.dataset.visColour.split(":");
    const col = visFlat(VIS.type).find((x) => x.rangeId === rangeId && x.code === code);
    if (!col) return;
    VIS.colour = col;
    document.querySelectorAll(".vis-chip").forEach((b) => b.classList.toggle("on", b === vc));
    visSyncCurrent();
    return visRender();
  }

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

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  if (!SAMPLES_ON) ["#trayBtn", "#tray", "#scrim"].forEach((s) => $(s)?.remove());
  favLoad();
  render();
  favSyncCount();
  $("#navToggle").addEventListener("click", () => $(".nav").classList.toggle("show"));
});
