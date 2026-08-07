/* =========================================================================
   HARI'S CARPETS — app (vanilla JS, no build step)
   Routes:
     #/                          home
     #/brands                    carpet brands (the "Carpets" category)
     #/brand/<id>                one brand's ranges
     #/range/<bid>/<rid>         range detail + colour chips
     #/category/<id>             wood-laminate | lvt | vinyl | rugs
     #/about                     about + services
     #/contact                   visit us / enquiry

   The sample tray is gated on FEATURES.samples (see data.js).
   ========================================================================= */

const $ = (sel, el = document) => el.querySelector(sel);
const app = () => $("#app");

const findBrand = (id) => BRANDS.find((b) => b.id === id);
const findRange = (bid, rid) => (findBrand(bid)?.ranges || []).find((r) => r.id === rid);
const findCat = (id) => CATEGORIES.find((c) => c.id === id);
const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

const SAMPLES_ON = typeof FEATURES !== "undefined" && FEATURES.samples;

/* -------------------------------------------------------------------------
   PHOTO HELPER
   Renders an <img> over a woven fallback texture. If the file isn't in
   /assets yet the img removes itself and the texture + label shows, so the
   layout still reads as finished rather than broken.
   ------------------------------------------------------------------------- */
function photo(src, alt, ratio = "4-3", cls = "") {
  const label = esc(alt || "Photograph");
  return `<div class="ph r-${ratio} ${cls}" data-ph="${label}">
    <img src="${esc(src)}" alt="${label}" loading="lazy" onerror="this.remove()">
  </div>`;
}

/* ---------- sample tray (in-memory, max 5) ---------- */
const tray = [];
const MAX = 5;
const inTray = (code) => tray.some((t) => t.code === code);

