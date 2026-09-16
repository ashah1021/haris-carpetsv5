/**
 * Tests for the admin API — worker-admin.js.
 *
 *     node tools/admin.test.mjs
 *
 * The point of these is the security boundary. Everything else in this repo can
 * be checked by looking at the page; an auth hole cannot, and this is the only
 * part of the site that accepts writes.
 *
 * A real RSA key pair is generated and real JWTs are signed with it, so the
 * verification path runs for real rather than against a stub that always says
 * yes. The JWKS endpoint is the only thing faked, by intercepting fetch.
 */
import { webcrypto as crypto } from "node:crypto";
import { loadAdmin } from "./load-worker.mjs";

/* Node 22 already exposes a read-only globalThis.crypto with WebCrypto on it,
   so this is only needed on older runtimes. */
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: crypto, configurable: true });
}
globalThis.atob ||= (s) => Buffer.from(s, "base64").toString("binary");

const { adminRoutes } = await loadAdmin();

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
}

/* ------------------------------------------------------------- fake world */

const TEAM = "haris.cloudflareaccess.com";
const AUD = "aud-tag-123";

const pair = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]);

const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
jwk.kid = "kid-1";
jwk.alg = "RS256";

/* a second, unrelated key — for the "signed by someone else" case */
const evil = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true, ["sign", "verify"]);

const b64url = (buf) => Buffer.from(buf).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function token(claims = {}, key = pair.privateKey, header = {}) {
  const h = b64url(JSON.stringify({ alg: "RS256", kid: "kid-1", ...header }));
  const p = b64url(JSON.stringify({
    aud: [AUD], iss: `https://${TEAM}`, email: "hari@haris-carpets.co.uk",
    exp: Math.floor(Date.now() / 1000) + 600, ...claims,
  }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key,
    new TextEncoder().encode(h + "." + p));
  return `${h}.${p}.${b64url(sig)}`;
}

globalThis.fetch = async (url) => {
  if (String(url).includes("/cdn-cgi/access/certs")) {
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  }
  throw new Error("unexpected fetch: " + url);
};

let cacheStore = new Map();
globalThis.caches = { default: {
  async match(req) { return cacheStore.get(typeof req === "string" ? req : req.url); },
  async put(req, res) { cacheStore.set(typeof req === "string" ? req : req.url, res); },
  async delete(req) { return cacheStore.delete(typeof req === "string" ? req : req.url); },
}};
const ctx = { waitUntil() {} };

function makeEnv(opts = {}) {
  const store = new Map(Object.entries(opts.objects || {}));
  return {
    ACCESS_TEAM_DOMAIN: opts.team === undefined ? TEAM : opts.team,
    ACCESS_AUD: opts.aud === undefined ? AUD : opts.aud,
    ADMIN_PASSWORD: opts.password,
    PHOTOS: {
      async get(key) {
        if (!store.has(key)) return null;
        const val = store.get(key);
        return { async text() { return val; }, body: val };
      },
      async put(key, value) { store.set(key, typeof value === "string" ? value : value); },
      async delete(key) { store.delete(key); },
      /* R2's list, as much of it as the inbox uses. Without this the endpoint's
         own try/catch swallows a TypeError and answers "no enquiries", which is
         indistinguishable from a working empty inbox. */
      async list({ prefix = "" } = {}) {
        return { objects: [...store.keys()].filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })) };
      },
      _store: store,
    },
  };
}

const ORIGIN = "https://haris-carpets.co.uk";
const req = (path, init = {}) => new Request(ORIGIN + path, init);
const signedIn = async (extra = {}) => ({ "cf-access-jwt-assertion": await token(), ...extra });

/* -------------------------------------------------------------------- tests */

