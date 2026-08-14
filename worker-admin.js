/**
 * Hari's Carpets — the admin API.
 *
 * Imported by worker.js. Kept in its own file because the photo route in front
 * of it is load-bearing for the public site and should stay readable on its own.
 *
 * WHAT THIS IS FOR
 * The catalogue is generated from supplier photography by tools/. That pipeline
 * produces better colour data than anyone typing hex codes, so it stays. But it
 * runs when a supplier sends a new book — twice a year — and the shop needs to
 * change things every week: a range is discontinued, a shade is out of stock, a
 * new collection arrives before the photographs do.
 *
 * So the generated catalogue is never edited. Everything the shop changes lives
 * in one JSON document in R2, and the site merges it over the top at load. The
 * pipeline can regenerate whenever it likes without touching a word of it.
 *
 * WHY NOTHING IS EVER DELETED
 * Saved shortlists and shared links reference a shade by key. Deleting a shade
 * would silently empty somebody's saved list, so the admin hides instead. The
 * shade stops appearing in the catalogue but the link still resolves.
 *
 * AUTH
 * Two ways in, and they are alternatives rather than a fallback chain — if
 * neither is configured nobody gets in at all. An admin that opens up when its
 * configuration is missing is worse than one that never opens.
 *
 *   Cloudflare Access   Hari signs in with a code sent to his email; no
 *                       password for the shop to keep or for us to reset. The
 *                       JWT it puts on each request is verified here against
 *                       Cloudflare's published keys rather than trusted,
 *                       because a request that reaches the Worker without
 *                       passing through Access would otherwise be admitted on
 *                       a header anyone can set.
 *
 *   A password          Access can only guard hostnames in your own zones, and
 *                       workers.dev is Cloudflare's. Until the shop's domain
 *                       points here, Access cannot protect this site at all —
 *                       so a password, which works on any hostname, is the
 *                       only thing that can. It signs a short-lived cookie;
 *                       the password itself is never stored in the browser.
 */

const DOC_KEY = "admin/site.json";
const MAX_DOC = 512 * 1024;        // the whole document
const MAX_PHOTO = 3 * 1024 * 1024; // one swatch photograph
const JWKS_TTL = 3600;

/* ranges = whole new collections. extra = shades added to a collection that
   came from the pipeline, kept apart so regenerating never collides with them. */
const EMPTY = { version: 0, updated: null, content: {}, featured: null,
                styles: {}, overrides: {}, ranges: [], extra: {}, images: {} };

/* Uploaded photographs get a random suffix and are never overwritten.
   /assets/ is served with a year's immutable cache — that is most of why the
   site is quick — so replacing a picture at the same path would keep showing
   the old one for a year, on the shop's screen and everyone else's. A new
   name every time sidesteps the cache entirely. */
const UPLOAD_DIR = "assets/uploads/";
const UPLOAD_PATH = /^uploads\/[a-z0-9][a-z0-9-]{0,79}\.jpg$/;

/* ---------------------------------------------------------------- helpers */

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8",
               "cache-control": "no-store", ...extra },
  });

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const isSlug = (s) => typeof s === "string" && SLUG.test(s);
const isHex = (s) => typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);

/** Trim to a sane length and refuse anything that isn't a string. */
const text = (s, max) => (typeof s === "string" ? s.slice(0, max) : "");

/* ------------------------------------------------------------------ auth */