function toggleSample(sample) {
  if (!SAMPLES_ON) return;
  const i = tray.findIndex((t) => t.code === sample.code);
  if (i > -1) tray.splice(i, 1);
  else if (tray.length < MAX) tray.push(sample);
  else return flashTray();
  syncTray();
  document.querySelectorAll(`[data-code="${sample.code}"]`).forEach((el) =>
    el.classList.toggle("selected", inTray(sample.code)));
}
function syncTray() {
  if (!SAMPLES_ON) return;
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
const swatchRow = (colours, n = 8) => colours.slice(0, n).map((c) => `<span style="background:${c.hex}"></span>`).join("");
const swatchRowHex = (hexes) => hexes.slice(0, 8).map((h) => `<span style="background:${h}"></span>`).join("");

function rangeCard(brand, r) {
  return `<a class="card" href="#/range/${brand.id}/${r.id}">
    ${photo(r.photo, r.alt || `${r.name} carpet`, "4-3")}
    <div class="card-swatches">${swatchRow(r.colours)}</div>
    <div class="card-body">
      <span class="k">${esc(brand.name)} · ${esc(r.code)}</span>
      <h3>${esc(r.name)}</h3>
      <span class="desc">${esc(r.blurb)}</span>
      <span class="card-foot">${r.colours.length} colours →</span>
    </div></a>`;
}
function categoryTile(cat, i) {
  const lead = i < 2; /* first two run wide, the remaining three sit under them */
  return `<a class="cat-tile${lead ? " lead" : ""}" href="${cat.route}">
    ${photo(cat.photo, cat.alt || cat.name, lead ? "16-9" : "4-3")}
    <div class="cat-cap">
      <h3>${esc(cat.name)}</h3>
      <p>${esc(cat.blurb)}</p>
      <span class="go">View ${esc(cat.name)}</span>
    </div></a>`;
}
function servicesGrid() {
  return `<div class="grid cols-4">${SERVICES.map((s) => `<div class="svc"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`).join("")}</div>`;
}

/* ========================================================================
   VIEWS
   ======================================================================== */
function viewHome() {
  const featured = FEATURED.map(({ brand, range }) => {
    const b = findBrand(brand), r = findRange(brand, range);
    return b && r ? rangeCard(b, r) : "";
  }).join("");

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
        <a class="btn btn-ghost on-dark" href="#/brands">Browse carpets</a>
      </div>
    </div>
  </section>

  <div class="proof">
    <div class="wrap">
      <span><b>30+ years</b> family run</span>
      <span><b>Our own fitters</b> — not subcontractors</span>
      <span><b>Free</b> home measure &amp; plan</span>
      <span><b>Old flooring</b> lifted &amp; taken away</span>
    </div>
  </div>

  <section>
    <div class="wrap">
      <div class="section-head">
        <div><span class="rule"></span><h2>Every floor, one showroom</h2>
          <p>Wool carpet, engineered wood, laminate, LVT, sheet vinyl and rugs — all under
             one roof on Hanworth Road, and all fitted by us.</p></div>
        <a class="arrow-link" href="#/contact">Visit the showroom →</a>
      </div>
      <div class="cat-grid">${CATEGORIES.map(categoryTile).join("")}</div>
    </div>
  </section>

  <section class="sec-alt">
    <div class="wrap">
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
          <p>Bring a cushion, a paint chart, a photo of the room — whatever you're matching to.
             We'll pull the books out and talk it through properly.</p>
          <p style="margin-top:22px"><a class="arrow-link" href="#/contact">Find us &amp; opening hours →</a></p>
        </div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head">
        <div><span class="rule"></span><h2>Carpets we're fitting a lot of</h2>
          <p>Wool-rich ranges from British mills, picked because they wear well in real houses.</p></div>
        <a class="arrow-link" href="#/brands">All carpet brands →</a>
      </div>
      <div class="grid cols-3">${featured}</div>
    </div>
  </section>

  <section class="band">
    <div class="wrap">
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
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="section-head">
        <div><span class="rule"></span><h2>Recently fitted</h2>
          <p>Stairs, bedrooms, living rooms — a few of the floors we've put down around west London.</p></div>
      </div>
      <div class="strip">
        ${GALLERY.map((g) => photo(g.src, g.alt, "3-4")).join("")}
      </div>
    </div>
  </section>

  <section class="sec-alt">
    <div class="wrap">
      <div class="split">
        <div class="split-copy">
          <span class="rule"></span>
          <p class="kicker">Family run, Hounslow</p>
          <h2>${esc(ABOUT.lead)}</h2>
          <p class="lede" style="margin-top:14px">${esc(ABOUT.body[0])}</p>
          <p style="margin-top:22px"><a class="btn btn-ghost" href="#/about">More about us</a></p>
        </div>
        <div class="split-media">${photo(IMG.stairs, "Wool twist carpet fitted to a staircase and landing", "3-2")}</div>
      </div>
    </div>
  </section>`;
}

function viewCategory(id) {
  const cat = findCat(id);
  if (!cat || !cat.products) return viewNotFound();
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / ${esc(cat.name)}</p></div>
  <section>
    <div class="wrap">
      <div class="section-head">
        <div><span class="rule"></span><p class="kicker">Supplied &amp; fitted</p>
          <h2>${esc(cat.name)}</h2><p>${esc(cat.blurb)}</p></div>
        <a class="btn btn-solid btn-sm" href="#/contact">Book a free measure</a></div>
      ${photo(cat.photo, cat.alt || cat.name, "16-9")}
      <p class="ph-note" style="margin-top:26px">These ranges are placeholders — swap in the real ${esc(cat.name)} products from the supplier packs.</p>
      <div class="grid cols-3">
        ${cat.products.map((p) => `<div class="card">
          <div class="card-swatches">${swatchRowHex(cat.swatches)}</div>
          <div class="card-body"><span class="k">${esc(p.code)}</span><h3>${esc(p.name)}</h3>
            <span class="desc">${esc(p.blurb)}</span>
            <span class="tag-placeholder">Placeholder</span></div></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function viewBrands() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Carpets</p></div>
  <section>
    <div class="wrap">
      <div class="section-head"><div><span class="rule"></span><p class="kicker">Carpet mills we stock</p>
        <h2>Carpets, by brand</h2>
        <p>Wool-rich and synthetic carpet from Britain's leading mills. Come and feel them in the showroom.</p></div></div>
      <div class="grid cols-3">
        ${BRANDS.map((b) => `<a class="card" href="#/brand/${b.id}">
          ${photo(b.photo, `${b.name} carpet`, "4-3")}
          <div class="card-swatches">${swatchRow(b.ranges.flatMap((r) => r.colours))}</div>
          <div class="card-body"><span class="k">${b.ranges.length} range${b.ranges.length > 1 ? "s" : ""}</span>
            <h3>${esc(b.name)}</h3><span class="desc">${esc(b.tagline)}</span>
            ${b.real ? "" : `<span class="tag-placeholder">Placeholder data</span>`}
            <span class="card-foot">View ranges →</span></div></a>`).join("")}
      </div>
    </div>
  </section>`;
}

function viewBrand(id) {
  const b = findBrand(id);
  if (!b) return viewNotFound();
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / <a href="#/brands">Carpets</a> / ${esc(b.name)}</p></div>
  <section>
    <div class="wrap">
      <div class="section-head"><div><span class="rule"></span><p class="kicker">${esc(b.tagline)}</p>
        <h2>${esc(b.name)}</h2><p>${esc(b.heritage)}</p></div></div>
      <div class="grid cols-3">${b.ranges.map((r) => rangeCard(b, r)).join("")}</div>
    </div>
  </section>`;
}

function viewRange(bid, rid) {
  const b = findBrand(bid), r = findRange(bid, rid);
  if (!b || !r) return viewNotFound();
  const spec = [["Brand", b.name], ["Range code", r.code], ["Fibre", r.fibre], ["Pile", r.pile], ["Widths", r.widths], ["Suitability", r.use]];
  return `
  <div class="wrap"><p class="crumbs">
    <a href="#/">Home</a> / <a href="#/brands">Carpets</a> / <a href="#/brand/${b.id}">${esc(b.name)}</a> / ${esc(r.name)}</p></div>
  <section>
    <div class="wrap">
      <div class="range-hero">
        ${photo(r.photo, r.alt || `${r.name} carpet`, "4-3")}
        <div><span class="rule"></span><h1>${esc(r.name)}</h1><p class="lede">${esc(r.blurb)}</p>
          <ul class="spec">${spec.map(([k, v]) => `<li><div><span class="sl">${esc(k)}</span>${esc(v)}</div></li>`).join("")}</ul>
          <p style="margin-top:26px"><a class="btn btn-solid" href="#/contact">Ask us about this range</a></p></div>
      </div>
    </div>
  </section>
  <section class="sec-alt">
    <div class="wrap">
      <div class="colours-head"><div><span class="rule"></span><p class="kicker">${r.colours.length} shades</p><h2>Colours</h2></div>
        <span class="hint">${SAMPLES_ON
          ? `Tap up to ${MAX} chips to build a free sample request.`
          : `Shades shown are a guide — come and see the real thing in the showroom.`}</span></div>
      <div class="swatch-grid">
        ${r.colours.map((col) => {
          if (!SAMPLES_ON) {
            return `<div class="swatch static">
              <span class="col" style="background:${col.hex}"></span>
              <span class="meta"><span class="cn">${esc(col.name)}</span><br><span class="cc">${esc(col.code)}</span></span></div>`;
          }
          const sample = { name: col.name, code: col.code, hex: col.hex, brand: b.name, range: r.name };
          const sel = inTray(col.code) ? " selected" : "";
          return `<button class="swatch${sel}" data-code="${esc(col.code)}" data-sample='${esc(JSON.stringify(sample))}' aria-pressed="${inTray(col.code)}">
            <span class="pick">✓</span><span class="col" style="background:${col.hex}"></span>
            <span class="meta"><span class="cn">${esc(col.name)}</span><br><span class="cc">${esc(col.code)}</span></span></button>`;
        }).join("")}
      </div>
    </div>
  </section>`;
}

function viewAbout() {
  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / About us</p></div>
  <section>
    <div class="wrap">
      <div class="split">
        <div class="split-copy">
          <span class="rule"></span>
          <p class="kicker">Family run · Hounslow · ${esc(BUSINESS.since)}</p>
          <h2>${esc(ABOUT.lead)}</h2>
        </div>
        <div class="split-media">${photo(IMG.showroom, "Inside the Hari's Carpets showroom", "3-2")}</div>
      </div>
      <div class="prose" style="margin-top:clamp(30px,4vw,52px)">${ABOUT.body.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    </div>
  </section>
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
  <section>
    <div class="wrap">
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
                <option>Carpets</option><option>Wood &amp; Laminate</option><option>LVT</option>
                <option>Vinyl</option><option>Rugs</option><option>Something else</option>
              </select></div>
            <div class="field"><label for="m">Message</label><textarea id="m" name="message" rows="4"></textarea></div>
            <button class="btn btn-solid" type="submit" style="width:100%;justify-content:center">Send enquiry</button>
            <p class="form-note">Demo form — not connected yet. Wire it to Formspree or Netlify Forms to receive enquiries.</p>
          </form>
        </div></div>
      </div>
    </div>
  </section>`;
}

/* ========================================================================
   VISUALISER
   Recolours the floor of a roomset while keeping the photograph's own
   lighting. Each pixel's luminance is measured against the mean luminance of
   the floor, and the chosen colour is scaled by that ratio — so a shadow
   stays a shadow and the pile texture survives. A flat fill would read as a
   sticker; this reads as carpet.
   ======================================================================== */
const VIS = { type: null, room: null, colour: null, cache: {}, busy: false, dead: {} };

const visRoom = (id) => VIS_ROOMS.find((r) => r.id === id);
/* rooms this type offers, minus any whose assets failed to load */
const visRoomsFor = (type) => type.rooms.map(visRoom).filter((r) => r && !VIS.dead[r.id]);

function visPalette(type) {
  if (type.palette === "carpet") {
    return findBrand("westex").ranges.map((r) => ({ label: r.name, colours: r.colours }));
  }
  return [{ label: type.name, colours: VIS_TONES[type.palette] || [] }];
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("could not load " + src));
    im.src = src;
  });
}

/* Pull photo + mask into a reusable buffer, once per room. */
async function visPrepare(room) {
  if (VIS.cache[room.id]) return VIS.cache[room.id];

  const [photo, mask] = await Promise.all([loadImage(room.photo), loadImage(room.mask)]);
  const w = Math.min(1400, photo.naturalWidth);
  const h = Math.round((photo.naturalHeight / photo.naturalWidth) * w);

  const pc = document.createElement("canvas"); pc.width = w; pc.height = h;
  const px = pc.getContext("2d", { willReadFrequently: true });
  px.drawImage(photo, 0, 0, w, h);

  const mc = document.createElement("canvas"); mc.width = w; mc.height = h;
  const mx = mc.getContext("2d", { willReadFrequently: true });
  mx.drawImage(mask, 0, 0, w, h);

  const base = px.getImageData(0, 0, w, h);
  const mdat = mx.getImageData(0, 0, w, h).data;

  /* mean luminance of the floor — the anchor the chosen colour maps onto */
  let sum = 0, n = 0;
  const alpha = new Float32Array(w * h);
  const lum = new Float32Array(w * h);
  for (let i = 0, p = 0; i < mdat.length; i += 4, p++) {
    const a = mdat[i] / 255;
    alpha[p] = a;
    const L = (0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2]) / 255;
    lum[p] = L;
    if (a > 0.5) { sum += L; n++; }
  }
  const ref = n ? sum / n : 0.6;

  return (VIS.cache[room.id] = { w, h, base, alpha, lum, ref });
}

function visPaint(buf, hex) {
  const t = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const src = buf.base.data;
  const out = new ImageData(new Uint8ClampedArray(src), buf.w, buf.h);
  const d = out.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const a = buf.alpha[p];
    if (a <= 0.004) continue;
    /* ratio<1 in shadow, >1 in highlight — this is what keeps the pile visible */
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
  if (!cv || VIS.busy) return;
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
      /* canvas pixel access is blocked on file:// — nothing to do but explain */
      if (status) status.innerHTML = `The visualiser needs the site served over http, not opened as a file.
        Run <code>npx http-server</code> in the project folder and reload.`;
    } else {
      /* a room missing its photo or mask drops out rather than showing broken */
      VIS.dead[VIS.room.id] = true;
      VIS.busy = false;
      const left = visRoomsFor(VIS.type);
      if (left.length) return visSelectRoom(left[0].id);
      if (status) status.textContent = "No rooms are available for this flooring type yet.";
    }
  } finally { VIS.busy = false; }
}

/* keep the "currently showing" readout in step with VIS.colour */
function visSyncCurrent() {
  const sw = $("#visSwatch"); if (!sw) return;
  sw.style.background = VIS.colour.hex;
  $("#visName").textContent = VIS.colour.name;
  $("#visCode").textContent = VIS.colour.code;
}

function visSelectType(id) {
  const type = VIS_TYPES.find((t) => t.id === id) || VIS_TYPES[0];
  VIS.type = type;
  VIS.colour = visPalette(type)[0].colours[0];
  const rooms = visRoomsFor(type);
  VIS.room = rooms[0] || null;
  const host = app().querySelector("#visControls");
  if (host) host.innerHTML = visControlsHtml();
  visSyncCurrent();
  visRender();
}

function visSelectRoom(id) {
  VIS.room = visRoom(id) || visRoomsFor(VIS.type)[0];
  const host = app().querySelector("#visControls");
  if (host) host.innerHTML = visControlsHtml();
  const note = $("#visNote");
  if (note && VIS.room) note.textContent = VIS.room.note;
  visRender();
}

function visRoomsHtml() {
  const rooms = visRoomsFor(VIS.type);
  return rooms.map((r) => `<button class="vis-room${VIS.room && r.id === VIS.room.id ? " on" : ""}"
    data-vis-room="${esc(r.id)}">${esc(r.name)}</button>`).join("");
}

function visControlsHtml() {
  return visPalette(VIS.type).map((g) => `
    <div class="vis-group">
      <h4>${esc(g.label)}</h4>
      <div class="vis-chips">
        ${g.colours.map((c) => `<button class="vis-chip${VIS.colour && c.code === VIS.colour.code ? " on" : ""}"
            style="background:${c.hex}" data-vis-colour="${esc(c.code)}"
            title="${esc(c.name)} · ${esc(c.code)}" aria-label="${esc(c.name)}"></button>`).join("")}
      </div>
    </div>`).join("");
}

function viewVisualiser() {
  VIS.type = VIS.type || VIS_TYPES[0];
  VIS.colour = VIS.colour || visPalette(VIS.type)[0].colours[0];
  VIS.room = VIS.room || visRoomsFor(VIS.type)[0];

  return `
  <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visualiser</p></div>
  <section>
    <div class="wrap">
      <div class="section-head">
        <div><span class="rule"></span><p class="kicker">See it before you buy it</p>
          <h2>Floor visualiser</h2>
          <p>Pick a flooring type, choose a room, then try shades against it. The lighting in
             the photograph is kept, so you get a fair idea of how a colour sits in a space.</p></div>
      </div>

      <div class="vis">
        <div class="vis-stage">
          <div class="vis-step">
            <span class="vis-step-n">1</span><span class="vis-step-l">Flooring</span>
            <div class="vis-opts">
              ${VIS_TYPES.map((t) => `<button class="vis-room${t.id === VIS.type.id ? " on" : ""}"
                data-vis-type="${esc(t.id)}">${esc(t.name)}</button>`).join("")}
            </div>
          </div>
          <div class="vis-step">
            <span class="vis-step-n">2</span><span class="vis-step-l">Room</span>
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
          </div>
          <div id="visControls">${visControlsHtml()}</div>
          <a class="btn btn-solid btn-sm" href="#/contact" style="width:100%;justify-content:center;margin-top:20px">Ask us about this colour</a>
        </aside>
      </div>
    </div>
  </section>`;
}

function viewNotFound() {
  return `<section><div class="wrap"><span class="rule"></span><p class="kicker">404</p>
    <h2>We couldn't find that page</h2><p style="margin-top:14px"><a class="arrow-link" href="#/">Back to home →</a></p></div></section>`;
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
    case "visualiser": html = viewVisualiser(); break;
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
  if (top === "visualiser") visRender();
}

function wireEnquiry() {
  $("#enquiry")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.name.value || !f.email.value) { alert("Please add your name and email."); return; }
    f.innerHTML = `<h3 style="margin-bottom:8px">Thanks — we'll be in touch.</h3>
      <p class="desc">This is a demo confirmation. Wire the form to a real endpoint to receive enquiries.</p>`;
  });
}

