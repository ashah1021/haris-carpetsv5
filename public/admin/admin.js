/**
 * Hari's Carpets — the admin page.
 *
 * Loads data.js for the generated catalogue and /api/site for everything the
 * shop has changed, edits the second, and never touches the first. Save writes
 * the whole document back in one go; the site picks it up within the minute.
 *
 * THE ONE RULE WORTH KNOWING
 * Nothing is deleted. Hiding a collection or a shade takes it off the site but
 * leaves its key alone, so a customer's saved shortlist and any link they have
 * shared still work. Unhide and it comes back exactly as it was.
 *
 * ADDING A SHADE
 * The catalogue is accurate because every colour was measured off the
 * supplier's own swatch photography rather than typed in, and a colour picker
 * would undo that quietly — nobody can eyeball a carpet to six hex digits. So
 * adding a shade means uploading a photograph of the swatch, and the browser
 * measures it here with the same rule the pipeline uses: the median of the
 * middle of the frame. Median rather than average because it ignores the
 * label, the edge of the card and any shine on the pile.
 */
(function () {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* the document we are editing */
  let DOC = null;
  let dirty = false;
  let tab = "shop";
  let openRange = null;   // which collection's shades are being edited

  const FIELDS = [
    ["hours", "Opening hours", "Mon–Sat 9am–5.30pm, Sunday closed"],
    ["phone", "Phone number", "020 8570 6502"],
    ["email", "Email address", "hello@haris-carpets.co.uk"],
    ["address", "Address", "267 Hanworth Road, Hounslow"],
    ["notice", "Notice on the home page", "Leave empty for none"],
    ["about", "About us", "Shown on the About page"],
  ];

  const TABS = [
    ["shop", "Shop details"],
    ["collections", "Collections"],
    ["styles", "Styles"],
    ["home", "Home page"],
  ];

  /* ---------------------------------------------------------------- state */

  function mark() {
    dirty = true;
    $("#save").disabled = false;
    $("#state").textContent = "Unsaved changes";
    $("#state").className = "ad-state warn";
  }

  /** Every collection the site knows about: generated, plus any added here. */
  function allRanges() {
    return [...CATALOGUE, ...(DOC.ranges || []).map((r) => ({ ...r, added: true }))];
  }

  const shadesOf = (r) => [...r.colours, ...((DOC.extra || {})[r.id] || [])];
  const isHidden = (key) => Boolean(DOC.overrides[key]?.hidden);

  function setHidden(key, hidden) {
    const o = DOC.overrides[key] || {};
    if (hidden) o.hidden = true; else delete o.hidden;
    if (Object.keys(o).length) DOC.overrides[key] = o; else delete DOC.overrides[key];
    mark();
  }

  function setName(key, name, original) {
    const o = DOC.overrides[key] || {};
    if (name && name !== original) o.name = name; else delete o.name;
    if (Object.keys(o).length) DOC.overrides[key] = o; else delete DOC.overrides[key];
    mark();
  }

  /* ------------------------------------------------- measuring a swatch photo */

  /**
   * Read a photo file, shrink it, and measure its colour.
   * Shrinking here rather than on the server means we upload ~100KB instead of
   * a 6MB phone photo, and re-encoding through a canvas drops the EXIF — which
   * on a phone includes where the picture was taken.
   */
  function readSwatch(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("could not read that file"));
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => reject(new Error("that file is not an image"));
        im.onload = () => {
          const w = Math.min(900, im.naturalWidth);
          const h = Math.round((im.naturalHeight / im.naturalWidth) * w);
          const cv = document.createElement("canvas");
          cv.width = w; cv.height = h;
          const cx = cv.getContext("2d", { willReadFrequently: true });
          cx.drawImage(im, 0, 0, w, h);

          // median of the central half — the same crop the pipeline measures
          const d = cx.getImageData(Math.floor(w / 4), Math.floor(h / 4),
                                    Math.ceil(w / 2), Math.ceil(h / 2)).data;
          const ch = [[], [], []];
          for (let i = 0; i < d.length; i += 4) {
            ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]);
          }
          const mid = ch.map((c) => {
            c.sort((a, b) => a - b);
            return c[Math.floor(c.length / 2)];
          });
          const hex = "#" + mid.map((n) => n.toString(16).padStart(2, "0")).join("");

          cv.toBlob((blob) => {
            if (!blob) return reject(new Error("could not process that image"));
            resolve({ hex, blob, preview: cv.toDataURL("image/jpeg", 0.7) });
          }, "image/jpeg", 0.82);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------ views */

  function viewShop() {
    return `
    <h2>Shop details</h2>
    <p class="ad-lede">These show on the website. Leave a box empty to keep what's already there.</p>
    <div class="ad-fields">
      ${FIELDS.map(([k, label, hint]) => `
        <label class="ad-field">
          <span>${esc(label)}</span>
          ${k === "about"
            ? `<textarea rows="5" data-content="${k}" placeholder="${esc(hint)}">${esc(DOC.content[k] || "")}</textarea>`
            : `<input type="text" data-content="${k}" value="${esc(DOC.content[k] || "")}" placeholder="${esc(hint)}">`}
        </label>`).join("")}
    </div>`;
  }

  function viewCollections() {
    if (openRange) return viewShades(openRange);
    const list = allRanges();
    return `
    <h2>Collections</h2>
    <p class="ad-lede">Hiding a collection takes it off the website. Nothing is deleted, so
      anything a customer has saved keeps working, and you can put it back at any time.</p>
    <button class="btn btn-solid btn-sm" id="addRange">Add a collection</button>
    <input class="ad-search" id="search" type="search" placeholder="Search collections…">

    <div class="ad-newrange" id="newRange" hidden>
      <h3>New collection</h3>
      <div class="ad-addrow">
        <label class="ad-field"><span>Collection name</span>
          <input type="text" id="nrName" placeholder="e.g. Highland Twist"></label>
        <label class="ad-field"><span>Brand</span>
          <input type="text" id="nrBrand" placeholder="e.g. Cormar Carpets"></label>
        <label class="ad-field"><span>Type of flooring</span>
          <select id="nrType">${TYPES.map((t) =>
            `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label>
        <button class="btn btn-solid btn-sm" id="createRange">Create</button>
        <button class="btn btn-ghost btn-sm" id="cancelRange">Cancel</button>
      </div>
      <p class="ad-err" id="nrErr"></p>
    </div>
    <div class="ad-rows" id="rows">
      ${list.map((r) => {
        const hidden = isHidden(r.id);
        const n = shadesOf(r).filter((c) => !isHidden(r.id + ":" + slugify(c.name))).length;
        return `<div class="ad-row${hidden ? " off" : ""}" data-search="${esc((r.name + " " + r.brand).toLowerCase())}">
          <div class="ad-row-main">
            <b>${esc(DOC.overrides[r.id]?.name || r.name)}</b>
            <span class="ad-meta">${esc(r.brand)} · ${esc(r.type)} · ${n} shade${n === 1 ? "" : "s"}${
              r.added ? ' · <span class="ad-badge">added here</span>' : ""}</span>
          </div>
          <div class="ad-row-acts">
            <button class="btn btn-ghost btn-sm" data-shades="${esc(r.id)}">Shades</button>
            <button class="btn btn-ghost btn-sm" data-hide="${esc(r.id)}">${hidden ? "Show" : "Hide"}</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function viewShades(id) {
    const r = allRanges().find((x) => x.id === id);
    if (!r) { openRange = null; return viewCollections(); }
    const shades = shadesOf(r);
    return `
    <p class="ad-back"><button class="linkish" id="back">← All collections</button></p>
    <h2>${esc(DOC.overrides[r.id]?.name || r.name)}</h2>
    <p class="ad-lede">${esc(r.brand)} · ${shades.length} shade${shades.length === 1 ? "" : "s"}.
      Hide a shade that's out of stock; it stays saved for anyone who shortlisted it.</p>

    <div class="ad-addshade">
      <h3>Add a shade</h3>
      <p>Photograph the swatch flat, filling the frame, in daylight. The colour is
         measured from your photo — you don't need to know a colour code.</p>
      <div class="ad-addrow">
        <label class="ad-field"><span>Shade name</span>
          <input type="text" id="newShadeName" placeholder="e.g. Oatmeal"></label>
        <label class="ad-field"><span>Photograph of the swatch</span>
          <input type="file" id="newShadeFile" accept="image/*"></label>
        <div class="ad-measured" id="measured"></div>
        <button class="btn btn-solid btn-sm" id="addShade" disabled>Add shade</button>
      </div>
      <p class="ad-err" id="shadeErr"></p>
    </div>

    ${shades.length > 12
      ? `<input class="ad-search" id="shadeSearch" type="search" placeholder="Find a shade…">`
      : ""}

    <div class="ad-swatches" id="shadeList">
      ${shades.map((c) => {
        const key = r.id + ":" + slugify(c.name);
        const hidden = isHidden(key);
        const shown = DOC.overrides[key]?.name || c.name;
        return `<div class="ad-sw${hidden ? " off" : ""}" data-search="${esc(shown.toLowerCase())}">
          <span class="ad-chip" style="background:${esc(c.hex)}"></span>
          <input type="text" value="${esc(shown)}" data-rename="${esc(key)}"
                 data-original="${esc(c.name)}" aria-label="Shade name">
          <button class="btn btn-ghost btn-sm" data-hide="${esc(key)}">${hidden ? "Show" : "Hide"}</button>
        </div>`;
      }).join("") || `<p class="ad-lede">No shades yet.</p>`}
    </div>`;
  }

  function viewStyles() {
    const types = Object.keys(STYLES).filter((t) => STYLES[t].length);
    return `
    <h2>Styles</h2>
    <p class="ad-lede">This is what customers see first — "what sort of carpet are you after?".
      Tick the collections that belong under each. A collection in no style still
      appears everywhere else on the site, so it's safe to untick one you're unsure of.</p>
    ${types.map((type) => `
      <section class="ad-styleblock">
        <h3>${esc((TYPES.find((t) => t.id === type) || {}).name || type)}</h3>
        ${STYLES[type].map((st) => {
          const chosen = DOC.styles?.[type]?.[st.id] || st.ranges;
          const options = allRanges().filter((r) => r.type === type);
          return `<div class="ad-style">
            <div class="ad-style-head"><b>${esc(st.name)}</b>
              <span class="ad-meta">${esc(st.blurb)}</span></div>
            <div class="ad-ticks">
              ${options.map((r) => `<label class="ad-tick">
                <input type="checkbox" data-style="${esc(type)}|${esc(st.id)}" value="${esc(r.id)}"
                  ${chosen.includes(r.id) ? "checked" : ""}>
                <span>${esc(DOC.overrides[r.id]?.name || r.name)}
                  <i>${esc(r.brand)}</i></span></label>`).join("")}
            </div>
          </div>`;
        }).join("")}
      </section>`).join("")}`;
  }

  function viewHome() {
    const chosen = DOC.featured || FEATURED;
    return `
    <h2>Home page</h2>
    <p class="ad-lede">Pick the collections to show on the front page. Three fits the layout best.</p>
    <div class="ad-ticks wide">
      ${allRanges().filter((r) => !isHidden(r.id)).map((r) => `<label class="ad-tick">
        <input type="checkbox" data-featured value="${esc(r.id)}" ${chosen.includes(r.id) ? "checked" : ""}>
        <span>${esc(DOC.overrides[r.id]?.name || r.name)}<i>${esc(r.brand)}</i></span></label>`).join("")}
    </div>`;
  }

  /* ------------------------------------------------------------------ render */

  function render() {
    $("#tabs").innerHTML = TABS.map(([id, label]) =>
      `<button class="ad-tab${tab === id ? " on" : ""}" data-tab="${id}">${esc(label)}</button>`).join("");
    $("#panel").innerHTML =
      tab === "shop" ? viewShop()
      : tab === "collections" ? viewCollections()
      : tab === "styles" ? viewStyles()
      : viewHome();
  }

  /* ------------------------------------------------------------------ saving */

  async function save() {
    const btn = $("#save");
    btn.disabled = true;
    $("#state").textContent = "Saving…";
    $("#state").className = "ad-state";
    try {
      const res = await fetch("../api/admin/site", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...DOC, baseVersion: DOC.version }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        $("#state").textContent = "Someone else saved first — reload before editing";
        $("#state").className = "ad-state warn";
        btn.disabled = false;
        return;
      }
      if (!res.ok) throw new Error(body.error || ("save failed (" + res.status + ")"));
      DOC.version = body.version;
      dirty = false;
      $("#state").textContent = "Saved — live on the site within a minute";
      $("#state").className = "ad-state ok";
    } catch (err) {
      $("#state").textContent = err.message;
      $("#state").className = "ad-state warn";
      btn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ events */

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.content !== undefined) { DOC.content[t.dataset.content] = t.value; mark(); }
    if (t.dataset.rename !== undefined) { setName(t.dataset.rename, t.value.trim(), t.dataset.original); }
    if (t.id === "search" || t.id === "shadeSearch") {
      const q = t.value.trim().toLowerCase();
      const sel = t.id === "search" ? "#rows .ad-row" : "#shadeList .ad-sw";
      document.querySelectorAll(sel).forEach((row) => {
        row.hidden = Boolean(q) && !row.dataset.search.includes(q);
      });
    }
    if (t.id === "newShadeName") refreshAddButton();
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.style !== undefined) {
      const [type, styleId] = t.dataset.style.split("|");
      DOC.styles[type] = DOC.styles[type] || {};
      const base = DOC.styles[type][styleId]
        || (STYLES[type].find((s) => s.id === styleId) || {}).ranges || [];
      const set = new Set(base);
      t.checked ? set.add(t.value) : set.delete(t.value);
      DOC.styles[type][styleId] = [...set];
      mark();
    }
    if (t.dataset.featured !== undefined) {
      const set = new Set(DOC.featured || FEATURED);
      t.checked ? set.add(t.value) : set.delete(t.value);
      DOC.featured = [...set];
      mark();
    }
    if (t.id === "newShadeFile") pickSwatch(t.files[0]);
  });

  let pending = null;   // the measured, resized swatch waiting to be added

  function refreshAddButton() {
    const ok = pending && $("#newShadeName") && $("#newShadeName").value.trim();
    if ($("#addShade")) $("#addShade").disabled = !ok;
  }

  async function pickSwatch(file) {
    pending = null;
    $("#shadeErr").textContent = "";
    $("#measured").innerHTML = "";
    refreshAddButton();
    if (!file) return;
    try {
      pending = await readSwatch(file);
      $("#measured").innerHTML =
        `<img src="${pending.preview}" alt="">
         <span class="ad-chip big" style="background:${pending.hex}"></span>
         <span class="ad-meta">Measured ${pending.hex}</span>`;
    } catch (err) {
      $("#shadeErr").textContent = err.message;
    }
    refreshAddButton();
  }

  async function addShade() {
    const name = $("#newShadeName").value.trim();
    const r = allRanges().find((x) => x.id === openRange);
    if (!name || !pending || !r) return;
    const stem = slugify(name);
    if (!stem) { $("#shadeErr").textContent = "That name can't be used — try letters and numbers."; return; }
    if (shadesOf(r).some((c) => slugify(c.name) === stem)) {
      $("#shadeErr").textContent = "There is already a shade with that name in this collection.";
      return;
    }

    $("#addShade").disabled = true;
    $("#shadeErr").textContent = "Uploading…";
    try {
      const res = await fetch(`../api/admin/photo?range=${encodeURIComponent(r.id)}&name=${encodeURIComponent(stem)}`,
        { method: "POST", headers: { "content-type": "image/jpeg" }, body: pending.blob });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "upload failed");

      const shade = { name, hex: pending.hex, file: stem };
      if (r.added) {
        DOC.ranges.find((x) => x.id === r.id).colours.push(shade);
      } else {
        DOC.extra[r.id] = DOC.extra[r.id] || [];
        DOC.extra[r.id].push(shade);
      }
      pending = null;
      mark();
      render();
    } catch (err) {
      $("#shadeErr").textContent = err.message;
      refreshAddButton();
    }
  }

  function createRange() {
    const name = $("#nrName").value.trim();
    const brand = $("#nrBrand").value.trim() || "Hari's Carpets";
    const type = $("#nrType").value;
    if (!name) { $("#nrErr").textContent = "Give the collection a name."; return; }
    if (!TYPES.some((t) => t.id === type)) { $("#nrErr").textContent = "Pick a flooring type."; return; }

    let id = slugify(brand + "-" + name);
    if (!id) { $("#nrErr").textContent = "That name can't be used — try letters and numbers."; return; }
    /* ids are permanent: saved shortlists and shared links are built from them,
       so a new collection must never land on one already in use */
    if (allRanges().some((r) => r.id === id)) id += "-" + Date.now().toString(36).slice(-4);

    DOC.ranges.push({ id, type, brand, name,
                      blurb: `${name} from ${brand}.`, colours: [] });
    mark();
    openRange = id;          // straight into adding its shades
    render();
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    const tabBtn = t.closest("[data-tab]");
    if (tabBtn) { tab = tabBtn.dataset.tab; openRange = null; return render(); }

    const shades = t.closest("[data-shades]");
    if (shades) { openRange = shades.dataset.shades; return render(); }
    if (t.id === "back") { openRange = null; return render(); }

    const hide = t.closest("[data-hide]");
    if (hide) { setHidden(hide.dataset.hide, !isHidden(hide.dataset.hide)); return render(); }

    if (t.id === "addRange") { $("#newRange").hidden = false; $("#nrName").focus(); return; }
    if (t.id === "cancelRange") { $("#newRange").hidden = true; $("#nrErr").textContent = ""; return; }
    if (t.id === "createRange") return createRange();
    if (t.id === "addShade") return addShade();
    if (t.id === "save") return save();
  });

  /* Signing in with the password. The password goes to the Worker once and is
     exchanged for a short-lived signed cookie — it is never kept in the page. */
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "login") return;
    e.preventDefault();
    const btn = $("#pwGo");
    btn.disabled = true;
    $("#pwErr").textContent = "";
    try {
      const res = await fetch("../api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: $("#adminPassword").value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        $("#pwErr").textContent = body.error || "Could not sign in.";
        btn.disabled = false;
        $("#adminPassword").select();
        return;
      }
      location.reload();
    } catch {
      $("#pwErr").textContent = "Could not reach the site. Check the connection.";
      btn.disabled = false;
    }
  });

  /* a half-finished change is easy to walk away from in a busy shop */
  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  /* -------------------------------------------------------------------- boot */

  /* What the Worker's refusal actually means, in words that point at the thing
     to change. Only the first is a normal day; the rest are setup faults. */
  const EXPLAIN = {
    "no token": "You'll be asked for your email address and sent a code."
      + " If you've just signed in and still see this, Cloudflare Access isn't"
      + " covering /admin yet — check the application's path in Zero Trust.",
    "wrong audience": "Sign-in worked, but the AUD tag deployed in wrangler.jsonc"
      + " doesn't match the Access application. Copy it again from the"
      + " application's overview page.",
    "wrong issuer": "Sign-in worked, but ACCESS_TEAM_DOMAIN doesn't match the"
      + " team that issued the token. It should look like"
      + " yourteam.cloudflareaccess.com, with no https:// and no trailing slash.",
    "unknown signing key": "Cloudflare's signing keys didn't include the one"
      + " that signed your token — usually ACCESS_TEAM_DOMAIN pointing at the"
      + " wrong team.",
    "no certificates": "Couldn't reach Cloudflare's signing keys for"
      + " ACCESS_TEAM_DOMAIN. Check it is spelled exactly as the team domain in"
      + " Zero Trust, with no https:// and no trailing slash.",
    expired: "Your session has run out. Reload the page to sign in again.",
    "bad signature": "That token failed its signature check. Reload to sign in again.",
  };

  function gate(title, body) {
    $("#gateTitle").textContent = title;
    $("#gateBody").textContent = body;
    $("#gate").hidden = false;
  }

  (async function start() {
    let who;
    try {
      who = await fetch("../api/admin/whoami", { headers: { accept: "application/json" } });
    } catch {
      return gate("Can't reach the site", "Check the connection and try again.");
    }
    if (who.status === 503) {
      const body = await who.json().catch(() => ({}));
      return gate("Sign-in isn't set up yet", body.error || "See docs/admin.md.");
    }
    if (who.status === 401) {
      /* The reason matters while Access is being set up. "Not signed in" and
         "your Access application's AUD tag doesn't match the one deployed" look
         identical from the outside, and the second is a ten-minute hunt if the
         page won't say which it is. */
      const body = await who.json().catch(() => ({}));

      /* Older builds of the Worker answered without a methods field at all.
         Saying so beats every other message here, because none of the advice
         below applies until the deploy has caught up. */
      if (!body.methods) {
        return gate("The site needs redeploying",
          "This copy of the Worker is older than the admin page and doesn't know"
          + " about password sign-in yet. Check the latest build finished in"
          + " Workers & Pages, then reload.");
      }

      const canPassword = body.methods.password;
      if (canPassword) {
        gate("Sign in to manage the site",
          body.methods.access
            ? "Enter the site password, or use the email sign-in if this address is behind Cloudflare Access."
            : "Enter the site password to make changes.");
        $("#login").hidden = false;
        $("#retry").hidden = true;
        $("#adminPassword").focus();
        /* A password box that never painted looks exactly like a feature we
           forgot to build, and "there's nowhere to enter the password" is not
           a thing anyone can act on. Content blockers and some password
           managers do remove fields; if that happens, say so. */
        requestAnimationFrame(() => {
          const box = $("#adminPassword");
          if (box && box.offsetHeight === 0) {
            $("#gateBody").textContent =
              "The password box is on this page but something in the browser is"
              + " hiding it — usually an ad or privacy extension. Try a private"
              + " window, or turn extensions off for this site.";
          }
        });
        return;
      }

      /* Access cannot guard a workers.dev address — it only covers hostnames in
         your own zones. Telling somebody to check their Zero Trust path here
         sends them after a setting that can never work. */
      if (/\.workers\.dev$/i.test(location.hostname)) {
        return gate("Set a site password to sign in here",
          "Cloudflare Access can't protect a workers.dev address — it only covers"
          + " hostnames in your own zones, preview URLs included. Add a secret"
          + " called ADMIN_PASSWORD in Workers & Pages → Settings → Variables and"
          + " Secrets (at least 12 characters). If you have already added it and"
          + " still see this, the running version was built before the secret"
          + " existed and cannot see it: redeploy from the Deployments tab, then"
          + " reload. Access will start working on its own once the shop's domain"
          + " points at this Worker.");
      }

      return gate("Sign in to manage the site",
        EXPLAIN[body.reason] || "You'll be asked for your email address and sent a code."
          + " If you've just signed in, reload the page.");
    }
    if (!who.ok) return gate("Something went wrong", "Status " + who.status);

    const me = await who.json().catch(() => ({}));
    $("#who").textContent = me.email || "";

    const res = await fetch("../api/site", { headers: { accept: "application/json" } });
    const site = res.ok ? await res.json() : {};
    DOC = { version: 0, content: {}, featured: null, styles: {},
            overrides: {}, ranges: [], extra: {}, ...site };
    // make sure the shapes exist even if the stored document is older
    for (const k of ["content", "styles", "overrides", "extra"]) DOC[k] = DOC[k] || {};
    DOC.ranges = DOC.ranges || [];

    render();
    $("#state").textContent = "";
  })();
})();
