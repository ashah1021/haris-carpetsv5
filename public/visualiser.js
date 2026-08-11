/* =========================================================================
   FLOOR VISUALISER — self-contained add-on module
   -------------------------------------------------------------------------
   Deliberately separable from the rest of the site. Everything the visualiser
   needs lives in this file and visualiser.css, and the site treats it as
   optional: app.js only routes to it when window.Visualiser exists, and every
   entry point (nav link, footer link, the buttons on the catalogue and range
   pages) is hidden when FEATURES.visualiser is false.

   To ship the website without it: set FEATURES.visualiser = false in data.js.
   To remove it entirely: delete visualiser.js, visualiser.css and their two
   tags in index.html. Nothing else references it.

   How the recolour works: each pixel's luminance is measured against the mean
   luminance of the floor, and the chosen colour is scaled by that ratio, so a
   shadow stays a shadow and the pile texture survives. A flat fill reads as a
   sticker. Only pixels inside the room's floor mask are touched.
   ========================================================================= */
(function () {
  if (typeof FEATURES === "undefined" || !FEATURES.visualiser) return;

  const VIS = {
    type: null, room: null, colour: null, rangeId: null,
    search: "", cache: {}, busy: false, dead: {},
  };

  const roomById = (id) => VIS_ROOMS.find((r) => r.id === id);
  const roomsFor = (type) => (type.rooms || []).map(roomById).filter((r) => r && !VIS.dead[r.id]);
  const rangesFor = (type) => CATALOGUE.filter((r) => r.type === type.id);

  /* shades on offer right now: one collection, or a name search across the type */
  function shades() {
    const q = VIS.search.trim().toLowerCase();
    if (q) {
      return rangesFor(VIS.type).flatMap((r) =>
        r.colours.filter((c) => c.name.toLowerCase().includes(q))
          .map((c) => ({ ...c, rangeId: r.id, range: r.name, brand: r.brand })));
    }
    const r = findRange(VIS.rangeId) || rangesFor(VIS.type)[0];
    return r ? r.colours.map((c) => ({ ...c, rangeId: r.id, range: r.name, brand: r.brand })) : [];
  }

  /* ---------------- image pipeline ---------------- */
  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("could not load " + src));
      im.src = src;
    });
  }

  async function prepare(room) {
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

  function paint(buf, hex) {
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

  async function draw() {
    const cv = document.querySelector("#visCanvas");
    if (!cv || VIS.busy || !VIS.room || !VIS.colour) return;
    VIS.busy = true;
    const stage = document.querySelector(".vz-stage");
    stage?.classList.add("busy");
    try {
      const buf = await prepare(VIS.room);
      cv.width = buf.w; cv.height = buf.h;
      cv.getContext("2d").putImageData(paint(buf, VIS.colour.hex), 0, 0);
      cv.classList.add("ready");
      const st = document.querySelector("#visStatus");
      if (st) st.textContent = "";
    } catch (e) {
      const st = document.querySelector("#visStatus");
      if (location.protocol === "file:") {
        if (st) st.innerHTML = "The visualiser needs the site served over http, not opened as a file. "
          + "Run <code>npx http-server public</code> and reload.";
      } else {
        /* a room missing its photo or mask drops out rather than showing broken */
        VIS.dead[VIS.room.id] = true;
        VIS.busy = false;
        const left = roomsFor(VIS.type);
        if (left.length) { VIS.room = left[0]; return draw(); }
        if (st) st.textContent = "No rooms are ready for this flooring type yet.";
      }
    } finally {
      VIS.busy = false;
      stage?.classList.remove("busy");
    }
  }

  /* ---------------- markup ---------------- */
  const chip = (label, on, attr, val) =>
    `<button class="chip${on ? " on" : ""}" data-${attr}="${esc(val)}">${esc(label)}</button>`;

  function shadeStrip() {
    const list = shades();
    if (!list.length) return `<p class="vz-none">No shades match “${esc(VIS.search)}”.</p>`;
    return list.map((c) => {
      const on = VIS.colour && c.rangeId === VIS.colour.rangeId && c.code === VIS.colour.code;
      return `<button class="vz-swatch${on ? " on" : ""}" style="background:${c.hex}"
        data-vz-colour="${esc(c.rangeId + ":" + c.code)}" title="${esc(c.name)} · ${esc(c.range)}">
        <img src="${swatchImg({ rangeId: c.rangeId, name: c.name })}" alt="" loading="lazy" onerror="this.remove()">
      </button>`;
    }).join("");
  }

  function controls() {
    const ranges = rangesFor(VIS.type);
    const current = VIS.search ? "" : (VIS.rangeId || (ranges[0] && ranges[0].id));
    return `
      <div class="vz-pick">
        <label class="vz-field">
          <span>Collection</span>
          <select id="vzRange">${ranges.map((r) =>
            `<option value="${esc(r.id)}"${r.id === current ? " selected" : ""}>${esc(r.brand)} — ${esc(r.name)} (${r.colours.length})</option>`).join("")}</select>
        </label>
        <label class="vz-field vz-search">
          <span>Or search by name</span>
          <input id="vzSearch" type="search" placeholder="e.g. Oatmeal" value="${esc(VIS.search)}" autocomplete="off">
        </label>
      </div>
      <div class="vz-strip" id="vzStrip">${shadeStrip()}</div>`;
  }

  function view(rangeId) {
    if (rangeId) {
      const r = findRange(rangeId);
      if (r) {
        VIS.type = findType(r.type) || TYPES[0];
        VIS.rangeId = r.id;
        VIS.colour = { ...r.colours[0], rangeId: r.id, range: r.name, brand: r.brand };
        VIS.room = roomsFor(VIS.type)[0] || null;
      }
    }
    VIS.type = VIS.type || TYPES[0];
    if (!VIS.rangeId || !rangesFor(VIS.type).some((r) => r.id === VIS.rangeId)) {
      VIS.rangeId = (rangesFor(VIS.type)[0] || {}).id;
    }
    VIS.colour = VIS.colour || shades()[0];
    VIS.room = VIS.room || roomsFor(VIS.type)[0];
    if (!VIS.colour || !VIS.room) return `<section><div class="wrap"><h2>Visualiser unavailable</h2></div></section>`;

    const favKey = VIS.colour.rangeId + ":" + slugify(VIS.colour.name);

    return `
    <div class="wrap"><p class="crumbs"><a href="#/">Home</a> / Visualiser</p></div>
    <section class="vz"><div class="wrap">
      <div class="section-head">
        <div><span class="rule"></span><p class="kicker">See it before you buy it</p>
          <h2>Floor visualiser</h2>
          <p>Choose a floor and a room, then try shades against it. The photograph's own
             lighting is kept, so a colour sits in the space the way it really would.</p></div>
      </div>

      <div class="vz-bar">
        <div class="vz-group"><span class="vz-lbl">Floor</span>
          <div class="chips">${TYPES.map((t) => chip(t.name, t.id === VIS.type.id, "vz-type", t.id)).join("")}</div></div>
        <div class="vz-group"><span class="vz-lbl">Room</span>
          <div class="chips" id="vzRooms">${roomsFor(VIS.type).map((r) =>
            chip(r.name, VIS.room && r.id === VIS.room.id, "vz-room", r.id)).join("")}</div></div>
      </div>

      <div class="vz-stage">
        <canvas id="visCanvas"></canvas>
        <p class="vis-status" id="visStatus">Loading room…</p>
        <div class="vz-now">
          <span class="vz-chip" id="vzNowChip" style="background:${VIS.colour.hex}"></span>
          <span class="vz-now-txt">
            <b id="vzNowName">${esc(VIS.colour.name)}</b>
            <small id="vzNowRange">${esc(VIS.colour.brand)} · ${esc(VIS.colour.range)}</small>
          </span>
          <span id="vzFavSlot">${heart(favKey)}</span>
        </div>
      </div>
      <p class="vz-note" id="vzNote">${esc(VIS.room.note)} Screens vary — come and see the real thing.</p>

      <div class="vz-controls" id="vzControls">${controls()}</div>
    </div></section>`;
  }

  /* ---------------- interaction ---------------- */
  function syncNow() {
    const c = VIS.colour;
    const chipEl = document.querySelector("#vzNowChip");
    if (!chipEl) return;
    chipEl.style.background = c.hex;
    document.querySelector("#vzNowName").textContent = c.name;
    document.querySelector("#vzNowRange").textContent = `${c.brand} · ${c.range}`;
    const slot = document.querySelector("#vzFavSlot");
    if (slot) slot.innerHTML = heart(c.rangeId + ":" + slugify(c.name));
  }

  function refreshStrip() {
    const s = document.querySelector("#vzStrip");
    if (s) s.innerHTML = shadeStrip();
  }

  function setType(id) {
    VIS.type = TYPES.find((t) => t.id === id) || TYPES[0];
    VIS.search = "";
    VIS.rangeId = (rangesFor(VIS.type)[0] || {}).id;
    VIS.colour = shades()[0];
    VIS.room = roomsFor(VIS.type)[0] || null;
    const rooms = document.querySelector("#vzRooms");
    if (rooms) rooms.innerHTML = roomsFor(VIS.type).map((r) =>
      chip(r.name, VIS.room && r.id === VIS.room.id, "vz-room", r.id)).join("");
    const ctl = document.querySelector("#vzControls");
    if (ctl) ctl.innerHTML = controls();
    syncNow(); draw();
  }

  function onClick(e) {
    const t = e.target.closest("[data-vz-type]");
    if (t) return setType(t.dataset.vzType);

    const r = e.target.closest("[data-vz-room]");
    if (r) {
      VIS.room = roomById(r.dataset.vzRoom) || VIS.room;
      document.querySelectorAll("[data-vz-room]").forEach((b) => b.classList.toggle("on", b === r));
      const note = document.querySelector("#vzNote");
      if (note) note.textContent = `${VIS.room.note} Screens vary — come and see the real thing.`;
      return draw();
    }

    const c = e.target.closest("[data-vz-colour]");
    if (c) {
      const [rid, code] = c.dataset.vzColour.split(":");
      const found = shades().find((x) => x.rangeId === rid && x.code === code);
      if (!found) return;
      VIS.colour = found;
      document.querySelectorAll(".vz-swatch").forEach((b) => b.classList.toggle("on", b === c));
      syncNow();
      return draw();
    }
  }

  function onChange(e) {
    if (e.target.id === "vzRange") {
      VIS.rangeId = e.target.value; VIS.search = "";
      const box = document.querySelector("#vzSearch"); if (box) box.value = "";
      VIS.colour = shades()[0]; refreshStrip(); syncNow(); draw();
    }
  }

  let searchTimer;
  function onInput(e) {
    if (e.target.id !== "vzSearch") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      VIS.search = e.target.value;
      refreshStrip();
    }, 160);
  }

  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);

  window.Visualiser = { view, mount: draw };
})();
