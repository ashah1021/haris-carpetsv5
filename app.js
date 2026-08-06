/* =========================================================================
   HARIS CARPETS — app
   Vanilla JS. No build step, no framework. Renders every view from data.js.
   Routes (hash-based so it works on GitHub Pages with zero config):
     #/                         home
     #/brands                   all brands
     #/brand/<brandId>          one brand's ranges
     #/range/<brandId>/<rangeId> range detail + colour chips
     #/services                 services
     #/contact                  enquiry / sample request
   ========================================================================= */

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $("#app");

const findBrand = (id) => BRANDS.find((b) => b.id === id);
const findRange = (bid, rid) => (findBrand(bid)?.ranges || []).find((r) => r.id === rid);
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

/* ---------- sample tray (in-memory, max 5) ---------- */
const tray = [];
const MAX = 5;
const inTray = (code) => tray.some((t) => t.code === code);

function toggleSample(sample) {
  const i = tray.findIndex((t) => t.code === sample.code);
  if (i > -1) { tray.splice(i, 1); }
  else if (tray.length < MAX) { tray.push(sample); }
  else { flashTray(); }
  syncTray();
  document.querySelectorAll(`[data-code="${sample.code}"]`).forEach((el) =>
    el.classList.toggle("selected", inTray(sample.code)));
}

function syncTray() {
  $("#trayCount").textContent = tray.length;
  const ul = $("#trayList");
  if (!tray.length) {
    ul.innerHTML = `<div class="empty">No samples yet.<br>Tap the colour chips on any range to add up to ${MAX}.</div>`;
  } else {
    ul.innerHTML = tray.map((t) => `
      <li>
        <span class="sw" style="background:${t.hex}"></span>
        <span class="info">${esc(t.name)}<small>${esc(t.brand)} · ${esc(t.range)} · ${esc(t.code)}</small></span>
        <button class="rm" aria-label="Remove ${esc(t.name)}" data-rm="${esc(t.code)}">&times;</button>
      </li>`).join("");
  }
  $("#trayReq").disabled = !tray.length;
}