console.log("\nadmin API\n");
console.log("Nobody gets in without a valid Access token:");
{
  const env = makeEnv();
  const anon = await adminRoutes(req("/api/admin/whoami"), env, ctx);
  check("no token is rejected", anon.status === 401);

  const bad = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": "not.a.jwt" } }), env, ctx);
  check("a malformed token is rejected", bad.status === 401);

  /* the important one: a well-formed token signed by a key that isn't
     Cloudflare's. Anyone can mint one of these. */
  const forged = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": await token({}, evil.privateKey) } }), env, ctx);
  check("a token signed by another key is rejected", forged.status === 401);

  const expired = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": await token({ exp: Math.floor(Date.now() / 1000) - 10 }) } }), env, ctx);
  check("an expired token is rejected", expired.status === 401);

  const otherApp = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": await token({ aud: ["someone-elses-app"] }) } }), env, ctx);
  check("a token for a different Access app is rejected", otherApp.status === 401);

  const otherTeam = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": await token({ iss: "https://evil.cloudflareaccess.com" }) } }), env, ctx);
  check("a token from a different team is rejected", otherTeam.status === 401);

  /* alg:none is the classic JWT bypass */
  const none = b64url(JSON.stringify({ alg: "none", kid: "kid-1" })) + "." +
    b64url(JSON.stringify({ aud: [AUD], iss: `https://${TEAM}`, email: "x", exp: 9e9 })) + ".";
  const algNone = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": none } }), env, ctx);
  check("alg:none is rejected", algNone.status === 401);

  const ok = await adminRoutes(req("/api/admin/whoami", { headers: await signedIn() }), env, ctx);
  check("a genuine token is accepted", ok.status === 200);
  check("and identifies who signed in", (await ok.json()).email === "hari@haris-carpets.co.uk");
}

console.log("\nA refusal says which setting is wrong:");
{
  /* Setting Access up is fiddly and every failure looks the same from outside.
     The reason is what turns "it doesn't work" into a thing to go and fix. */
  const env = makeEnv();
  const reason = async (headers) =>
    (await (await adminRoutes(req("/api/admin/whoami", { headers }), env, ctx)).json()).reason;

  check("nothing sent", await reason({}) === "no token");
  check("token for another Access app",
    await reason({ "cf-access-jwt-assertion": await token({ aud: ["nope"] }) }) === "wrong audience");
  check("token from another team",
    await reason({ "cf-access-jwt-assertion": await token({ iss: "https://other.cloudflareaccess.com" }) })
      === "wrong issuer");
  check("session run out",
    await reason({ "cf-access-jwt-assertion": await token({ exp: 1 }) }) === "expired");

  /* a team domain that resolves to nothing must name itself, not throw */
  const saved = globalThis.fetch;
  globalThis.fetch = async () => new Response("no", { status: 404 });
  const env2 = makeEnv({ team: "typo.cloudflareaccess.com" });
  const res = await adminRoutes(req("/api/admin/whoami",
    { headers: { "cf-access-jwt-assertion": await token({ iss: "https://typo.cloudflareaccess.com" }) } }),
    env2, ctx);
  check("an unreachable team domain is reported, not thrown",
    res.status === 401 && (await res.json()).reason === "no certificates");
  globalThis.fetch = saved;
}

console.log("\nUnconfigured is refused, not waved through:");
{
  const env = makeEnv({ team: "", aud: "" });
  const res = await adminRoutes(req("/api/admin/site", { method: "PUT" }), env, ctx);
  check("no sign-in configured at all means no admin", res.status === 503);
}

