/* =========================================================================
   HARI'S CARPETS — app (vanilla JS, no build step)
   Routes:
     #/                          home
     #/brands                    carpet brands (the "Carpets" category)
     #/brand/<id>                one brand's ranges
     #/range/<bid>/<rid>         range detail + colour chips + sample tray
     #/category/<id>             wood-laminate | lvt | vinyl | rugs
     #/about                     about + services
     #/contact                   visit us / enquiry
   ========================================================================= */

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $("#app");

const findBrand = (id) => BRANDS.find((b) => b.id === id);
const findRange = (bid, rid) => (findBrand(bid)?.ranges || []).find((r) => r.id === rid);
const findCat = (id) => CATEGORIES.find((c) => c.id === id);
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

/* ---------- sample tray (in-memory, max 5) ---------- */
const tray = [];
const MAX = 5;
const inTray = (code) => tray.some((t) => t.code === code);

function toggleSample(sample) {
  const i = tray.findIndex((t) => t.code === sample.code);
  if (i > -1) tray.splice(i, 1);
  else if (tray.length < MAX) tray.push(sample);
  else return flashTray();
  syncTray();
  document.querySelectorAll(`[data-code="${sample.code}"]`).forEach((el) =>
    el.classList.toggle("selected", inTray(sample.code)));
}
function syncTray() {
  $("#trayCount").textContent = tray.length;
  const ul = $("#trayList");
  ul.innerHTML = tray.length
    ? tray.map((t) => `<li>
        <span class="sw" style="background:${t.hex}"></span>
        <span class="info">${esc(t.name)}<small>${esc(t.brand)} · ${esc(t.range)} · ${esc(t.code)}</small></span>
        <button class="rm" aria-label="Remove ${esc(t.name)}" data-rm="${esc(t.code)}">&times;</button></li>`).join("")
    : `<div class="empty">No samples yet.<br>Tap the colour chips on any carpet range to add up to ${MAX}.</div>`;
  $("#trayReq").disabled = !tray.length;
}
function flashTray() {
  $("#trayBtn").animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 220 });
}
function openTray(open) { $("#tray").classList.toggle("open", open); $("#scrim").classList.toggle("open", open); }

/* ---------- view helpers ---------- */
const swatchRow = (colours, n = 6) => colours.slice(0, n).map((c) => `<span style="background:${c.hex}"></span>`).join("");
const swatchRowHex = (hexes) => hexes.slice(0, 6).map((h) => `<span style="background:${h}"></span>`).join("");
const roomsetBlock = (rs) => `<div class="roomset" style="background:linear-gradient(135deg, ${rs.a}, ${rs.b})"><span class="rlabel">${esc(rs.label)}</span></div>`;