function flashTray() {
  const b = $("#trayBtn");
  b.animate([{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(0)" }], { duration: 220 });
}

function openTray(open) {
  $("#tray").classList.toggle("open", open);
  $("#scrim").classList.toggle("open", open);
}

/* ---------- small view helpers ---------- */
function swatchRow(colours, n = 6) {
  return colours.slice(0, n).map((c) => `<span style="background:${c.hex}"></span>`).join("");
}
function roomsetBlock(rs) {
  return `<div class="roomset" style="background:linear-gradient(135deg, ${rs.a}, ${rs.b})">
            <span class="rlabel">${esc(rs.label)}</span>
          </div>`;
}
function rangeCard(brand, r) {
  return `<a class="range-card" href="#/range/${brand.id}/${r.id}">
    <div class="card-swatches">${swatchRow(r.colours, 6)}</div>
    <div class="card-body">
      <span class="k">${esc(r.code)}</span>
      <h3>${esc(r.name)}</h3>
      <span class="desc">${esc(r.blurb)}</span>
      <span class="card-foot">${r.colours.length} colours →</span>
    </div>
  </a>`;
}

/* ========================================================================
   VIEWS
   ======================================================================== */
function viewHome() {
  // build a sample wall from a spread of colours across brands
  const pool = BRANDS.flatMap((b) => b.ranges.flatMap((r) => r.colours)).map((c) => c.hex);
  const wall = Array.from({ length: 36 }, (_, i) => pool[(i * 7) % pool.length]);
  const featured = FEATURED.map(({ brand, range }) => {
    const b = findBrand(brand); const r = findRange(brand, range);
    return b && r ? rangeCard(b, r) : "";
  }).join("");

  return `
  <section class="hero">
    <div class="wrap">
      <div>
        <p class="eyebrow">Carpet &amp; flooring · Hounslow</p>
        <h1>Floors worth <em>coming home</em> to.</h1>
        <p class="lede">An independent showroom stocking Britain's best carpet and flooring mills — measured, supplied and fitted by people who've done it for years.</p>
        <div class="hero-cta">
          <a class="btn btn-solid" href="#/brands">Browse the ranges</a>
          <a class="btn btn-ghost" href="#/contact">Book a free measure</a>
        </div>
        <div class="hero-meta">
          <span><b>5</b> trusted mills</span>
          <span><b>100s</b> of shades</span>
          <span><b>Free</b> home measure</span>
        </div>
      </div>
      <div class="wall" aria-hidden="true">
        ${wall.map((h, i) => `<span class="chip" style="background:${h};animation-delay:${i * 18}ms"></span>`).join("")}
      </div>
    </div>
  </section>

  <div class="brands-strip">
    <div class="wrap">
      <span class="lbl">Stockists of</span>
      ${BRANDS.map((b) => `<span class="bn">${esc(b.name)}</span>`).join("")}
    </div>
  </div>

  <section class="wrap">
    <div class="section-head">
      <div><p class="eyebrow">Featured</p><h2>Pieces we love right now</h2></div>
      <a class="btn btn-ghost btn-sm" href="#/brands">All brands</a>
    </div>
    <div class="grid cols-3">${featured}</div>
  </section>

  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">How we work</p><h2>Supplied and fitted, properly</h2></div></div>
    <div class="grid cols-2">
      ${SERVICES.map((s) => `<div class="brand-card"><div class="card-body">
          <h3>${esc(s.title)}</h3><span class="desc">${esc(s.body)}</span></div></div>`).join("")}
    </div>
  </section>`;
}

function viewBrands() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Brands</p></div>
  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">The mills we stock</p>
      <h2>Browse by brand</h2>
      <p>Every range below is in our showroom — come and feel it underfoot, or order samples to your door.</p></div></div>
    <div class="grid cols-3">
      ${BRANDS.map((b) => `
        <a class="brand-card" href="#/brand/${b.id}">
          <div class="card-swatches">${swatchRow(b.ranges.flatMap((r) => r.colours), 6)}</div>
          <div class="card-body">
            <span class="k">${b.ranges.length} range${b.ranges.length > 1 ? "s" : ""}</span>
            <h3>${esc(b.name)}</h3>
            <span class="desc">${esc(b.tagline)}</span>
            ${b.real ? "" : `<span class="tag-placeholder">Placeholder data</span>`}
            <span class="card-foot">View ranges →</span>
          </div>
        </a>`).join("")}
    </div>
  </section>`;
}

function viewBrand(id) {
  const b = findBrand(id);
  if (!b) return viewNotFound();
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/brands">Brands</a> / ${esc(b.name)}</p></div>
  <section class="wrap">
    <div class="section-head"><div>
      <p class="eyebrow">${esc(b.tagline)}</p>
      <h2>${esc(b.name)}</h2>
      <p>${esc(b.heritage)}</p>
    </div></div>
    <div class="grid cols-3">${b.ranges.map((r) => rangeCard(b, r)).join("")}</div>
  </section>`;
}

function viewRange(bid, rid) {
  const b = findBrand(bid); const r = findRange(bid, rid);
  if (!b || !r) return viewNotFound();
  const spec = [
    ["Brand", b.name], ["Range code", r.code], ["Fibre", r.fibre],
    ["Pile", r.pile], ["Widths", r.widths], ["Suitability", r.use],
  ];
  return `
  <div class="wrap"><p class="crumbs">
    <a href="#/">Home</a> / <a href="#/brands">Brands</a> / <a href="#/brand/${b.id}">${esc(b.name)}</a> / ${esc(r.name)}
  </p></div>

  <section class="wrap">
    <div class="range-hero">
      ${roomsetBlock(r.roomset)}
      <div>
        <h1>${esc(r.name)}</h1>
        <p class="lede">${esc(r.blurb)}</p>
        <ul class="spec">
          ${spec.map(([k, v]) => `<li><div><span class="sl">${esc(k)}</span>${esc(v)}</div></li>`).join("")}
        </ul>
      </div>
    </div>
  </section>

  <section class="wrap">
    <div class="colours-head">
      <div><p class="eyebrow">${r.colours.length} shades</p><h2>Choose your colour</h2></div>
      <span class="hint">Tap up to ${MAX} chips to build a free sample request.</span>
    </div>
    <div class="swatch-grid">
      ${r.colours.map((col) => {
        const sample = { name: col.name, code: col.code, hex: col.hex, brand: b.name, range: r.name };
        const sel = inTray(col.code) ? " selected" : "";
        return `<button class="swatch${sel}" data-code="${esc(col.code)}"
                   data-sample='${esc(JSON.stringify(sample))}' aria-pressed="${inTray(col.code)}">
          <span class="pick">✓</span>
          <span class="col" style="background:${col.hex}"></span>
          <span class="meta"><span class="cn">${esc(col.name)}</span><br><span class="cc">${esc(col.code)}</span></span>
        </button>`;
      }).join("")}
    </div>
  </section>`;
}

function viewServices() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Services</p></div>
  <section class="wrap">
    <div class="section-head"><div><p class="eyebrow">What we do</p><h2>From measure to fitted floor</h2></div></div>
    <div class="grid cols-2">
      ${SERVICES.map((s, i) => `<div class="brand-card"><div class="card-body">
        <span class="k">${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(s.title)}</h3><span class="desc">${esc(s.body)}</span></div></div>`).join("")}
    </div>
  </section>`;
}

function viewContact(prefill = "") {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visit us</p></div>
  <section class="wrap">
    <div class="contact-grid">
      <div>
        <p class="eyebrow">Come in, or we'll come to you</p>
        <h2>Visit the showroom</h2>
        <p class="lede" style="margin-top:14px">Bring your room measurements — or book a free home measure and we'll do it for you.</p>
        <div style="margin-top:26px">
          <div class="info-row"><span class="il">Showroom</span><span>${esc(CONTACT.address)}</span></div>
          <div class="info-row"><span class="il">Phone</span><span>${esc(CONTACT.phone)}</span></div>
          <div class="info-row"><span class="il">Email</span><span>${esc(CONTACT.email)}</span></div>
          <div class="info-row"><span class="il">Hours</span><span>${esc(CONTACT.hours)}</span></div>
        </div>
      </div>
      <div>
        <div class="brand-card"><div class="card-body">
          <h3 style="margin-bottom:8px">Send an enquiry</h3>
          <form id="enquiry" novalidate>
            <div class="field"><label for="n">Name</label><input id="n" name="name" required></div>
            <div class="field"><label for="e">Email</label><input id="e" name="email" type="email" required></div>
            <div class="field"><label for="p">Phone</label><input id="p" name="phone"></div>
            <div class="field"><label for="w">What can we help with?</label>
              <select id="w" name="topic">
                <option>Book a free home measure</option>
                <option>Request carpet samples</option>
                <option>Ask about a specific range</option>
                <option>Something else</option>
              </select></div>
            <div class="field"><label for="m">Message</label><textarea id="m" name="message" rows="4">${esc(prefill)}</textarea></div>
            <button class="btn btn-solid" type="submit" style="width:100%">Send enquiry</button>
            <p class="form-note">Demo form — no emails are sent yet. See README ("Making the form send") to wire it up with Formspree or Netlify Forms.</p>
          </form>
        </div></div>
      </div>
    </div>
  </section>`;
}

function viewNotFound() {
  return `<section class="wrap"><div class="section-head"><div>
    <p class="eyebrow">404</p><h2>We couldn't find that page</h2>
    <p><a href="#/">Back to home →</a></p></div></div></section>`;
}

/* ========================================================================
   ROUTER
   ======================================================================== */
function render() {
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  let html;
  switch (parts[0]) {
    case undefined:      html = viewHome(); break;
    case "brands":       html = viewBrands(); break;
    case "brand":        html = viewBrand(parts[1]); break;
    case "range":        html = viewRange(parts[1], parts[2]); break;
    case "services":     html = viewServices(); break;
    case "contact":      html = viewContact(); break;
    default:             html = viewNotFound();
  }
  app().innerHTML = html;
  // nav active state
  document.querySelectorAll(".nav a").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("href") === "#/" + (parts[0] || "")));
  $(".nav")?.classList.remove("show");
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  if (parts[0] === "contact") wireEnquiry();
}

function wireEnquiry() {
  const f = $("#enquiry");
  f?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!f.name.value || !f.email.value) { alert("Please add your name and email."); return; }
    f.innerHTML = `<h3 style="margin-bottom:8px">Thanks — we'll be in touch.</h3>
      <p class="desc">This is a demo confirmation. Wire the form to a real endpoint (see README) to receive enquiries.</p>`;
  });
}

/* ---------- global event wiring ---------- */
document.addEventListener("click", (e) => {
  const sw = e.target.closest(".swatch");
  if (sw) { toggleSample(JSON.parse(sw.dataset.sample)); return; }
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
  // wait for render, then prefill
  setTimeout(() => {
    const m = $("#m"); const w = $("#w");
    if (m) m.value = `Please send me these samples:\n${list}`;
    if (w) w.value = "Request carpet samples";
    m?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 40);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  render();
  syncTray();
  $("#trayBtn").addEventListener("click", () => openTray(true));
  $("#trayClose").addEventListener("click", () => openTray(false));
  $("#scrim").addEventListener("click", () => openTray(false));
  $("#trayReq").addEventListener("click", requestSamples);
  $("#navToggle").addEventListener("click", () => $(".nav").classList.toggle("show"));
});