console.log("\nPassword sign-in — the only thing that works off a real domain:");
{
  const PW = "correct-horse-battery-staple";
  const env = makeEnv({ team: "", aud: "", password: PW });
  const login = (password, origin = ORIGIN) => adminRoutes(req("/api/admin/login", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ password }),
  }), env, ctx);

  check("the admin says a password box is available", await (async () => {
    const r = await adminRoutes(req("/api/admin/whoami"), env, ctx);
    return r.status === 401 && (await r.json()).methods.password === true;
  })());

  let res = await login("not the password");
  check("a wrong password is refused", res.status === 401);
  check("and sets no cookie", !res.headers.get("set-cookie"));

  res = await login("");
  check("an empty password is refused", res.status === 401);

  res = await login(PW, "https://evil.example");
  check("a cross-site login attempt is refused", res.status === 403);

  res = await login(PW);
  check("the right password is accepted", res.status === 200);
  const setCookie = res.headers.get("set-cookie") || "";
  check("the session cookie is HttpOnly", /HttpOnly/i.test(setCookie));
  check("…Secure", /Secure/i.test(setCookie));
  check("…and SameSite=Strict", /SameSite=Strict/i.test(setCookie));
  check("the password itself is never in the cookie", !setCookie.includes(PW));

  const token = setCookie.match(/haris_admin=([^;]+)/)[1];
  const withCookie = (extra = {}) => ({ cookie: `haris_admin=${token}`, ...extra });

  res = await adminRoutes(req("/api/admin/whoami", { headers: withCookie() }), env, ctx);
  check("the session gets you in", res.status === 200);

  /* the signature is the whole protection — a made-up cookie must not work */
  const forged = `${Date.now() + 9e6}.${"A".repeat(43)}`;
  res = await adminRoutes(req("/api/admin/whoami",
    { headers: { cookie: `haris_admin=${forged}` } }), env, ctx);
  check("a forged session cookie is refused", res.status === 401);

  /* tamper with the expiry but keep the old signature */
  const [, sig] = token.split(".");
  res = await adminRoutes(req("/api/admin/whoami",
    { headers: { cookie: `haris_admin=${Date.now() + 9e9}.${sig}` } }), env, ctx);
  check("extending your own session is refused", res.status === 401);

  const stale = await (async () => {
    const old = `${Date.now() - 1000}.${sig}`;
    const r = await adminRoutes(req("/api/admin/whoami", { headers: { cookie: `haris_admin=${old}` } }), env, ctx);
    return r.status;
  })();
  check("an expired session is refused", stale === 401);

  /* changing the password must end every session issued under the old one */
  const env2 = makeEnv({ team: "", aud: "", password: "a-completely-different-one" });
  res = await adminRoutes(req("/api/admin/whoami", { headers: withCookie() }), env2, ctx);
  check("changing the password logs everyone out", res.status === 401);

  res = await adminRoutes(req("/api/admin/site", {
    method: "PUT", headers: withCookie({ origin: ORIGIN }), body: JSON.stringify({ baseVersion: 0 }),
  }), env, ctx);
  check("a password session can save", res.status === 200);

  res = await adminRoutes(req("/api/admin/logout", { method: "POST", headers: withCookie() }), env, ctx);
  check("logout clears the cookie", /haris_admin=;/.test(res.headers.get("set-cookie") || ""));
}

console.log("\nA weak password is refused rather than accepted quietly:");
{
  const env = makeEnv({ team: "", aud: "", password: "letmein" });
  let res = await adminRoutes(req("/api/admin/whoami"), env, ctx);
  check("a short password disables the admin", res.status === 503);
  res = await adminRoutes(req("/api/admin/login", {
    method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify({ password: "letmein" }),
  }), env, ctx);
  check("and cannot be used to sign in", res.status === 503);
}

console.log("\nBoth methods can be on at once:");
{
  const env = makeEnv({ password: "correct-horse-battery-staple" });
  const res = await adminRoutes(req("/api/admin/whoami", { headers: await signedIn() }), env, ctx);
  check("an Access token still works when a password is set", res.status === 200);
  const anon = await adminRoutes(req("/api/admin/whoami"), env, ctx);
  const methods = (await anon.json()).methods;
  check("and the page is told about both", methods.access === true && methods.password === true);
}

console.log("\nWrites need to come from our own page:");
{
  const env = makeEnv();
  const cross = await adminRoutes(req("/api/admin/site", {
    method: "PUT", headers: { ...(await signedIn()), origin: "https://evil.example" },
    body: "{}",
  }), env, ctx);
  check("a cross-site write is refused", cross.status === 403);

  const none = await adminRoutes(req("/api/admin/site", {
    method: "PUT", headers: await signedIn(), body: "{}",
  }), env, ctx);
  check("a write with no Origin is refused", none.status === 403);
}

console.log("\nSaving:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  const put = (body) => adminRoutes(req("/api/admin/site",
    { method: "PUT", headers, body: JSON.stringify(body) }), env, ctx);

  let res = await put({ baseVersion: 0, content: { hours: "Mon-Sat 9-5.30" } });
  check("a first save is accepted", res.status === 200);
  check("and bumps the version", (await res.json()).version === 1);

  res = await put({ baseVersion: 0, content: { hours: "different" } });
  check("a stale save is refused rather than clobbering", res.status === 409);

  const got = await adminRoutes(req("/api/site"), env, ctx);
  const doc = await got.json();
  check("what was saved is what is served", doc.content.hours === "Mon-Sat 9-5.30");

  res = await put({ baseVersion: 1, ranges: [{ id: "new-range", type: "carpets", name: "New",
    brand: "Someone", colours: [{ name: "Oatmeal", hex: "#CCBBAA", file: "oatmeal" }] }] });
  check("a new collection is stored", res.status === 200);
  const doc2 = await (await adminRoutes(req("/api/site"), makeEnvFrom(env), ctx)).json();
  check("with its shade, lowercased", doc2.ranges[0].colours[0].hex === "#ccbbaa");
}

