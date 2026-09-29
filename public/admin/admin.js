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

  /* Must match MAX_RANGES in worker-admin.js. Shown on the Collections tab so
     the ceiling is visible long before it is hit. */
  const MAX_RANGES = 1200;
  /* Must match MAX_PORTFOLIO in worker-admin.js. */
  const MAX_PORTFOLIO = 200;

  /* the document we are editing */
  let DOC = null;
  let dirty = false;
  let tab = "shop";
  let openRange = null;   // which collection's shades are being edited
  let INBOX = null;       // the enquiries, once fetched
  let STATS = null;       // visitor numbers, once fetched
  let STATS_BUSY = false; // a request is already out for them
  let STATS_DAYS = 30;    // which range the tab is showing

  /* [key, label, current, big?, optional?]
     - `current` is what the site shows while the box is empty, so the faint
       grey text doubles as "what is on there now".
     - `big` gives a textarea instead of a single line.
     - `optional` adds a tick: untick it and the line disappears from the site
       altogether. Clearing the box and switching it off are two different
       things — clearing puts the shipped wording back, switching off shows
       nothing at all — so both are offered rather than one pretending to be
       the other. Switching off never throws away what is written: tick it
       back on and the words are exactly as they were.

     Deliberately NOT optional: the phone number, the email address and the
     address. Those are patched into every tel: and mailto: link on the page, so
     switching one off would leave invisible broken links in the header and the
     footer — and a flooring shop with no phone number on its website is not a
     feature anybody asked for. */
  const social = (id) => (SOCIALS.find((s) => s.id === id) || {}).url || "";

  const SHOP_FIELDS = [
    ["hours",   "Opening hours",  () => CONTACT.hours],
    ["phone",   "Phone number",   () => CONTACT.phone],
    ["email",   "Email address",  () => CONTACT.email],
    ["address", "Address — one line per line", () => CONTACT.address, 4],
    ["area",    "Areas you cover", () => CONTACT.area, false, true],
    ["tagline", "Line under the logo", () => BUSINESS.tagline, false, true],
    ["footerBlurb", "Footer paragraph", () => BUSINESS.blurbShort, true, true],
    ["notice",  "Notice across the top of the home page",
     () => "Leave empty for none — a bank holiday, a delivery delay"],
    /* Empty means no WhatsApp button on the site at all. It has to be the
       mobile number the WhatsApp account is on — the showroom landline will
       not work. */
    ["whatsapp", "WhatsApp number — shows a chat button on every page",
     () => "Leave empty for none — e.g. 07700 900123"],
    ["mapsUrl", "Link to your Google Maps listing", () => CONTACT.mapsUrl],
    ["mapEmbed", "Map embed address (Google Maps → Share → Embed a map)",
     () => CONTACT.mapEmbed, 3, true],
    ["socialInstagram", "Instagram page", () => social("instagram"), false, true],
    ["socialFacebook", "Facebook page", () => social("facebook"), false, true],
    ["socialTiktok", "TikTok page", () => social("tiktok"), false, true],
    ["socialTwitter", "X (Twitter) page", () => social("twitter"), false, true],
  ];

  const ABOUT_FIELDS = [
    ["aboutKicker", "Small label above the heading", () => ABOUT.kicker, false, true],
    ["aboutLead", "Opening line", () => ABOUT.lead, false, true],
    ["aboutBody", "About us", () => ABOUT.body.join("\n\n"), 12, true],
  ];

  /* Everything written on the home page, in the order it appears. */
  const HOME_FIELDS = [
    ["since", "Banner — small label above the heading",
     () => "Leave empty for none — the shop asked for this line off"],
    ["heroTitle", "Banner heading", () => "The flooring shop on Hanworth Road.", false, true],
    ["heroText", "Banner paragraph", () => HOME.heroText, true, true],
    ["heroCta", "Banner — first button", () => "Make an enquiry", false, true],
    ["heroCta2", "Banner — second button", () => "Explore our collections", false, true],
    ["proof1Bold", "Claim 1 — bold bit", () => "32 years", false, true],
    ["proof1", "Claim 1 — the rest", () => "family run", false, true],
    ["proof2Bold", "Claim 2 — bold bit", () => "Our own fitters", false, true],
    ["proof2", "Claim 2 — the rest", () => "— not subcontractors", false, true],
    ["proof3Bold", "Claim 3 — bold bit", () => "Free", false, true],
    ["proof3", "Claim 3 — the rest", () => "home measure & plan", false, true],
    ["proof4Bold", "Claim 4 — bold bit", () => "Old flooring", false, true],
    ["proof4", "Claim 4 — the rest", () => "lifted & taken away", false, true],
    ["typesHeading", "Flooring types heading", () => "Every floor, one showroom", false, true],
    ["typesText", "Flooring types paragraph", () => HOME.typesText, true, true],
    ["instaKicker", "Instagram — small label", () => "On Instagram", false, true],
    ["instaHeading", "Instagram heading", () => "Recent work", false, true],
    ["instaText", "Instagram paragraph", () => HOME.instaText, true, true],
    ["serviceKicker", "Installation — small label", () => "How we work", false, true],
    ["serviceHeading", "Installation heading", () => "Supplied and installed, properly", false, true],
    ["serviceText", "Installation paragraph", () => HOME.serviceText, true, true],
    ["serviceCta", "Installation — button", () => "Discuss your project", false, true],
    ["familyKicker", "Family run — small label",
     () => "Family-run for over 32 years", false, true],
    ["familyHeading", "Family run — heading", () => HOME.familyHeading, false, true],
    ["familyText", "Family run — paragraph", () => HOME.familyText, true, true],
    ["familyCta", "Family run — button", () => "Discover our story →", false, true],
  ];

  /* The four cards under the fitting section. Emptying a heading takes that
     card off the row, which is how a service is removed without us. */
  const SERVICE_FIELDS = SERVICES.flatMap((s, i) => [
    ["service" + (i + 1) + "Title", `Card ${i + 1} — heading`, () => s.title, false, true],
    ["service" + (i + 1) + "Body", `Card ${i + 1} — wording`, () => s.body, false, true],
  ]);

  /* The other pages. The two collections keys are still named "catalogue*":
     the page was renamed, but the saved key is what anything already typed
     into those boxes is stored under, so renaming it would throw that away. */
  const PAGE_FIELDS = [
    ["catalogueKicker", "Collections — small label", () => "Everything we supply", false, true],
    ["catalogueHeading", "Collections heading", () => "Our collections", false, true],
    ["catalogueText", "Collections paragraph", () => PAGES.catalogueText, true, true],
    ["visitKicker", "Visit us — small label",
     () => "Come in, or we'll come to you", false, true],
    ["visitHeading", "Visit us heading", () => "Visit Our Showroom", false, true],
    ["visitText", "Visit us paragraph", () => PAGES.visitText, true, true],
    /* The same box as on Shop details, deliberately. The words appear on the
       Visit us page, so the switch that removes them belongs on the tab for
       that page as well as the one where the address lives. */
    ["area", "Areas you cover — shown as its own line on Visit us",
     () => CONTACT.area, false, true],
    ["visitCta", "Visit us — button", () => "Send an enquiry", false, true],
    ["mapHeading", "Map heading", () => "Find us", false, true],
    ["mapText", "Under the map heading",
     () => "Two minutes from Hounslow West, with parking on Hanworth Road.", false, true],
    ["enquireKicker", "Contact us — small label",
     () => "No pressure, no obligation", false, true],
    ["enquireHeading", "Contact us heading", () => "Get in Touch", false, true],
    ["enquireText", "Contact us paragraph", () => PAGES.enquireText, true, true],
  ];

  /* The form's own wording. Where enquiries go is not a box: they go to the
     Enquiries tab, and that is the whole point of the arrangement. */
  const FORM_FIELDS = [
    ["formHeading", "Form heading", () => "Submit an enquiry"],
    ["formCta", "Send button", () => "Send enquiry"],
    ["formThanks", "What they see after sending",
     () => "We've got your message. We usually come back the same day, or the next working day."],
  ];

  const PORTFOLIO_FIELDS = [
    ["portfolioKicker", "Portfolio — small label", () => "Our work", false, true],
    ["portfolioHeading", "Portfolio heading", () => "Recently installed", false, true],
    ["portfolioText", "Portfolio paragraph", () => PAGES.portfolioText, true, true],
    ["portfolioCta", "Portfolio — button", () => "Discuss your project", false, true],
  ];

  /* Repeated on the tab for the page they show on. "We can't update the hours"
     turned out to mean "the box is on a different tab from the page I was
     looking at" — same key, so these are the same box, not a copy of it. */
  const ALSO_ON_PAGES = [
    ["hours", "Opening hours", () => CONTACT.hours],
    ["area", "Areas you cover", () => CONTACT.area, false, true],
  ];

  const TABS = [
    ["enquiries", "Enquiries"],
    ["shop", "Shop details"],
    ["about", "About us"],
    ["home", "Home page"],
    ["pages", "Other pages"],
    ["portfolio", "Portfolio"],
    ["collections", "Collections"],
    ["photos", "Photos"],
    ["styles", "Styles"],
    ["visitors", "Visitors"],
  ];

  /* How wide an uploaded photograph is kept. A swatch only ever shows as a
     small tile, but a home page banner runs the width of the screen. */
  const WIDE = 1800, TILE = 900;

  /* ---------------------------------------------------------------- state */

  function mark() {
    dirty = true;
    $("#save").disabled = false;
    $("#state").textContent = "Unsaved changes";
    $("#state").className = "mg-state warn";
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
  function readSwatch(file, maxWidth = TILE) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(new Error("could not read that file"));
      fr.onload = () => {
        const im = new Image();
        im.onerror = () => reject(new Error("that file is not an image"));
        im.onload = () => {
          const w = Math.min(maxWidth, im.naturalWidth);
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

  const isOff = (key) => DOC.off?.[key] === true;

  /* What the site is actually showing for a key right now — what the shop has
     typed, or the shipped wording. The same rule as say() in app.js, so a
     heading printed in the admin matches the heading on the page. */
  const said = (key, fallback) => {
    if (isOff(key)) return "";
    const v = DOC.content?.[key];
    return (typeof v === "string" && v.trim()) ? v.trim() : fallback;
  };

  function fields(list) {
    return `<div class="mg-fields">
      ${list.map(([k, label, current, big, optional]) => {
        const off = optional && isOff(k);
        /* `big` can be a row count. A one-sentence paragraph in a ten-row box
           looks like the wrong box; the About text in a four-row one is a
           scrollbar to write in. */
        const box = big
          ? `<textarea rows="${typeof big === "number" ? big : 4}" data-content="${esc(k)}"
               placeholder="${esc(current())}"${off ? " disabled" : ""}>${esc(DOC.content[k] || "")}</textarea>`
          : `<input type="text" data-content="${esc(k)}" value="${esc(DOC.content[k] || "")}"
               placeholder="${esc(current())}"${off ? " disabled" : ""}>`;
        return `
        <div class="mg-field${off ? " mg-off" : ""}">
          <label><span>${esc(label)}</span>${box}</label>
          ${optional ? `<label class="mg-tick mg-show">
            <input type="checkbox" data-off="${esc(k)}"${off ? "" : " checked"}>
            <span>Show this on the website</span>
          </label>` : ""}
        </div>`;
      }).join("")}
    </div>`;
  }

  /* The two things a box can mean, said once, at the top of every tab that has
     ticks on it. */
  const BLANKING = `<p class="mg-lede">Clearing a box puts the original wording back.
    To show <em>nothing at all</em>, untick "Show this on the website" — what you have
    written stays put, so ticking it back on brings it straight back.</p>`;

  function viewShop() {
    return `
    <h2>Shop details</h2>
    <p class="mg-lede">These show all over the website. The faint text in a box is what's
      on there at the moment — type over it to change it, or clear the box to put it back.</p>
    ${BLANKING}
    ${fields(SHOP_FIELDS)}`;
  }

  function viewAbout() {
    return `
    <h2>About us</h2>
    <p class="mg-lede">This is the About page, and the opening line is on the home page too.
      Leave a blank line between paragraphs and they'll be laid out as paragraphs.
      The photographs on this page are under Photos.</p>
    ${fields(ABOUT_FIELDS)}`;
  }

  function viewPages() {
    const types = TYPES.map((t) => [
      "type-" + t.id, `${t.name} — description`, () => t.blurb, 3, true]);
    return `
    <h2>Other pages</h2>
    <p class="mg-lede">Headings and wording on Collections, Visit us and Contact us.</p>
    ${BLANKING}
    ${fields(PAGE_FIELDS)}

    <h3 class="mg-photo-head">Also shown on these pages</h3>
    <p class="mg-lede">The same boxes as on Shop details — change either one.</p>
    ${fields(ALSO_ON_PAGES)}

    <h3 class="mg-photo-head">Flooring types</h3>
    <p class="mg-lede">The description under each type, on the Collections page.</p>
    ${fields(types)}`;
  }

  function viewCollections() {
    if (openRange) return viewShades(openRange);
    const list = allRanges();
    const added = (DOC.ranges || []).length;
    const shades = list.reduce((n, r) => n + shadesOf(r).length, 0);
    return `
    <h2>Collections</h2>
    <p class="mg-lede">Hiding a collection takes it off the website. Nothing is deleted, so
      anything a customer has saved keeps working, and you can put it back at any time.</p>
    ${/* The ceiling, in view before it is reached. It was reached once with
          nothing said, and every collection added after that was thrown away
          on save while the admin reported success. */""}
    <p class="mg-lede"><b>${list.length}</b> collections on the site, <b>${shades}</b> shades.
      ${added} of them added here${added > MAX_RANGES * 0.8
        ? ` — the limit is ${MAX_RANGES}. Tell whoever looks after the site before you reach it.`
        : `. There is room for ${MAX_RANGES} added collections.`}</p>
    <button class="btn btn-solid btn-sm" id="addRange">Add a collection</button>
    <input class="mg-search" id="search" type="search" placeholder="Search collections…">

    <div class="mg-newrange" id="newRange" hidden>
      <h3>New collection</h3>
      <div class="mg-addrow">
        <label class="mg-field"><span>Collection name</span>
          <input type="text" id="nrName" placeholder="e.g. Highland Twist"></label>
        <label class="mg-field"><span>Brand</span>
          <input type="text" id="nrBrand" placeholder="e.g. Cormar Carpets"></label>
        <label class="mg-field"><span>Type of flooring</span>
          <select id="nrType">${TYPES.map((t) =>
            `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label>
        <button class="btn btn-solid btn-sm" id="createRange">Create</button>
        <button class="btn btn-ghost btn-sm" id="cancelRange">Cancel</button>
      </div>
      <p class="mg-err" id="nrErr"></p>
    </div>
    <div class="mg-rows" id="rows">
      ${list.map((r) => {
        const hidden = isHidden(r.id);
        const n = shadesOf(r).filter((c) => !isHidden(r.id + ":" + slugify(c.name))).length;
        return `<div class="mg-row${hidden ? " off" : ""}" data-search="${esc((r.name + " " + r.brand).toLowerCase())}">
          <div class="mg-row-main">
            <b>${esc(DOC.overrides[r.id]?.name || r.name)}</b>
            <span class="mg-meta">${esc(r.brand)} · ${esc(r.type)} · ${n} shade${n === 1 ? "" : "s"}${
              r.added ? ' · <span class="mg-badge">added here</span>' : ""}</span>
          </div>
          <div class="mg-row-acts">
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
    <p class="mg-back"><button class="linkish" id="back">← All collections</button></p>
    <h2>${esc(DOC.overrides[r.id]?.name || r.name)}</h2>
    <p class="mg-lede">${esc(r.brand)} · ${shades.length} shade${shades.length === 1 ? "" : "s"}.
      Hide a shade that's out of stock; it stays saved for anyone who shortlisted it.</p>

    <label class="mg-field" style="max-width:70ch;margin-bottom:22px">
      <span>What this collection is</span>
      <textarea rows="3" data-blurb="${esc(r.id)}"
        placeholder="${esc(r.blurb || "")}">${esc(DOC.overrides[r.id]?.blurb || "")}</textarea>
    </label>

    <div class="mg-addshade">
      <h3>Add a shade</h3>
      <p>Photograph the swatch flat, filling the frame, in daylight. The colour is
         measured from your photo — you don't need to know a colour code.</p>
      <div class="mg-addrow">
        <label class="mg-field"><span>Shade name</span>
          <input type="text" id="newShadeName" placeholder="e.g. Oatmeal"></label>
        <label class="mg-field"><span>Photograph of the swatch</span>
          <input type="file" id="newShadeFile" accept="image/*"></label>
        <div class="mg-measured" id="measured"></div>
        <button class="btn btn-solid btn-sm" id="addShade" disabled>Add shade</button>
      </div>
      <p class="mg-err" id="shadeErr"></p>
    </div>

    ${shades.length > 12
      ? `<input class="mg-search" id="shadeSearch" type="search" placeholder="Find a shade…">`
      : ""}

    <div class="mg-swatches" id="shadeList">
      ${shades.map((c) => {
        const key = r.id + ":" + slugify(c.name);
        const hidden = isHidden(key);
        const shown = DOC.overrides[key]?.name || c.name;
        return `<div class="mg-sw${hidden ? " off" : ""}" data-search="${esc(shown.toLowerCase())}">
          <span class="mg-chip" style="background:${esc(c.hex)}"></span>
          <input type="text" value="${esc(shown)}" data-rename="${esc(key)}"
                 data-original="${esc(c.name)}" aria-label="Shade name">
          <button class="btn btn-ghost btn-sm" data-hide="${esc(key)}">${hidden ? "Show" : "Hide"}</button>
        </div>`;
      }).join("") || `<p class="mg-lede">No shades yet.</p>`}
    </div>`;
  }

  /* ------------------------------------------------------------------ photos */

  /* Where a slot's picture is coming from right now: what the shop uploaded,
     or what the site was built with. */
  function currentImage(slot, fallback) {
    const own = DOC.images?.[slot];
    /* Root-absolute, both of them. The site's own picture paths became
       root-absolute when the pages became real addresses, and the admin sits
       at /admin/ — so prefixing "../" to a path that already starts with a
       slash produced "..//assets/…" and the preview quietly removed itself
       (the img carries onerror="this.remove()"). */
    return { src: own ? "/assets/" + own : fallback, replaced: Boolean(own) };
  }

  function photoCard(slot, title, note, fallback, altFallback) {
    const { src, replaced } = currentImage(slot, fallback);
    return `<div class="mg-photo">
      <div class="mg-photo-img"><img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()"></div>
      <div class="mg-photo-body">
        <b>${esc(title)}</b>
        <span class="mg-meta">${esc(note)}</span>
        <input type="text" class="mg-iglink" data-caption="${esc(slot)}"
               value="${esc((DOC.captions || {})[slot] || "")}"
               placeholder="${esc(altFallback || "Describe the picture")}"
               aria-label="Caption for ${esc(title)}">
        <label class="mg-replace">
          <input type="file" accept="image/*" data-slot="${esc(slot)}">
          <span class="btn btn-ghost btn-sm">Replace</span>
        </label>
        ${replaced ? `<button class="linkish" data-revert="${esc(slot)}">Use the original</button>` : ""}
        <span class="mg-photo-state" data-state="${esc(slot)}"></span>
      </div>
    </div>`;
  }

  function viewPhotos() {
    const ranges = allRanges().filter((r) => !isHidden(r.id));
    return `
    <h2>Photos</h2>
    <p class="mg-lede">Your own pictures of real jobs beat stock photography every time.
      Landscape works best. Big files are fine — they're shrunk here before uploading.
      The box under each one describes the picture: it is what a blind visitor hears
      and what Google reads, so say what is in it rather than "photo".</p>

    <h3 class="mg-photo-head">Around the site</h3>
    <div class="mg-photos">
      ${IMG_SLOTS.map(([slot, title, note]) =>
        photoCard(slot, title, note, IMG[slot], title)).join("")}
    </div>

    <h3 class="mg-photo-head">Style tiles</h3>
    <p class="mg-lede">The big pictures on "what sort of carpet are you after?". Until one is
      uploaded a style borrows a photograph from the first collection under it — and a style
      whose collections have no photograph shows an empty frame, which is what this fixes.</p>
    <div class="mg-photos">
      ${Object.keys(STYLES).filter((t) => STYLES[t].length).flatMap((type) =>
        STYLES[type].map((st) => {
          const borrowed = (allRanges().find((r) => (DOC.styles?.[type]?.[st.id] || st.ranges)
            .includes(r.id) && r.photo) || {}).photo;
          return photoCard(`style-${type}-${st.id}`,
            said(`styleName-${type}-${st.id}`, st.name),
            (TYPES.find((t) => t.id === type) || {}).name || type,
            borrowed || "",
            said(`styleName-${type}-${st.id}`, st.name));
        })).join("")}
    </div>

    <h3 class="mg-photo-head">Collections</h3>
    <p class="mg-lede">Most collections show a stand-in photograph because the mill didn't
      send one. A picture of that carpet fitted in a real room is worth far more.</p>
    <input class="mg-search" id="photoSearch" type="search" placeholder="Find a collection…">
    <div class="mg-photos" id="photoRows">
      ${ranges.map((r) => `<div data-search="${esc((r.name + " " + r.brand).toLowerCase())}">
        ${photoCard("range:" + r.id, DOC.overrides[r.id]?.name || r.name,
                    r.brand, r.photo, r.alt || r.name)}
      </div>`).join("")}
    </div>`;
  }

  /* A style's own wording. The key carries the floor type as well as the style
     because "herringbone" exists under both Wood and LVT, and renaming one of
     them must not rename the other. Matches styleRef() in app.js. */
  const styleFields = (type, st) => [
    [`styleName-${type}-${st.id}`, "What this style is called", () => st.name],
    [`styleText-${type}-${st.id}`, "The line under the name", () => st.blurb, 2],
  ];

  function viewStyles() {
    const types = Object.keys(STYLES).filter((t) => STYLES[t].length);
    return `
    <h2>Styles</h2>
    <p class="mg-lede">This is what customers see first — "what sort of carpet are you after?".
      Tick the collections that belong under each. A collection in no style still
      appears everywhere else on the site, so it's safe to untick one you're unsure of.</p>
    ${BLANKING}
    ${types.map((type) => `
      <section class="mg-styleblock">
        <h3>${esc((TYPES.find((t) => t.id === type) || {}).name || type)}</h3>
        ${fields([[`styleHead-${type}`, "Heading above these on the "
          + ((TYPES.find((t) => t.id === type) || {}).name || type) + " page",
          () => `What sort of ${((TYPES.find((t) => t.id === type) || {}).name || type).toLowerCase()} are you after?`,
          false, true]])}
        ${STYLES[type].map((st) => {
          const chosen = DOC.styles?.[type]?.[st.id] || st.ranges;
          const options = allRanges().filter((r) => r.type === type);
          /* A style with nothing filed under it does not appear on the site at
             all — it would be a tile promising 0 shades. Its wording boxes are
             left out rather than shown, because a box that cannot change
             anything is the bug this whole tab came out of. */
          const live = chosen.length > 0;
          return `<div class="mg-style" data-style-block="${esc(type)}|${esc(st.id)}">
            <div class="mg-style-head"><b>${esc(said(`styleName-${type}-${st.id}`, st.name))}</b>
              <span class="mg-meta">${esc(said(`styleText-${type}-${st.id}`, st.blurb))}</span></div>
            ${live ? fields(styleFields(type, st))
              : `<p class="mg-lede">Nothing is filed under this one yet, so it is not on the
                 site. Tick a collection below and its wording appears here.</p>`}
            <div class="mg-ticks">
              ${options.map((r) => `<label class="mg-tick">
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
    const rev = DOC.reviews || { rating: "", count: "", url: "", items: [] };
    const ig = DOC.instagram || { url: "", posts: [] };
    return `
    <h2>Home page</h2>
    <p class="mg-lede">Every word on the front page. The faint text is what is on there now.</p>
    ${BLANKING}
    ${fields(HOME_FIELDS)}

    <h3 class="mg-photo-head">The four service cards</h3>
    <p class="mg-lede">The row under the installation section. Clear a heading and that card
      comes off the row.</p>
    ${fields(SERVICE_FIELDS)}

    <h3 class="mg-photo-head">Google reviews</h3>
    <p class="mg-lede">Copy your rating and a few of your best reviews across from your Google
      listing. Leave it all blank and the strip doesn't appear at all.
      <strong>Only paste in reviews people have actually left you.</strong></p>
    <div class="mg-addrow">
      <label class="mg-field" style="min-width:120px"><span>Rating</span>
        <input type="text" data-rev="rating" value="${esc(rev.rating)}" placeholder="4.9"></label>
      <label class="mg-field" style="min-width:140px"><span>How many</span>
        <input type="text" data-rev="count" value="${esc(rev.count)}" placeholder="37"></label>
      <label class="mg-field" style="min-width:280px"><span>Link to your Google listing</span>
        <input type="text" data-rev="url" value="${esc(rev.url)}" placeholder="https://…"></label>
    </div>
    <div class="mg-quotes" id="quotes">
      ${[...rev.items, {}, {}, {}]
        .slice(0, Math.max(3, rev.items.length + 1)).map((it, i) => `
        <div class="mg-quote">
          <label class="mg-field"><span>Review ${i + 1}</span>
            <textarea rows="3" data-quote="${i}" data-part="text"
              placeholder="What they wrote">${esc(it.text)}</textarea></label>
          <div class="mg-addrow">
            <label class="mg-field" style="min-width:130px"><span>Who wrote it</span>
              <input type="text" data-quote="${i}" data-part="name" value="${esc(it.name)}"
                placeholder="First name"></label>
            <label class="mg-field" style="min-width:70px"><span>Stars</span>
              <input type="text" data-quote="${i}" data-part="stars" value="${esc(it.stars || "")}"
                placeholder="5"></label>
            <label class="mg-field" style="min-width:110px"><span>When</span>
              <input type="text" data-quote="${i}" data-part="when" value="${esc(it.when || "")}"
                placeholder="13 days ago"></label>
          </div>
        </div>`).join("")}
    </div>

    <h3 class="mg-photo-head">Instagram</h3>
    <p class="mg-lede">Pick your best posts: upload the picture and paste the link to the post.
      Eight fit the row neatly. Leave it empty and the section doesn't appear.</p>
    <p class="mg-feed" id="igStatus">Checking the live feed\u2026</p>
    <label class="mg-field" style="max-width:420px"><span>Your Instagram page</span>
      <input type="text" data-ig="url" value="${esc(ig.url)}" placeholder="https://www.instagram.com/hariscarpets/"></label>
    <div class="mg-photos" style="margin-top:18px">
      ${[...ig.posts, {}].slice(0, 12).map((p, i) => `
        <div class="mg-photo">
          <div class="mg-photo-img">${p.image
            ? `<img src="/assets/${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
          <div class="mg-photo-body">
            <b>${p.image ? `Post ${i + 1}` : "Add a post"}</b>
            <input type="text" class="mg-iglink" data-igpost="${i}" value="${esc(p.link || "")}"
                   placeholder="Link to the post">
            <label class="mg-replace">
              <input type="file" accept="image/*" data-igfile="${i}">
              <span class="btn btn-ghost btn-sm">${p.image ? "Replace" : "Choose picture"}</span>
            </label>
            ${p.image ? `<button class="linkish" data-igdrop="${i}">Remove</button>` : ""}
            <span class="mg-photo-state" data-state="ig-${i}"></span>
          </div>
        </div>`).join("")}
    </div>`;
  }

  /* Jobs you have finished. Same shape as the Instagram picker above, because
     it is the same job — a picture, some words, and a blank one on the end
     waiting to be filled in. */
  function viewPortfolio() {
    const items = DOC.portfolio || [];
    return `
    <h2>Portfolio</h2>
    <p class="mg-lede">Your own photographs of floors you have installed. Landscape works best,
      and big files are fine — they're shrunk here before uploading. Nothing is shipped with
      the site for this page, so what you put here is what is on it.
      <b>${items.length}</b> added${items.length > MAX_PORTFOLIO * 0.8
        ? ` — the limit is ${MAX_PORTFOLIO}.` : `, and there is room for ${MAX_PORTFOLIO}.`}</p>
    ${fields(PORTFOLIO_FIELDS)}

    <h3 class="mg-photo-head">The pictures</h3>
    <p class="mg-lede">The heading is what shows under the photograph, and the description
      below it. Both are optional — a picture on its own is fine.</p>
    <div class="mg-photos" style="margin-top:18px">
      ${[...items, {}].slice(0, 24).map((p, i) => `
        <div class="mg-photo">
          <div class="mg-photo-img">${p.image
            ? `<img src="/assets/${esc(p.image)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
          <div class="mg-photo-body">
            <b>${p.image ? `Job ${i + 1}` : "Add a job"}</b>
            <input type="text" class="mg-iglink" data-folio="${i}" data-part="title"
                   value="${esc(p.title || "")}" placeholder="Where, or what it is">
            <input type="text" class="mg-iglink" data-folio="${i}" data-part="caption"
                   value="${esc(p.caption || "")}" placeholder="A line about the job">
            <label class="mg-replace">
              <input type="file" accept="image/*" data-foliofile="${i}">
              <span class="btn btn-ghost btn-sm">${p.image ? "Replace" : "Choose picture"}</span>
            </label>
            ${p.image ? `<button class="linkish" data-foliodrop="${i}">Remove</button>` : ""}
            <span class="mg-photo-state" data-state="folio-${i}"></span>
          </div>
        </div>`).join("")}
    </div>`;
  }

  /* ------------------------------------------------------------- enquiries */

  const when = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      + " at " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  /* Replying opens the shop's own mail client, addressed to the customer, with
     what they wrote quoted underneath. No mail is sent from the website, so
     there is nothing to configure and nothing to land in a spam folder. */
  function replyLink(e) {
    const subject = "Re: your enquiry — Hari's Carpets";
    const body = "\n\n\n---\nYou wrote on " + when(e.at) + ":\n"
      + String(e.message || "").split("\n").map((l) => "> " + l).join("\n");
    return `mailto:${encodeURIComponent(e.email)}?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`;
  }

  function viewEnquiries() {
    if (!INBOX) return `<h2>Enquiries</h2><p class="mg-loading">Loading…</p>`;
    if (!INBOX.length) {
      return `
      <h2>Enquiries</h2>
      <p class="mg-lede">Nothing yet. Everything sent through the Contact us form lands
        here, newest first.</p>
      ${fields(FORM_FIELDS)}`;
    }
    return `
    <h2>Enquiries</h2>
    <p class="mg-lede">Everything sent through the Contact us form, newest first.
      <strong>Reply</strong> opens your own email with their address already in it.
      Nothing is emailed to you automatically, so it is worth looking here daily.
      Enquiries you leave are deleted after twelve months.</p>
    <div class="mg-enq">
      ${INBOX.map((e) => `
        <article class="mg-enq-item${e.read ? "" : " unread"}">
          <div class="mg-enq-head">
            <b>${esc(e.name || "No name")}</b>
            <span class="mg-meta">${esc(when(e.at))}</span>
            ${e.topic ? `<span class="mg-badge">${esc(e.topic)}</span>` : ""}
            ${e.read ? "" : `<span class="mg-badge new">New</span>`}
          </div>
          <div class="mg-enq-who">
            <a href="mailto:${esc(e.email)}">${esc(e.email)}</a>
            ${e.phone ? `<a href="tel:${esc(e.phone.replace(/[^\d+]/g, ""))}">${esc(e.phone)}</a>` : ""}
          </div>
          ${e.message ? `<p class="mg-enq-msg">${esc(e.message)}</p>`
            : `<p class="mg-enq-msg mg-meta">(no message)</p>`}
          <div class="mg-enq-acts">
            <a class="btn btn-solid btn-sm" href="${esc(replyLink(e))}">Reply</a>
            <button class="btn btn-ghost btn-sm" data-enqread="${esc(e.id)}"
              >${e.read ? "Mark unread" : "Mark read"}</button>
            <button class="linkish" data-enqdrop="${esc(e.id)}">Delete</button>
          </div>
        </article>`).join("")}
    </div>

    <h3 class="mg-photo-head">The form itself</h3>
    ${fields(FORM_FIELDS)}`;
  }

  async function loadInbox() {
    try {
      const res = await fetch("../api/admin/enquiries", { headers: { accept: "application/json" } });
      const body = await res.json();
      INBOX = body.enquiries || [];
    } catch { INBOX = []; }
    paintUnread();
    if (tab === "enquiries") render();
  }

  /* The count sits on the tab itself, on every screen. Nothing arrives to tell
     the shop an enquiry is waiting — this is the only thing that does. */
  function paintUnread() {
    const n = (INBOX || []).filter((e) => !e.read).length;
    const el = $("[data-tab='enquiries']");
    if (!el) return;
    el.innerHTML = "Enquiries" + (n ? ` <span class="mg-count">${n}</span>` : "");
  }

  async function enquiryAction(id, method, extra = "") {
    try {
      await fetch(`../api/admin/enquiries?id=${encodeURIComponent(id)}${extra}`, { method });
    } catch { /* the reload below will show what actually happened */ }
    await loadInbox();
    render();
  }

  /* What the last save refused, across the top of the page until it is dealt
     with or the next clean save clears it. Not a line in the status area: that
     is one line of small text beside a button, and this is work the shop has
     lost. */
  function showDropped(list) {
    const box = $("#dropped");
    if (!box) return;
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = `<b>These did not save:</b><ul>${
      list.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p>Everything else saved. Fix these and press Save changes again — nothing
      you have typed has been lost from this screen.</p>`;
  }

  /* ------------------------------------------------------------------ visitors */

  /* A bar per day, drawn in CSS. No charting library: this admin has no
     dependencies at all, and a row of divs with a height in percent is the
     whole of what a "how was last week" chart needs to be. */
  function chart(daily) {
    if (!daily.length) return "";
    const top = Math.max(...daily.map((d) => d.views), 1);
    const day = (iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB",
        { day: "numeric", month: "short" });
    };
    return `<div class="mg-chart">${daily.map((d) => `
      <div class="mg-bar" title="${esc(day(d.date))}: ${d.views} page views, ${d.visits} visits">
        <i style="height:${Math.round((d.views / top) * 100)}%"></i>
      </div>`).join("")}</div>
      <p class="mg-meta">${esc(day(daily[0].date))} to ${esc(day(daily[daily.length - 1].date))}</p>`;
  }

  /* One list: pages, countries, whatever. Bars rather than bare numbers,
     because "42" means nothing without the 310 next to it. */
  function table(title, list, note) {
    if (!list.length) return `<div class="mg-stat-list"><h3>${esc(title)}</h3>
      <p class="mg-meta">Nothing yet.</p></div>`;
    const top = Math.max(...list.map((r) => r.views), 1);
    return `<div class="mg-stat-list">
      <h3>${esc(title)}</h3>
      ${note ? `<p class="mg-meta">${esc(note)}</p>` : ""}
      ${list.map((r) => `<div class="mg-stat-row">
        <span class="mg-stat-name">${esc(r.name)}</span>
        <span class="mg-stat-bar"><i style="width:${Math.round((r.views / top) * 100)}%"></i></span>
        <span class="mg-stat-n">${r.views}</span>
      </div>`).join("")}
    </div>`;
  }

  function viewVisitors() {
    const head = `<h2>Visitors</h2>
      <div class="mg-range">
        ${[7, 30, 90].map((n) => `<button class="mg-tab${STATS_DAYS === n ? " on" : ""}"
          data-days="${n}">Last ${n} days</button>`).join("")}
      </div>`;

    if (!STATS) return `${head}<p class="mg-loading">Loading…</p>`;

    if (!STATS.configured || STATS.reason) {
      return `${head}
      <div class="mg-dropped" style="display:block">
        <b>${STATS.configured ? "Visitor numbers are not working" : "Not switched on yet"}</b>
        <p>${esc(STATS.reason || "")}</p>
        <p>See the "Counting visitors" section of docs/admin.md.</p>
      </div>`;
    }

    return `${head}
    <div class="mg-figures">
      <div><b>${STATS.visits}</b><span>visits</span></div>
      <div><b>${STATS.views}</b><span>page views</span></div>
      <div><b>${STATS.daily.length ? Math.round(STATS.views / STATS.daily.length) : 0}</b>
        <span>page views a day</span></div>
    </div>
    ${chart(STATS.daily)}
    <div class="mg-stats">
      ${table("Most looked at", STATS.pages)}
      ${table("Where they were", STATS.countries, "Country only — from the network, not a location")}
      ${table("How they got here", STATS.referers, "Blank means typed in or from a bookmark")}
      ${table("On what", STATS.devices)}
    </div>
    <p class="mg-lede" style="margin-top:22px">Counted without cookies and without
      following anyone between websites, which is why this site needs no cookie banner.
      Nothing here identifies a person.</p>`;
  }

  /* The guard is load-bearing. render() asks for the numbers when it has none,
     and this function ends by rendering — so without it, one visit to the tab
     was render → load → render → load until the stack gave out. */
  async function loadStats() {
    if (STATS_BUSY) return;
    STATS_BUSY = true;
    try {
      const res = await fetch(`../api/admin/visitors?days=${STATS_DAYS}`,
        { headers: { accept: "application/json" } });
      STATS = await res.json();
    } catch {
      STATS = { configured: true, reason: "Could not reach the website's own API." };
    } finally {
      STATS_BUSY = false;
    }
    if (tab === "visitors") render();
  }

  /* ------------------------------------------------------------------ render */

  function render() {
    $("#tabs").innerHTML = TABS.map(([id, label]) =>
      `<button class="mg-tab${tab === id ? " on" : ""}" data-tab="${id}">${esc(label)}</button>`).join("");
    $("#panel").innerHTML =
      tab === "enquiries" ? viewEnquiries()
      : tab === "shop" ? viewShop()
      : tab === "about" ? viewAbout()
      : tab === "pages" ? viewPages()
      : tab === "portfolio" ? viewPortfolio()
      : tab === "collections" ? viewCollections()
      : tab === "photos" ? viewPhotos()
      : tab === "styles" ? viewStyles()
      : tab === "visitors" ? viewVisitors()
      : viewHome();
    if (tab === "home") showFeedStatus();
    if (tab === "visitors" && STATS === null && !STATS_BUSY) loadStats();
    paintUnread();
    if (INBOX === null) loadInbox();
  }

  /* Whether the live Instagram feed is actually working, in words, on the page
     where somebody would go looking. Without this the only way to tell is to
     type an API address into a browser and read raw JSON, which is not a thing
     to ask of a carpet shop — and "the grid is empty" has four causes that are
     fixed in four different places. The token is never in this answer. */
  async function showFeedStatus() {
    const el = $("#igStatus");
    if (!el) return;
    const set = (text, kind) => {
      if (!$("#igStatus")) return;          // tab changed while we were waiting
      $("#igStatus").textContent = text;
      $("#igStatus").className = "mg-feed " + kind;
    };
    try {
      const res = await fetch("../api/instagram", { headers: { accept: "application/json" } });
      const body = await res.json();
      if (body.posts && body.posts.length) {
        set(`Live feed working \u2014 ${body.posts.length} post${
          body.posts.length === 1 ? "" : "s"} straight from Instagram${
          body.stale ? ", though Instagram is not answering just now so these are the last ones we saw" : ""
        }. The posts you pick below are only used if the feed stops.`, "ok");
        return;
      }
      if (body.configured === false) {
        set("Live feed off \u2014 no access token has reached the site yet. Until one does, "
          + "the section shows whichever posts you pick below.", "warn");
        return;
      }
      const why = String(body.reason || "the site couldn't get any posts from Instagram").trim();
      set("Live feed not working \u2014 " + why + (/[.!?]$/.test(why) ? "" : ".")
        + " The section shows whichever posts you pick below in the meantime.", "warn");
    } catch {
      set("Couldn't check the live feed just now.", "warn");
    }
  }

  /* ------------------------------------------------------------------ saving */

  async function save() {
    const btn = $("#save");
    btn.disabled = true;
    $("#state").textContent = "Saving…";
    $("#state").className = "mg-state";
    try {
      const res = await fetch("../api/admin/site", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...DOC, baseVersion: DOC.version }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        $("#state").textContent = "Someone else saved first — reload before editing";
        $("#state").className = "mg-state warn";
        btn.disabled = false;
        return;
      }
      if (!res.ok) throw new Error(body.error || ("save failed (" + res.status + ")"));
      DOC.version = body.version;
      dirty = false;
      /* Everything the Worker refused. It used to refuse silently — the 201st
         collection went in the bin and this line still said "Saved" — so the
         shop uploaded for weeks into something that was throwing the work
         away. A save that lost something must never read as a clean one. */
      if (Array.isArray(body.dropped) && body.dropped.length) {
        $("#state").textContent = "Saved, but some of it did not go through";
        $("#state").className = "mg-state warn";
        showDropped(body.dropped);
        return;
      }
      showDropped([]);
      $("#state").textContent = "Saved — live on the site within a minute";
      $("#state").className = "mg-state ok";
    } catch (err) {
      $("#state").textContent = err.message;
      $("#state").className = "mg-state warn";
      btn.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ events */

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.content !== undefined) { DOC.content[t.dataset.content] = t.value; mark(); }
    if (t.dataset.rename !== undefined) { setName(t.dataset.rename, t.value.trim(), t.dataset.original); }
    if (t.id === "search" || t.id === "shadeSearch" || t.id === "photoSearch") {
      const q = t.value.trim().toLowerCase();
      const sel = t.id === "search" ? "#rows .mg-row"
        : t.id === "photoSearch" ? "#photoRows > div"
        : "#shadeList .mg-sw";
      document.querySelectorAll(sel).forEach((row) => {
        row.hidden = Boolean(q) && !row.dataset.search.includes(q);
      });
    }
    if (t.id === "newShadeName") refreshAddButton();

    if (t.dataset.caption !== undefined) {
      DOC.captions = DOC.captions || {};
      if (t.value.trim()) DOC.captions[t.dataset.caption] = t.value.trim();
      else delete DOC.captions[t.dataset.caption];
      mark();
    }
    if (t.dataset.blurb !== undefined) {
      const o = DOC.overrides[t.dataset.blurb] || {};
      if (t.value.trim()) o.blurb = t.value.trim(); else delete o.blurb;
      if (Object.keys(o).length) DOC.overrides[t.dataset.blurb] = o;
      else delete DOC.overrides[t.dataset.blurb];
      mark();
    }
    if (t.dataset.rev !== undefined) {
      DOC.reviews = DOC.reviews || { rating: "", count: "", url: "", items: [] };
      DOC.reviews[t.dataset.rev] = t.value;
      mark();
    }
    if (t.dataset.quote !== undefined) {
      DOC.reviews = DOC.reviews || { rating: "", count: "", url: "", items: [] };
      const i = Number(t.dataset.quote);
      while (DOC.reviews.items.length <= i) DOC.reviews.items.push({ text: "", name: "" });
      DOC.reviews.items[i][t.dataset.part] = t.value;
      mark();
    }
    if (t.dataset.ig !== undefined) {
      DOC.instagram = DOC.instagram || { url: "", posts: [] };
      DOC.instagram[t.dataset.ig] = t.value;
      mark();
    }
    if (t.dataset.igpost !== undefined) {
      DOC.instagram = DOC.instagram || { url: "", posts: [] };
      const i = Number(t.dataset.igpost);
      while (DOC.instagram.posts.length <= i) DOC.instagram.posts.push({ image: "", link: "" });
      DOC.instagram.posts[i].link = t.value;
      mark();
    }
    if (t.dataset.folio !== undefined) {
      DOC.portfolio = DOC.portfolio || [];
      const i = Number(t.dataset.folio);
      while (DOC.portfolio.length <= i) DOC.portfolio.push({ image: "", title: "", caption: "" });
      DOC.portfolio[i][t.dataset.part] = t.value;
      mark();
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target;
    /* Show/hide. Deliberately not a re-render: the Home tab has thirty-odd
       boxes, and rebuilding the panel would move the tick out from under the
       cursor and drop whatever box was being typed in. Two nodes change, and
       render() paints the state again on the next tab switch or reload.

       What is written in the box is left alone. Switching a line off and
       deleting it are different things, and only one of them is undoable. */
    if (t.dataset.off !== undefined) {
      DOC.off = DOC.off || {};
      if (t.checked) delete DOC.off[t.dataset.off];
      else DOC.off[t.dataset.off] = true;
      const box = t.closest(".mg-field");
      box?.classList.toggle("mg-off", !t.checked);
      /* disabled, not readonly — a readonly box still takes focus and reads
         like something that ought to work */
      box?.querySelector("[data-content]")?.toggleAttribute("disabled", !t.checked);
      mark();
    }
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
    if (t.id === "newShadeFile") pickSwatch(t.files[0]);
    if (t.dataset.slot !== undefined) replacePhoto(t.dataset.slot, t.files[0]);
    if (t.dataset.igfile !== undefined) addInstaPhoto(Number(t.dataset.igfile), t.files[0]);
    if (t.dataset.foliofile !== undefined) addFolioPhoto(Number(t.dataset.foliofile), t.files[0]);
  });

  /* Replacing a photograph uploads it straight away rather than waiting for
     Save, because the picture has to exist before the page can show it. The
     document still needs saving afterwards — that is what points the slot at
     the new file — and the button says so. */
  async function replacePhoto(slot, file) {
    if (!file) return;
    const state = document.querySelector(`[data-state="${CSS.escape(slot)}"]`);
    const say = (msg, bad) => { if (state) { state.textContent = msg; state.className = "mg-photo-state" + (bad ? " warn" : ""); } };
    say("Preparing…");
    try {
      const { blob, preview } = await readSwatch(file, WIDE);
      say("Uploading…");
      const res = await fetch(`../api/admin/upload?slot=${encodeURIComponent(slot)}`,
        { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "upload failed");

      DOC.images = DOC.images || {};
      DOC.images[slot] = body.path;
      mark();
      /* show it immediately from the local copy — the uploaded file is behind a
         year-long cache and this avoids a round trip just to see your own photo */
      const card = state?.closest(".mg-photo")?.querySelector(".mg-photo-img");
      if (card) card.innerHTML = `<img src="${preview}" alt="">`;
      say("Uploaded — press Save changes");
    } catch (err) {
      say(err.message, true);
    }
  }

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
         <span class="mg-chip big" style="background:${pending.hex}"></span>
         <span class="mg-meta">Measured ${pending.hex}</span>`;
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

  /* An Instagram tile is square on the page, so there is no point keeping a
     wide photograph at full width. */
  async function addInstaPhoto(i, file) {
    if (!file) return;
    const state = document.querySelector(`[data-state="ig-${i}"]`);
    const say = (m, bad) => { if (state) { state.textContent = m; state.className = "mg-photo-state" + (bad ? " warn" : ""); } };
    say("Uploading…");
    try {
      const { blob } = await readSwatch(file, TILE);
      const res = await fetch(`../api/admin/upload?slot=insta-${i}`,
        { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "upload failed");
      DOC.instagram = DOC.instagram || { url: "", posts: [] };
      while (DOC.instagram.posts.length <= i) DOC.instagram.posts.push({ image: "", link: "" });
      DOC.instagram.posts[i].image = body.path;
      mark();
      render();
    } catch (err) { say(err.message, true); }
  }

  /* A portfolio photograph. Kept wide rather than tile-sized: these are the
     shop's own work shown large on the page, not thumbnails. */
  async function addFolioPhoto(i, file) {
    if (!file) return;
    const state = document.querySelector(`[data-state="folio-${i}"]`);
    const say = (m, bad) => { if (state) { state.textContent = m; state.className = "mg-photo-state" + (bad ? " warn" : ""); } };
    say("Preparing…");
    try {
      const { blob } = await readSwatch(file, WIDE);
      say("Uploading…");
      const res = await fetch(`../api/admin/upload?slot=folio-${i}`,
        { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "upload failed");
      DOC.portfolio = DOC.portfolio || [];
      while (DOC.portfolio.length <= i) DOC.portfolio.push({ image: "", title: "", caption: "" });
      DOC.portfolio[i].image = body.path;
      mark();
      render();
    } catch (err) { say(err.message, true); }
  }

  function createRange() {
    const name = $("#nrName").value.trim();
    const brand = $("#nrBrand").value.trim() || "Hari's Carpets";
    const type = $("#nrType").value;
    if (!name) { $("#nrErr").textContent = "Give the collection a name."; return; }
    if (!TYPES.some((t) => t.id === type)) { $("#nrErr").textContent = "Pick a flooring type."; return; }

    /* 64 characters, because that is what the Worker will store. A long brand
       and a long range name together used to make a longer id than that, and
       the collection was then dropped on every save with nothing said. */
    let id = slugify(brand + "-" + name).slice(0, 58).replace(/-$/, "");
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
    const days = t.closest("[data-days]");
    if (days) {
      STATS_DAYS = Number(days.dataset.days);
      STATS = null;          // show "Loading…" rather than last week's figures
      render();
      return loadStats();
    }
    const tabBtn = t.closest("[data-tab]");
    if (tabBtn) { tab = tabBtn.dataset.tab; openRange = null; return render(); }

    const shades = t.closest("[data-shades]");
    if (shades) { openRange = shades.dataset.shades; return render(); }
    if (t.id === "back") { openRange = null; return render(); }

    const drop = t.closest("[data-igdrop]");
    if (drop) {
      DOC.instagram.posts.splice(Number(drop.dataset.igdrop), 1);
      mark();
      return render();
    }

    const enqRead = t.closest("[data-enqread]");
    if (enqRead) {
      const e = (INBOX || []).find((x) => x.id === enqRead.dataset.enqread);
      return enquiryAction(enqRead.dataset.enqread, "POST", e && e.read ? "&read=0" : "");
    }
    const enqDrop = t.closest("[data-enqdrop]");
    if (enqDrop) {
      if (!confirm("Delete this enquiry? It cannot be brought back.")) return;
      return enquiryAction(enqDrop.dataset.enqdrop, "DELETE");
    }

    const folioDrop = t.closest("[data-foliodrop]");
    if (folioDrop) {
      (DOC.portfolio || []).splice(Number(folioDrop.dataset.foliodrop), 1);
      mark();
      return render();
    }

    const revert = t.closest("[data-revert]");
    if (revert) { delete DOC.images[revert.dataset.revert]; mark(); return render(); }

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
    DOC = { version: 0, content: {}, off: {}, styles: {}, overrides: {},
            ranges: [], extra: {}, images: {}, captions: {}, portfolio: [], ...site };
    // make sure the shapes exist even if the stored document is older
    for (const k of ["content", "off", "styles", "overrides", "extra", "images", "captions"]) {
      DOC[k] = DOC[k] || {};
    }
    DOC.ranges = DOC.ranges || [];
    DOC.portfolio = DOC.portfolio || [];

    render();
    $("#state").textContent = "";
  })();
})();