function rangeCard(brand, r) {
  return `<a class="range-card" href="#/range/${brand.id}/${r.id}">
    <div class="card-swatches">${swatchRow(r.colours)}</div>
    <div class="card-body">
      <span class="k">${esc(brand.name)} · ${esc(r.code)}</span>
      <h3>${esc(r.name)}</h3>
      <span class="desc">${esc(r.blurb)}</span>
      <span class="card-foot">${r.colours.length} colours →</span>
    </div></a>`;
}
function categoryTile(cat) {
  return `<a class="cat-tile" href="${cat.route}">
    <div class="cat-swatches">${swatchRowHex(cat.swatches)}</div>
    <div class="cat-body"><h3>${esc(cat.name)}</h3><p>${esc(cat.blurb)}</p><span class="card-foot">Explore ${esc(cat.name)} →</span></div>
  </a>`;
}
function servicesGrid() {
  return `<div class="grid cols-2">${SERVICES.map((s) => `<div class="svc"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join("")}</div>`;
}

/* ========================================================================
   VIEWS
   ======================================================================== */
function viewHome() {
  const pool = BRANDS.flatMap((b) => b.ranges.flatMap((r) => r.colours)).map((c) => c.hex);
  const wall = Array.from({ length: 36 }, (_, i) => pool[(i * 7) % pool.length]);
  const featured = FEATURED.map(({ brand, range }) => {
    const b = findBrand(brand), r = findRange(brand, range);
    return b && r ? rangeCard(b, r) : "";
  }).join("");

  return `
  <section class="hero">
    <div class="wrap">
      <div>
        <p class="eyebrow">${esc(BUSINESS.since)} · Hounslow</p>
        <h1>Floors worth <em>coming home</em> to.</h1>
        <p class="lede">${esc(BUSINESS.blurbShort)} Supplied and fitted by our own team.</p>
        <div class="hero-cta">
          <a class="btn btn-solid" href="#/contact">Book a free measure</a>
          <a class="btn btn-ghost" href="#/brands">Browse carpets</a>
        </div>
        <div class="hero-meta">
          <span><b>30+</b> years, family run</span>
          <span><b>Supply</b> &amp; fit</span>
          <span><b>Free</b> home measure</span>
        </div>
      </div>
      <div class="wall" aria-hidden="true">
        ${wall.map((h, i) => `<span class="chip" style="background:${h};animation-delay:${i * 18}ms"></span>`).join("")}
      </div>
    </div>
  </section>

  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">What we do</p><h2>Every floor, one showroom</h2>
      <p>From wool carpet to wood, LVT, vinyl and rugs — all supplied and fitted.</p></div></div>
    <div class="grid cols-3 cat-grid">${CATEGORIES.map(categoryTile).join("")}</div>
  </section>

  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">Featured carpets</p><h2>Ranges we love right now</h2></div>
      <a class="btn btn-ghost btn-sm" href="#/brands">All carpet brands</a></div>
    <div class="grid cols-3">${featured}</div>
  </section>

  <section class="band">
    <div class="wrap">
      <div class="section-head"><div><p class="eyebrow">How we work</p><h2>Supplied and fitted, properly</h2></div></div>
      ${servicesGrid()}
    </div>
  </section>

  <section class="wrap about-teaser">
    <div>
      <p class="eyebrow">Family run, Hounslow</p>
      <h2>${esc(ABOUT.lead)}</h2>
      <p class="lede">${esc(ABOUT.body[0])}</p>
      <a class="btn btn-ghost" href="#/about" style="margin-top:8px">More about us</a>
    </div>
  </section>`;
}

function viewCategory(id) {
  const cat = findCat(id);
  if (!cat || !cat.products) return viewNotFound();
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / ${esc(cat.name)}</p></div>
  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">Supplied &amp; fitted</p>
      <h2>${esc(cat.name)}</h2><p>${esc(cat.blurb)}</p></div>
      <a class="btn btn-solid btn-sm" href="#/contact">Book a free measure</a></div>
    <p class="ph-note">These ranges are placeholders — swap in the real ${esc(cat.name)} products from the supplier packs (see README).</p>
    <div class="grid cols-3">
      ${cat.products.map((p) => `<div class="range-card">
        <div class="card-swatches">${swatchRowHex(cat.swatches)}</div>
        <div class="card-body"><span class="k">${esc(p.code)}</span><h3>${esc(p.name)}</h3>
          <span class="desc">${esc(p.blurb)}</span>
          <span class="tag-placeholder">Placeholder</span></div></div>`).join("")}
    </div>
  </section>`;
}

function viewBrands() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Carpets</p></div>
  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">Carpet mills we stock</p><h2>Carpets, by brand</h2>
      <p>Wool-rich and synthetic carpet from Britain's leading mills. Come and feel them in the showroom, or order samples to your door.</p></div></div>
    <div class="grid cols-3">
      ${BRANDS.map((b) => `<a class="brand-card" href="#/brand/${b.id}">
        <div class="card-swatches">${swatchRow(b.ranges.flatMap((r) => r.colours))}</div>
        <div class="card-body"><span class="k">${b.ranges.length} range${b.ranges.length > 1 ? "s" : ""}</span>
          <h3>${esc(b.name)}</h3><span class="desc">${esc(b.tagline)}</span>
          ${b.real ? "" : `<span class="tag-placeholder">Placeholder data</span>`}
          <span class="card-foot">View ranges →</span></div></a>`).join("")}
    </div>
  </section>`;
}

function viewBrand(id) {
  const b = findBrand(id);
  if (!b) return viewNotFound();
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/brands">Carpets</a> / ${esc(b.name)}</p></div>
  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">${esc(b.tagline)}</p><h2>${esc(b.name)}</h2><p>${esc(b.heritage)}</p></div></div>
    <div class="grid cols-3">${b.ranges.map((r) => rangeCard(b, r)).join("")}</div>
  </section>`;
}