/* the cache holds the previous /api/site response; read straight through */
function makeEnvFrom(env) { cacheStore = new Map(); return env; }

console.log("\nAnything unrecognised in a saved document is dropped:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0,
    evil: "should not survive",
    content: { "not a slug": "x", hours: "kept", huge: "y".repeat(9000) },
    overrides: {
      "good-id": { hidden: true, name: "Fine" },
      "bad id with spaces": { hidden: true },
      "a:b:c": { hidden: true },
      "another": { hidden: "yes please" },
    },
    featured: ["ok-id", "NOT OK", 42],
    ranges: [
      { id: "keep", type: "carpets", name: "Keep",
        colours: [{ name: "Good", hex: "#aabbcc" }, { name: "Bad hex", hex: "red" },
                  { name: "", hex: "#aabbcc" }] },
      { id: "no type" },
    ],
    extra: { "some-range": [{ name: "Added", hex: "#123456", file: "../../escape" }] },
  }) }), env, ctx);

  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();
  check("unknown top-level keys are gone", doc.evil === undefined);
  check("a non-slug content key is dropped", doc.content["not a slug"] === undefined);
  check("a good content key survives", doc.content.hours === "kept");
  check("an over-long value is truncated", doc.content.huge.length === 2000);
  check("a malformed override key is dropped", doc.overrides["bad id with spaces"] === undefined);
  check("a three-part override key is dropped", doc.overrides["a:b:c"] === undefined);
  check("hidden must be exactly true", doc.overrides["another"] === undefined);
  check("a good override survives", doc.overrides["good-id"].hidden === true);
  check("non-slug featured entries are dropped", doc.featured.length === 1);
  check("a range with no type is dropped", doc.ranges.length === 1);
  check("a shade with a bad hex is dropped", doc.ranges[0].colours.length === 1);
  check("a traversal attempt in a file stem is dropped",
    doc.extra["some-range"][0].file === undefined);
}

/* The bug this section exists for. Content keys are names in the code and are
   camelCase; ids are slugs and are not. One regex was doing both jobs, so every
   camelCase key was silently discarded — the admin said "Saved" and the shop's
   headings never changed. These assertions fail on the old code, which is the
   only reason to trust them. */
console.log("\nContent keys are names, ids are slugs, and the two are not the same:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0,
    content: {
      heroTitle: "camelCase", mapEmbed: "https://maps", aboutBody: "two\n\nparas",
      "type-carpets": "kebab-case", proof1: "lower and a digit",
      "has:colon": "no", "has space": "no", "has.dot": "no",
      "1leading": "no", ["x".repeat(70)]: "no",
    },
    /* the strict rule must stay strict exactly where a name becomes a path */
    images: { Hero: "uploads/x.jpg", hero: "uploads/x.jpg" },
    captions: { Hero: "no", hero: "yes" },
    overrides: { "Westex-Ultima": { hidden: true }, "westex-ultima": { hidden: true } },
  }) }), env, ctx);

  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();
  check("a camelCase content key survives", doc.content.heroTitle === "camelCase");
  check("so do the other camelCase ones",
    doc.content.mapEmbed === "https://maps" && doc.content.aboutBody === "two\n\nparas");
  check("a kebab-case content key survives", doc.content["type-carpets"] === "kebab-case");
  check("a lowercase content key still survives", doc.content.proof1 === "lower and a digit");
  check("a colon in a content key is refused", doc.content["has:colon"] === undefined);
  check("so are spaces, dots, a leading digit and 70 characters",
    doc.content["has space"] === undefined && doc.content["has.dot"] === undefined
    && doc.content["1leading"] === undefined && doc.content["x".repeat(70)] === undefined);

  /* An upload names a file after its slot. A capital would be accepted by the
     upload route, mint a path, and then be refused here — a photograph in the
     bucket that nothing on the site can ever point at. */
  check("an image slot with a capital is still refused", doc.images.Hero === undefined);
  check("and the lowercase one is kept", doc.images.hero === "uploads/x.jpg");
  check("a caption slot with a capital is still refused", doc.captions.Hero === undefined);
  check("an override id with a capital is still refused",
    doc.overrides["Westex-Ultima"] === undefined);
  check("and the real id survives", doc.overrides["westex-ultima"].hidden === true);
}