function b64urlToBytes(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

let jwksCache = { at: 0, keys: null, team: null };

async function jwks(team) {
  const now = Date.now() / 1000;
  if (jwksCache.keys && jwksCache.team === team && now - jwksCache.at < JWKS_TTL) {
    return jwksCache.keys;
  }
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("could not fetch Access certificates");
  const { keys } = await res.json();
  jwksCache = { at: now, keys, team };
  return keys;
}

/* ------------------------------------------------------- password sign-in */

/* Short enough to type on a phone in a shop, long enough that guessing it over
   the network is hopeless. Below this the Worker refuses to enable password
   sign-in at all rather than pretend a four-letter password is a door. */
const MIN_PASSWORD = 12;
const SESSION_COOKIE = "haris_admin";
const SESSION_HOURS = 12;

const enc = new TextEncoder();

const sha256 = async (s) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/** Compare by digest so neither the contents nor the length leak through timing. */
async function sameSecret(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* The cookie is signed with a key derived from the password, so setting the
   password is the only configuration step — and changing it invalidates every
   session that was issued under the old one, which is what you want from a
   password change. */
async function sessionKey(password) {
  return crypto.subtle.importKey(
    "raw", await sha256("haris-admin-session:" + password),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function mintSession(password) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const sig = await crypto.subtle.sign("HMAC", await sessionKey(password), enc.encode(String(exp)));
  return `${exp}.${b64(sig)}`;
}

async function checkSession(token, password) {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [exp, sig] = token.split(".");
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return crypto.subtle.verify("HMAC", await sessionKey(password),
    b64urlToBytes(sig), enc.encode(exp));
}

const cookie = (request, name) =>
  (request.headers.get("cookie") || "")
    .match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];

/**
 * Who is making this request — by Access token or by password session.
 * Returns { email } when signed in, otherwise { error } naming what was wrong,
 * which is what makes a misconfiguration diagnosable from the page.
 */
async function identify(request, env) {
  const password = env.ADMIN_PASSWORD;
  const configured = { access: Boolean(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD),
                       password: Boolean(password && password.length >= MIN_PASSWORD) };

  if (password && password.length < MIN_PASSWORD) {
    return { error: "password too short", configured };
  }
  if (!configured.access && !configured.password) return { error: "unconfigured", configured };

  if (configured.password && await checkSession(cookie(request, SESSION_COOKIE), password)) {
    return { email: "signed in with the site password", configured };
  }
  if (!configured.access) return { error: "no password session", configured };

  const who = await identifyAccess(request, env);
  return { ...who, configured };
}

async function identifyAccess(request, env) {
  const team = env.ACCESS_TEAM_DOMAIN;   // e.g. hariscarpets.cloudflareaccess.com
  const aud = env.ACCESS_AUD;            // the Access application's Audience tag

  const token = request.headers.get("cf-access-jwt-assertion")
    || (request.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token) return { error: "no token" };

  const parts = token.split(".");
  if (parts.length !== 3) return { error: "malformed token" };

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch { return { error: "malformed token" }; }

  if (header.alg !== "RS256") return { error: "unexpected algorithm" };

  /* A wrong team domain fails here rather than anywhere obvious. Catching it
     turns an opaque 500 into a message naming the setting to fix. */
  let keys;
  try { keys = await jwks(team); }
  catch { return { error: "no certificates" }; }

  const key = keys.find((k) => k.kid === header.kid);
  if (!key) return { error: "unknown signing key" };

  const pub = await crypto.subtle.importKey(
    "jwk", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", pub,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) return { error: "bad signature" };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) return { error: "expired" };
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) return { error: "not yet valid" };
  if (payload.iss !== `https://${team}`) return { error: "wrong issuer" };

  // aud is an array in Access tokens; the app's tag must be among them
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) return { error: "wrong audience" };

  return { email: payload.email || payload.common_name || "signed in" };
}

/**
 * A mutating request must come from our own page. Access authenticates with a
 * cookie, and a cookie rides along on a cross-site form post too, so without
 * this another site could make Hari's browser save changes he never made.
 */
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; }
  catch { return false; }
}

/* -------------------------------------------------------------- the document */

async function readDoc(env) {
  const obj = await env.PHOTOS.get(DOC_KEY);
  if (!obj) return { ...EMPTY };
  try {
    const doc = JSON.parse(await obj.text());
    return { ...EMPTY, ...doc };
  } catch {
    // a corrupt document must not take the site down
    return { ...EMPTY };
  }
}

/**
 * Rebuild the document from whatever was posted, keeping only what we
 * recognise and bounding every field. The site renders this, so it is treated
 * as untrusted even though only a signed-in admin can write it — a mistake in
 * the admin should not be able to produce a page that cannot be undone.
 */