function viewRange(bid, rid) {
  const b = findBrand(bid), r = findRange(bid, rid);
  if (!b || !r) return viewNotFound();
  const spec = [["Brand", b.name], ["Range code", r.code], ["Fibre", r.fibre], ["Pile", r.pile], ["Widths", r.widths], ["Suitability", r.use]];
  return `
  <div class="wrap"><p class="crumbs">
    <a href="#/">Home</a> / <a href="#/brands">Carpets</a> / <a href="#/brand/${b.id}">${esc(b.name)}</a> / ${esc(r.name)}</p></div>
  <section class="wrap">
    <div class="range-hero">
      ${roomsetBlock(r.roomset)}
      <div><h1>${esc(r.name)}</h1><p class="lede">${esc(r.blurb)}</p>
        <ul class="spec">${spec.map(([k, v]) => `<li><div><span class="sl">${esc(k)}</span>${esc(v)}</div></li>`).join("")}</ul></div>
    </div>
  </section>
  <section class="wrap">
    <div class="colours-head"><div><p class="eyebrow">${r.colours.length} shades</p><h2>Choose your colour</h2></div>
      <span class="hint">Tap up to ${MAX} chips to build a free sample request.</span></div>
    <div class="swatch-grid">
      ${r.colours.map((col) => {
        const sample = { name: col.name, code: col.code, hex: col.hex, brand: b.name, range: r.name };
        const sel = inTray(col.code) ? " selected" : "";
        return `<button class="swatch${sel}" data-code="${esc(col.code)}" data-sample='${esc(JSON.stringify(sample))}' aria-pressed="${inTray(col.code)}">
          <span class="pick">✓</span><span class="col" style="background:${col.hex}"></span>
          <span class="meta"><span class="cn">${esc(col.name)}</span><br><span class="cc">${esc(col.code)}</span></span></button>`;
      }).join("")}
    </div>
  </section>`;
}

function viewAbout() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / About us</p></div>
  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">Family run · Hounslow · ${esc(BUSINESS.since)}</p><h2>${esc(ABOUT.lead)}</h2></div></div>
    <div class="prose">${ABOUT.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  </section>
  <section class="band"><div class="wrap">
    <div class="section-head"><div><p class="eyebrow">Our service</p><h2>What you get</h2></div></div>
    ${servicesGrid()}
    <div style="margin-top:26px"><a class="btn btn-solid" href="#/contact">Book a free measure</a></div>
  </div></section>`;
}

function viewContact() {
  const socials = SOCIALS.map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join("");
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visit us</p></div>
  <section class="wrap">
    <div class="contact-grid">
      <div>
        <p class="eyebrow">Come in, or we'll come to you</p><h2>Visit the showroom</h2>
        <p class="lede" style="margin-top:14px">Pop into the Hounslow showroom, or book a free home measure and we'll come to you across ${esc(CONTACT.area)}.</p>
        <div style="margin-top:24px">
          <div class="info-row"><span class="il">Showroom</span><span><a href="${CONTACT.mapsUrl}" target="_blank" rel="noopener">${esc(CONTACT.address)}</a></span></div>
          <div class="info-row"><span class="il">Phone</span><span><a href="${CONTACT.phoneHref}">${esc(CONTACT.phone)}</a></span></div>
          <div class="info-row"><span class="il">Email</span><span><a href="mailto:${CONTACT.email}">${esc(CONTACT.email)}</a></span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(CONTACT.hours)}</span></div>
          <div class="info-row"><span class="il">Follow</span><span class="socials">${socials}</span></div>
        </div>
      </div>
      <div><div class="form-card">
        <h3 style="margin-bottom:8px">Send an enquiry</h3>
        <form id="enquiry" novalidate>
          <div class="field"><label for="n">Name</label><input id="n" name="name" required></div>
          <div class="field"><label for="e">Email</label><input id="e" name="email" type="email" required></div>
          <div class="field"><label for="p">Phone</label><input id="p" name="phone"></div>
          <div class="field"><label for="w">What can we help with?</label>
            <select id="w" name="topic">
              <option>Book a free home measure</option><option>Request carpet samples</option>
              <option>Carpets</option><option>Wood &amp; Laminate</option><option>LVT</option>
              <option>Vinyl</option><option>Rugs</option><option>Something else</option>
            </select></div>
          <div class="field"><label for="m">Message</label><textarea id="m" name="message" rows="4"></textarea></div>
          <button class="btn btn-solid" type="submit" style="width:100%">Send enquiry</button>
          <p class="form-note">Demo form — not connected yet. See README ("Making the form send") to wire it to Formspree or Netlify Forms.</p>
        </form>
      </div></div>
    </div>
  </section>`;
}