console.log("\nWording the shop has switched off:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  const many = {};
  for (let i = 0; i < 300; i++) many["k" + i] = true;
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0,
    content: { instaHeading: "Recent work" },
    off: { instaHeading: true, notTrue: "yes", alsoNot: 1, "has:colon": true, ...many },
  }) }), env, ctx);

  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();
  check("a switched-off key is stored", doc.off.instaHeading === true);
  check("but the wording is not thrown away", doc.content.instaHeading === "Recent work");
  check("only true counts", doc.off.notTrue === undefined && doc.off.alsoNot === undefined);
  check("a colon in an off key is refused", doc.off["has:colon"] === undefined);
  check("the map is capped", Object.keys(doc.off).length <= 200,
    `${Object.keys(doc.off).length} keys`);
}

console.log("\nAn older stored document still opens:");
{
  /* a document written before `off` and `portfolio` existed */
  const env = makeEnv({ objects: {
    "admin/site.json": JSON.stringify({ version: 3, content: { hours: "Mon-Sat" } }) } });
  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();
  check("its wording is intact", doc.content.hours === "Mon-Sat");
  check("and the new shapes are there to read", doc.off && typeof doc.off === "object"
    && Array.isArray(doc.portfolio));
}

console.log("\nPhoto upload:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

  let res = await adminRoutes(req("/api/admin/photo?range=my-range&name=oatmeal",
    { method: "POST", headers, body: jpeg }), env, ctx);
  check("a JPEG is stored", res.status === 200);
  check("under the path the site reads",
    env.PHOTOS._store.has("assets/swatches/my-range/oatmeal.jpg"));

  res = await adminRoutes(req("/api/admin/photo?range=my-range&name=x",
    { method: "POST", headers, body: new Uint8Array([0x3c, 0x73, 0x76, 0x67]) }), env, ctx);
  check("a non-JPEG is refused whatever it claims to be", res.status === 415);

  res = await adminRoutes(req("/api/admin/photo?range=../../etc&name=passwd",
    { method: "POST", headers, body: jpeg }), env, ctx);
  check("a traversal attempt is refused", res.status === 400);

  res = await adminRoutes(req("/api/admin/photo?range=r&name=n",
    { method: "POST", headers: { ...headers, "content-length": String(9 * 1024 * 1024) }, body: jpeg }),
    env, ctx);
  check("an oversized upload is refused", res.status === 413);

  res = await adminRoutes(req("/api/admin/photo?range=r&name=n",
    { method: "POST", headers: { origin: ORIGIN }, body: jpeg }), env, ctx);
  check("an unauthenticated upload is refused", res.status === 401);
}

console.log("\nReplacing a photograph:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const upload = (slot, body = jpeg, h = headers) => adminRoutes(
    req(`/api/admin/upload?slot=${encodeURIComponent(slot)}`, { method: "POST", headers: h, body }),
    env, ctx);

  let res = await upload("hero");
  check("a site photograph uploads", res.status === 200);
  const first = (await res.json()).path;
  check("stored under uploads/", /^uploads\/hero-[0-9a-f]{10}\.jpg$/.test(first), first);

  /* /assets/ is cached immutably for a year, so the same path twice would show
     the old picture until 2027 */
  res = await upload("hero");
  const second = (await res.json()).path;
  check("uploading again never reuses the path", first !== second, `${first} vs ${second}`);
  check("both files are kept", env.PHOTOS._store.has("assets/" + first)
    && env.PHOTOS._store.has("assets/" + second));

  res = await upload("range:westex-ultima");
  check("a collection photograph uploads", res.status === 200);
  check("its colon is not in the filename", !(await res.json()).path.includes(":"));

  res = await upload("../../etc/passwd");
  check("a traversal attempt in the slot is refused", res.status === 400);
  res = await upload("a:b:c:d");
  check("an over-deep slot is refused", res.status === 400);
  res = await upload("hero", new Uint8Array([0x3c, 0x73, 0x76, 0x67]));
  check("a non-JPEG is refused", res.status === 415);
  res = await upload("hero", jpeg, { origin: ORIGIN });
  check("an unauthenticated upload is refused", res.status === 401);
  res = await upload("hero", jpeg, { ...(await signedIn()), origin: "https://evil.example" });
  check("a cross-site upload is refused", res.status === 403);
}