function clean(input) {
  const out = { ...EMPTY, ranges: [], overrides: {}, styles: {}, content: {}, extra: {} };

  /* one shade, from wherever it was posted */
  const colour = (c) => {
    if (!c || typeof c.name !== "string" || !c.name.trim() || !isHex(c.hex)) return null;
    const out = { name: text(c.name.trim(), 60), hex: c.hex.toLowerCase() };
    if (isSlug(c.file)) out.file = c.file;   // absent means no photograph yet
    return out;
  };

  if (input.content && typeof input.content === "object") {
    for (const [k, v] of Object.entries(input.content)) {
      if (isSlug(k) && typeof v === "string") out.content[k] = text(v, 2000);
    }
  }

  if (Array.isArray(input.featured)) {
    out.featured = input.featured.filter(isSlug).slice(0, 6);
  }

  if (input.styles && typeof input.styles === "object") {
    for (const [type, styles] of Object.entries(input.styles)) {
      if (!isSlug(type) || !styles || typeof styles !== "object") continue;
      const bag = {};
      for (const [styleId, ids] of Object.entries(styles)) {
        if (!isSlug(styleId) || !Array.isArray(ids)) continue;
        bag[styleId] = ids.filter(isSlug).slice(0, 200);
      }
      out.styles[type] = bag;
    }
  }

  if (input.overrides && typeof input.overrides === "object") {
    for (const [key, val] of Object.entries(input.overrides)) {
      // "range-id" or "range-id:colour-slug"
      const bits = key.split(":");
      if (bits.length > 2 || !bits.every(isSlug)) continue;
      if (!val || typeof val !== "object") continue;
      const o = {};
      if (val.hidden === true) o.hidden = true;
      if (typeof val.name === "string" && val.name.trim()) o.name = text(val.name.trim(), 80);
      if (typeof val.note === "string" && val.note.trim()) o.note = text(val.note.trim(), 200);
      if (Object.keys(o).length) out.overrides[key] = o;
    }
  }

  if (Array.isArray(input.ranges)) {
    for (const r of input.ranges.slice(0, 200)) {
      if (!r || !isSlug(r.id) || !isSlug(r.type)) continue;
      out.ranges.push({
        id: r.id,
        type: r.type,
        brand: text(r.brand, 60) || "Hari's Carpets",
        name: text(r.name, 80) || r.id,
        blurb: text(r.blurb, 600),
        colours: (Array.isArray(r.colours) ? r.colours : [])
          .slice(0, 400).map(colour).filter(Boolean),
      });
    }
  }

  /* Which photograph is showing in which slot. Keys are "hero", or
     "range:<id>", or "shade:<range>:<colour>"; values are always a path this
     admin uploaded, never an arbitrary URL. */
  if (input.images && typeof input.images === "object") {
    for (const [slot, path] of Object.entries(input.images)) {
      const parts = slot.split(":");
      if (parts.length > 3 || !parts.every(isSlug)) continue;
      if (typeof path === "string" && UPLOAD_PATH.test(path)) out.images[slot] = path;
    }
  }

  if (input.extra && typeof input.extra === "object") {
    for (const [id, list] of Object.entries(input.extra)) {
      if (!isSlug(id) || !Array.isArray(list)) continue;
      const cols = list.slice(0, 400).map(colour).filter(Boolean);
      if (cols.length) out.extra[id] = cols;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ routes */

async function handleGetSite(request, env, ctx) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const doc = await readDoc(env);
  const res = json(doc, 200, {
    // short: a change should show up quickly, but not on every single request
    "cache-control": "public, max-age=30",
  });
  if (request.method === "GET") ctx.waitUntil(cache.put(request, res.clone()));
  return res;
}

async function handlePutSite(request, env, ctx) {
  if (!sameOrigin(request)) return json({ error: "cross-site request refused" }, 403);

  const raw = await request.text();
  if (raw.length > MAX_DOC) return json({ error: "too big" }, 413);

  let input;
  try { input = JSON.parse(raw); }
  catch { return json({ error: "not valid JSON" }, 400); }

  const current = await readDoc(env);
  // optimistic concurrency: two people editing at once must not silently
  // overwrite each other
  if (typeof input.baseVersion === "number" && input.baseVersion !== current.version) {
    return json({ error: "changed since you loaded it", version: current.version }, 409);
  }

  const doc = clean(input);
  doc.version = current.version + 1;
  doc.updated = new Date().toISOString();

  await env.PHOTOS.put(DOC_KEY, JSON.stringify(doc), {
    httpMetadata: { contentType: "application/json" },
  });

  // the public copy is cached; drop it so the change is live now
  ctx.waitUntil(caches.default.delete(new URL("/api/site", request.url).toString()));
  return json({ ok: true, version: doc.version });
}

async function handleLogin(request, env) {
  if (!sameOrigin(request)) return json({ error: "cross-site request refused" }, 403);
  const password = env.ADMIN_PASSWORD;
  if (!password || password.length < MIN_PASSWORD) {
    return json({ error: "Password sign-in is not set up." }, 503);
  }

  let given = "";
  try { given = (await request.json()).password; } catch { /* handled below */ }

  /* Every attempt costs the same half second whether the password was right,
     wrong or missing. There is no shared counter to rate-limit on across
     Cloudflare's edge, so this plus a long password is the defence: at two
     attempts a second a 12-character password is not being guessed. */
  const [ok] = await Promise.all([
    typeof given === "string" && given ? sameSecret(given, password) : false,
    new Promise((r) => setTimeout(r, 500)),
  ]);
  if (!ok) return json({ error: "That password is not right." }, 401);

  const token = await mintSession(password);
  return json({ ok: true }, 200, {
    "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; `
      + `Max-Age=${SESSION_HOURS * 3600}`,
  });
}

function handleLogout(request) {
  return json({ ok: true }, 200, {
    "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  });
}

/** Read an upload, check it really is a JPEG, and return the bytes. */
async function readJpeg(request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_PHOTO) return null;
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_PHOTO) return null;
  // trust the bytes, not the content-type header
  return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ? bytes : false;
}

/**
 * A photograph for anywhere on the site — the home page, a collection, or a
 * shade whose picture is being replaced. Always stored under a fresh name; the
 * caller records which name is current in the site document.
 */
async function handleUpload(request, env) {
  if (!sameOrigin(request)) return json({ error: "cross-site request refused" }, 403);

  const slot = new URL(request.url).searchParams.get("slot") || "photo";
  if (!slot.split(":").every(isSlug) || slot.split(":").length > 3) {
    return json({ error: "bad slot" }, 400);
  }

  const bytes = await readJpeg(request);
  if (bytes === null) return json({ error: "photo too large" }, 413);
  if (bytes === false) return json({ error: "not a JPEG" }, 415);

  const stem = slot.replace(/:/g, "-").slice(0, 60);
  const suffix = [...crypto.getRandomValues(new Uint8Array(5))]
    .map((n) => n.toString(16).padStart(2, "0")).join("");
  const path = `uploads/${stem}-${suffix}.jpg`;

  await env.PHOTOS.put(UPLOAD_DIR + `${stem}-${suffix}.jpg`, bytes,
    { httpMetadata: { contentType: "image/jpeg" } });
  return json({ ok: true, path, url: "/assets/" + path });
}

async function handlePhoto(request, env) {
  if (!sameOrigin(request)) return json({ error: "cross-site request refused" }, 403);

  const url = new URL(request.url);
  const range = url.searchParams.get("range");
  const name = url.searchParams.get("name");
  if (!isSlug(range) || !isSlug(name)) return json({ error: "bad range or name" }, 400);

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_PHOTO) return json({ error: "photo too large" }, 413);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_PHOTO) return json({ error: "photo too large" }, 413);
  // trust the bytes, not the content-type header
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return json({ error: "not a JPEG" }, 415);
  }

  const key = `assets/swatches/${range}/${name}.jpg`;
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  return json({ ok: true, file: name, url: `/assets/swatches/${range}/${name}.jpg` });
}