/* ---------- global events ---------- */
document.addEventListener("click", (e) => {
  /* visualiser controls */
  const vt = e.target.closest("[data-vis-type]");
  if (vt) {
    document.querySelectorAll("[data-vis-type]").forEach((b) => b.classList.toggle("on", b === vt));
    visSelectType(vt.dataset.visType);
    const rooms = $("#visRooms");
    if (rooms) rooms.innerHTML = visRoomsHtml();
    return;
  }
  const vr = e.target.closest("[data-vis-room]");
  if (vr) {
    document.querySelectorAll("[data-vis-room]").forEach((b) => b.classList.toggle("on", b === vr));
    return visSelectRoom(vr.dataset.visRoom);
  }
  const vc = e.target.closest("[data-vis-colour]");
  if (vc) {
    const all = visPalette(VIS.type).flatMap((g) => g.colours);
    const col = all.find((c) => c.code === vc.dataset.visColour);
    if (!col) return;
    VIS.colour = col;
    document.querySelectorAll(".vis-chip").forEach((b) => b.classList.toggle("on", b === vc));
    visSyncCurrent();
    return visRender();
  }

  if (!SAMPLES_ON) return;
  const sw = e.target.closest(".swatch[data-sample]");
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
  /* strip the sample-tray UI out of the DOM entirely when the feature is off */
  if (!SAMPLES_ON) {
    ["#trayBtn", "#tray", "#scrim"].forEach((s) => $(s)?.remove());
  }
  render();
  if (SAMPLES_ON) {
    syncTray();
    $("#trayBtn").addEventListener("click", () => openTray(true));
    $("#trayClose").addEventListener("click", () => openTray(false));
    $("#scrim").addEventListener("click", () => openTray(false));
    $("#trayReq").addEventListener("click", requestSamples);
  }
  $("#navToggle").addEventListener("click", () => $(".nav").classList.toggle("show"));
});