console.log("\nOnly paths this admin wrote can be pointed at:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0,
    images: {
      hero: "uploads/hero-abc1234567.jpg",
      "range:westex-ultima": "uploads/range-westex-ultima-0011223344.jpg",
      "shade:westex-ultima:alabaster": "uploads/shade-x-1122334455.jpg",
      "bad slot": "uploads/x-1122334455.jpg",
      "a:b:c:d": "uploads/x-1122334455.jpg",
      offsite: "https://evil.example/tracker.gif",
      escape: "uploads/../../../etc/passwd",
      notjpg: "uploads/x-1122334455.svg",
      elsewhere: "assets/swatches/westex-ultima/alabaster.jpg",
    },
  }) }), env, ctx);
  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();
  check("a site slot is kept", doc.images.hero === "uploads/hero-abc1234567.jpg");
  check("a collection slot is kept", Boolean(doc.images["range:westex-ultima"]));
  check("a shade slot is kept", Boolean(doc.images["shade:westex-ultima:alabaster"]));
  check("a malformed slot is dropped", doc.images["bad slot"] === undefined);
  check("an over-deep slot is dropped", doc.images["a:b:c:d"] === undefined);
  check("an off-site URL is refused", doc.images.offsite === undefined);
  check("a traversal path is refused", doc.images.escape === undefined);
  check("a non-jpg path is refused", doc.images.notjpg === undefined);
  check("a path outside uploads/ is refused", doc.images.elsewhere === undefined);
}

console.log("\nReviews and Instagram are checked before they are stored:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0,
    reviews: {
      rating: "4.9", count: "37", url: "https://g.page/haris-carpets",
      items: [
        { text: "Lovely job on the stairs.", name: "Sam" },
        { text: "   ", name: "Blank" },
        { text: "No name given" },
      ],
    },
    instagram: {
      url: "javascript:alert(1)",
      posts: [
        { image: "uploads/insta-0-1122334455.jpg", link: "https://www.instagram.com/p/abc/" },
        { image: "uploads/insta-1-1122334455.jpg", link: "javascript:alert(1)" },
        { image: "https://evil.example/tracker.gif", link: "https://ok.example" },
        { image: "uploads/../../etc/passwd", link: "https://ok.example" },
      ],
    },
  }) }), env, ctx);
  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();

  check("the rating is kept", doc.reviews.rating === "4.9");
  check("the listing link is kept", doc.reviews.url.includes("g.page"));
  check("an empty review is dropped", doc.reviews.items.length === 2);
  check("a review with no name is kept", doc.reviews.items[1].name === "");
  check("a javascript: profile link is refused", doc.instagram.url === "");
  check("a good post survives", doc.instagram.posts[0].link.includes("instagram.com"));
  check("a javascript: post link is stripped", doc.instagram.posts[1].link === "");
  check("but the post itself is kept", doc.instagram.posts.length === 2);
  check("an off-site image is dropped", !doc.instagram.posts.some((p) => p.image.startsWith("http")));
  check("a traversal image path is dropped",
    !doc.instagram.posts.some((p) => p.image.includes("..")));
}