/**
 * Returns a Response when the request was for the admin API, or null to let
 * the caller carry on to the photo route and the static site.
 */
export async function adminRoutes(request, env, ctx) {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/api/")) return null;

  if (pathname === "/api/site" && (request.method === "GET" || request.method === "HEAD")) {
    return handleGetSite(request, env, ctx);
  }
  if (!pathname.startsWith("/api/admin/")) return json({ error: "not found" }, 404);

  /* before the identity check: this is how you get one */
  if (pathname === "/api/admin/login" && request.method === "POST") {
    return handleLogin(request, env);
  }
  if (pathname === "/api/admin/logout" && request.method === "POST") {
    return handleLogout(request);
  }

  const who = await identify(request, env);
  if (who.error === "unconfigured") {
    return json({ error: "Sign-in is not set up yet. See docs/admin.md." }, 503);
  }
  if (who.error === "password too short") {
    return json({ error: `The site password must be at least ${MIN_PASSWORD} characters.` }, 503);
  }
  if (!who.email) {
    /* which sign-in methods exist is not a secret — the page needs it to know
       whether to offer a password box */
    return json({ error: "not signed in", reason: who.error, methods: who.configured }, 401);
  }

  if (pathname === "/api/admin/whoami") return json({ email: who.email });
  if (pathname === "/api/admin/site" && request.method === "PUT") {
    return handlePutSite(request, env, ctx);
  }
  if (pathname === "/api/admin/photo" && request.method === "POST") {
    return handlePhoto(request, env);
  }
  if (pathname === "/api/admin/upload" && request.method === "POST") {
    return handleUpload(request, env);
  }
  return json({ error: "not found" }, 404);
}