function viewNotFound() {
  return `<section class="wrap"><div class="section-head"><div><p class="eyebrow">404</p><h2>We couldn't find that page</h2><p><a href="#/">Back to home →</a></p></div></div></section>`;
}

/* ========================================================================
   ROUTER
   ======================================================================== */
function render() {
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  let html, top = parts[0];
  switch (top) {
    case undefined:  html = viewHome(); break;
    case "brands":   html = viewBrands(); break;
    case "brand":    html = viewBrand(parts[1]); break;
    case "range":    html = viewRange(parts[1], parts[2]); break;
    case "category": html = viewCategory(parts[1]); break;
    case "about":    html = viewAbout(); break;
    case "contact":  html = viewContact(); break;
    default:         html = viewNotFound();
  }
  app().innerHTML = html;
  const hash = location.hash || "#/";
  document.querySelectorAll(".nav a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === "#/" ? hash === "#/" : (hash === href || hash.startsWith(href + "/")));
  });
  $(".nav")?.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "auto" });
  if (top === "contact") wireEnquiry();
}

function wireEnquiry() {
  $("#enquiry")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.name.value || !f.email.value) { alert("Please add your name and email."); return; }
    f.innerHTML = `<h3 style="margin-bottom:8px">Thanks — we'll be in touch.</h3>
      <p class="desc">This is a demo confirmation. Wire the form to a real endpoint (see README) to receive enquiries.</p>`;
  });
}

/* ---------- global events ---------- */
document.addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (sw) return toggleSample(JSON.parse(sw.dataset.sample));
  const rm = e.target.closest("[data-rm]");
  if (rm) {
    const i = tray.findIndex((t) => t.code === rm.dataset.rm);
    if (i > -1) { const [g] = tray.splice(i, 1); syncTray();
      document.querySelectorAll(`[data-code="${g.code}"]`).forEach((el) => el.classList.remove("selected")); }
  }
});

function requestSamples() {
  if (!tray.length) return;
  const list = tray.map((t) => `• ${t.name} (${t.code}) — ${t.brand} ${t.range}`).join("\n");
  openTray(false);
  location.hash = "#/contact";
  setTimeout(() => {
    const m = $("#m"), w = $("#w");
    if (m) m.value = `Please send me these samples:\n${list}`;
    if (w) w.value = "Request carpet samples";
    m?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 40);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  render(); syncTray();
  $("#trayBtn").addEventListener("click", () => openTray(true));
  $("#trayClose").addEventListener("click", () => openTray(false));
  $("#scrim").addEventListener("click", () => openTray(false));
  $("#trayReq").addEventListener("click", requestSamples);
  $("#navToggle").addEventListener("click", () => $(".nav").classList.toggle("show"));
});