console.log("\nOne save cannot leak into the next:");
{
  /* The blank document used to be a shared constant, so spreading it handed
     every request the same images map — writing a slot edited the blank
     document itself and it stayed edited for the life of the isolate. Two
     unrelated shops in one Worker is the alarming version; the visible one is
     that removing a photograph never took. */
  const a = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN };
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0, images: { hero: "uploads/hero-aaaaaaaaaa.jpg" },
  }) }), a, ctx);

  /* a completely separate bucket, saving nothing at all */
  const b = makeEnv();
  cacheStore = new Map();
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 0,
  }) }), b, ctx);
  cacheStore = new Map();
  const fresh = await (await adminRoutes(req("/api/site"), b, ctx)).json();
  check("a slot saved elsewhere does not appear", Object.keys(fresh.images).length === 0,
    JSON.stringify(fresh.images));

  /* and removing one from the document it belongs to really removes it */
  cacheStore = new Map();
  await adminRoutes(req("/api/admin/site", { method: "PUT", headers, body: JSON.stringify({
    baseVersion: 1, images: {},
  }) }), a, ctx);
  cacheStore = new Map();
  const cleared = await (await adminRoutes(req("/api/site"), a, ctx)).json();
  check("clearing a slot sticks", Object.keys(cleared.images).length === 0,
    JSON.stringify(cleared.images));
}

/* The enquiry inbox holds names, emails and phone numbers belonging to members
   of the public. Everything about it is an auth question first. */
/* The shop uploads collections for a living. This is the bug that let them do
   it for weeks into a save that was throwing the work away. */
console.log("\nA save that cannot take everything says so:");
{
  const env = makeEnv();
  const headers = { ...(await signedIn()), origin: ORIGIN, "content-type": "application/json" };
  const put = (body) => adminRoutes(req("/api/admin/site",
    { method: "PUT", headers, body: JSON.stringify(body) }), env, ctx);

  const many = (n) => Array.from({ length: n }, (_, i) => ({
    id: "mill-" + i, type: "carpets", brand: "Mill", name: "Range " + i,
    colours: [{ name: "Oatmeal", hex: "#ddccbb" }],
  }));

  /* 200 used to be the ceiling, and everything past it went in the bin with a
     200 OK and the word "Saved". */
  const ok = await put({ baseVersion: 0, ranges: many(260) });
  const okBody = await ok.json();
  check("260 collections is a normal save now", ok.status === 200 && okBody.ok === true);
  check("with nothing lost", okBody.dropped.length === 0, JSON.stringify(okBody.dropped));
  cacheStore = new Map();
  const doc = await (await adminRoutes(req("/api/site"), env, ctx)).json();
  check("and all of them are on the site", doc.ranges.length === 260, `${doc.ranges.length}`);
  check("including the last one added",
    doc.ranges.some((r) => r.id === "mill-259"));

  /* There is still a ceiling. What must never happen again is reaching it
     quietly. */
  const over = await put({ baseVersion: okBody.version, ranges: many(1203) });
  const overBody = await over.json();
  check("past the limit it still saves what it can", overBody.ok === true);
  check("but names what it would not take", overBody.dropped.length === 1, JSON.stringify(overBody.dropped));
  check("and says how many", /3 collection/.test(overBody.dropped[0]), overBody.dropped[0]);

  /* A name too long to store was the other way a collection vanished. */
  const longName = "x".repeat(70);
  const named = await put({ baseVersion: overBody.version,
    ranges: [{ id: longName, type: "carpets", name: "Trade Winds", colours: [] }] });
  const namedBody = await named.json();
  check("a collection whose id cannot be stored is reported",
    namedBody.dropped.length === 1 && /Trade Winds/.test(namedBody.dropped[0]),
    JSON.stringify(namedBody.dropped));

  /* And the shades inside one. */
  const shades = await put({ baseVersion: namedBody.version,
    ranges: [{ id: "fine", type: "carpets", name: "Fine", colours: [
      { name: "Good", hex: "#aabbcc" }, { name: "", hex: "#aabbcc" }, { name: "No hex", hex: "red" }] }] });
  const shadeBody = await shades.json();
  check("shades that cannot be stored are counted",
    shadeBody.dropped.length === 1 && /2 shade/.test(shadeBody.dropped[0]),
    JSON.stringify(shadeBody.dropped));

  /* A clean save must stay clean, or the warning becomes noise. */
  const clean = await put({ baseVersion: shadeBody.version,
    ranges: [{ id: "fine", type: "carpets", name: "Fine", colours: [{ name: "Good", hex: "#aabbcc" }] }] });
  check("an ordinary save reports nothing", (await clean.json()).dropped.length === 0);
}

console.log("\nThe enquiry inbox is not readable by anyone else:");
{
  const env = makeEnv({ objects: {
    "admin/enquiries/2026-08-18T09-00-00-000Z-aaaa1111.json":
      JSON.stringify({ name: "Jo Bloggs", email: "jo@example.com", message: "Stairs please",
                       at: "2026-08-18T09:00:00.000Z", read: false }),
    "admin/enquiries/2026-08-17T09-00-00-000Z-bbbb2222.json":
      JSON.stringify({ name: "Older One", email: "old@example.com", message: "Hello",
                       at: "2026-08-17T09:00:00.000Z", read: true }),
  } });

  const anon = await adminRoutes(req("/api/admin/enquiries"), env, ctx);
  check("a stranger gets nothing", anon.status === 401);
  const anonBody = await anon.json();
  check("and not a hint of anybody's details",
    !JSON.stringify(anonBody).includes("jo@example.com"));

  const headers = { ...(await signedIn()), origin: ORIGIN };
  const listed = await (await adminRoutes(req("/api/admin/enquiries", { headers }), env, ctx)).json();
  check("signed in, they are all there", listed.enquiries.length === 2);
  check("newest first", listed.enquiries[0].name === "Jo Bloggs", listed.enquiries[0].name);
  check("with an unread count", listed.unread === 1);
  check("and each one carries its id", Boolean(listed.enquiries[0].id));
}

console.log("\nReading and deleting an enquiry:");
{
  const key = "admin/enquiries/2026-08-18T09-00-00-000Z-aaaa1111.json";
  const env = makeEnv({ objects: { [key]:
    JSON.stringify({ name: "Jo", email: "jo@example.com", read: false }) } });
  const headers = { ...(await signedIn()), origin: ORIGIN };
  const id = "2026-08-18T09-00-00-000Z-aaaa1111.json";

  await adminRoutes(req(`/api/admin/enquiries?id=${id}`, { method: "POST", headers }), env, ctx);
  check("marking it read sticks",
    JSON.parse(env.PHOTOS._store.get(key)).read === true);
  await adminRoutes(req(`/api/admin/enquiries?id=${id}&read=0`, { method: "POST", headers }), env, ctx);
  check("and marking it unread again does too",
    JSON.parse(env.PHOTOS._store.get(key)).read === false);

  await adminRoutes(req(`/api/admin/enquiries?id=${id}`, { method: "DELETE", headers }), env, ctx);
  check("deleting removes it", !env.PHOTOS._store.has(key));
}

console.log("\nAn id cannot reach outside the inbox:");
{
  const env = makeEnv({ objects: { "admin/site.json": JSON.stringify({ version: 9 }) } });
  const headers = { ...(await signedIn()), origin: ORIGIN };
  /* Without the id check, "../site.json" here would delete everything the shop
     has ever written. */
  for (const evil of ["../site.json", "..%2Fsite.json", "a/b.json", "site.json", ""]) {
    await adminRoutes(req(`/api/admin/enquiries?id=${encodeURIComponent(evil)}`,
      { method: "DELETE", headers }), env, ctx);
  }
  check("the shop's content is untouched", env.PHOTOS._store.has("admin/site.json"),
    [...env.PHOTOS._store.keys()].join(", "));
  const res = await adminRoutes(req("/api/admin/enquiries?id=../site.json",
    { method: "DELETE", headers }), env, ctx);
  check("and a traversal is a 404, not a 500", res.status === 404);
}

console.log("\nThe public read is public, and read-only:");
{
  const env = makeEnv();
  cacheStore = new Map();
  const res = await adminRoutes(req("/api/site"), env, ctx);
  check("/api/site needs no sign-in", res.status === 200);
  cacheStore = new Map();
  const post = await adminRoutes(req("/api/site", { method: "POST", body: "{}" }), env, ctx);
  check("but cannot be written to", post.status === 404);
  const unknown = await adminRoutes(req("/api/nope"), env, ctx);
  check("an unknown api route 404s", unknown.status === 404);
  const notApi = await adminRoutes(req("/catalogue"), env, ctx);
  check("a normal page is left alone", notApi === null);
}

console.log("\nA corrupt stored document does not take the site down:");
{
  const env = makeEnv({ objects: { "admin/site.json": "{ this is not json" } });
  cacheStore = new Map();
  const res = await adminRoutes(req("/api/site"), env, ctx);
  check("it serves an empty overlay instead", res.status === 200);
  check("with the shape the site expects", Array.isArray((await res.json()).ranges));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
