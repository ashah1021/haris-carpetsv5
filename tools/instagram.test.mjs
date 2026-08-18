/**
 * Tests for the live Instagram feed — worker-instagram.js.
 *
 *     node tools/instagram.test.mjs
 *
 * Everything here is about the token expiring, because that is what will
 * actually happen. It lasts 60 days, nobody is watching, and the failure is a
 * shop's front page quietly emptying six weeks after anyone last looked at it.
 * So: the refresh runs early, a refusal does not destroy the working token, and
 * every fetch failure falls back rather than replacing good posts with none.
 */
import { readFileSync } from "node:fs";

/* Loaded the same way as the other Worker modules — see load-worker.mjs for
   why a data: URL rather than a plain import. */
const source = readFileSync(new URL("../worker-instagram.js", import.meta.url), "utf8");
const ig = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

const ctx = { waitUntil(p) { return p; } };
const DAY = 86400 * 1000;

function makeEnv({ token = "starting-token", objects = {} } = {}) {
  const store = new Map(Object.entries(objects).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    INSTAGRAM_TOKEN: token,
    PHOTOS: {
      async get(key) {
        return store.has(key) ? { async text() { return store.get(key); } } : null;
      },
      async put(key, value) { store.set(key, value); },
      read(key) { return store.has(key) ? JSON.parse(store.get(key)) : null; },
      _store: store,
    },
  };
}

/* Instagram, as far as the Worker can tell. */
function instagram({ media = null, refresh = null, fail: shouldFail = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (shouldFail) throw new Error("network down");
    if (String(url).includes("refresh_access_token")) {
      return new Response(JSON.stringify(refresh || { error: { message: "expired" } }),
        { status: refresh ? 200 : 400 });
    }
    return new Response(JSON.stringify(media || { error: { message: "bad token" } }),
      { status: media ? 200 : 400 });
  };
  return calls;
}

const POST = (i) => ({
  id: String(i), media_type: "IMAGE",
  media_url: `https://cdn.example/${i}.jpg`,
  permalink: `https://www.instagram.com/p/${i}/`,
  caption: `post ${i}`, timestamp: "2026-08-01T00:00:00+0000",
});

const req = new Request("https://haris-carpets.co.uk/api/instagram");

console.log("\ninstagram feed\n");

console.log("Fetching:");
{
  const env = makeEnv();
  instagram({ media: { data: [POST(1), POST(2)] } });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("posts come back", body.posts.length === 2);
  check("each has a picture and a link",
    body.posts.every((p) => p.image.startsWith("https://") && p.link.includes("/p/")));
  check("and the feed is cached for next time", Boolean(env.PHOTOS.read("admin/instagram-feed.json")));
}

console.log("\nA video's still is used, not the video file:");
{
  const env = makeEnv();
  instagram({ media: { data: [{
    id: "v", media_type: "VIDEO",
    media_url: "https://cdn.example/clip.mp4",
    thumbnail_url: "https://cdn.example/clip.jpg",
    permalink: "https://www.instagram.com/p/v/",
  }] } });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("the thumbnail is the image", body.posts[0].image.endsWith(".jpg"), body.posts[0].image);
}

console.log("\nThe cache is used until it goes stale:");
{
  const env = makeEnv({ objects: { "admin/instagram-feed.json": {
    posts: [{ image: "https://cdn.example/old.jpg", link: "https://www.instagram.com/p/old/" }],
    at: Date.now() - 60 * 1000,
  } } });
  const calls = instagram({ media: { data: [POST(9)] } });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("a fresh cache is served without asking Instagram", calls.length === 0);
  check("and it is the cached post", body.posts[0].link.includes("/p/old/"));
}

console.log("\nWhen Instagram will not answer:");
{
  /* the token has lapsed, or Meta is having a day */
  const env = makeEnv({ objects: { "admin/instagram-feed.json": {
    posts: [{ image: "https://cdn.example/old.jpg", link: "https://www.instagram.com/p/old/" }],
    at: Date.now() - 10 * DAY,
  } } });
  instagram({ media: null });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("the last good feed is served rather than nothing", body.posts.length === 1);
  check("and it says so", body.stale === true);
  check("the good copy is not overwritten with an empty one",
    env.PHOTOS.read("admin/instagram-feed.json").posts.length === 1);
}

console.log("\nWith nothing cached and nothing answering:");
{
  const env = makeEnv();
  instagram({ media: null });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("it returns no posts rather than throwing", body.posts.length === 0);
  check("and says the feed is not live", body.live === false);

  const noToken = makeEnv({ token: "" });
  const b2 = await (await ig.instagramRoute(req, noToken, ctx)).json();
  check("an unconfigured feed is the same quiet nothing", b2.posts.length === 0 && b2.live === false);
}

console.log("\nA network error is caught, not thrown:");
{
  const env = makeEnv();
  instagram({ fail: true });
  const res = await ig.instagramRoute(req, env, ctx);
  check("the route still answers", res.status === 200);
  check("with no posts", (await res.json()).posts.length === 0);
}

console.log("\nThe token refresh — the thing that will actually go wrong:");
{
  const env = makeEnv();
  instagram({ media: { data: [POST(1)] }, refresh: { access_token: "renewed", expires_in: 5184000 } });
  await ig.instagramCron(env);
  const stored = env.PHOTOS.read("admin/instagram-token.json");
  check("a first run refreshes and stores the token", stored.token === "renewed");
  check("and records when", typeof stored.refreshedAt === "number");
  check("the feed is warmed at the same time",
    env.PHOTOS.read("admin/instagram-feed.json").posts.length === 1);
}

console.log("\nRefreshing is not done more often than it needs to be:");
{
  const env = makeEnv({ objects: { "admin/instagram-token.json": {
    token: "current", refreshedAt: Date.now() - 2 * DAY,
  } } });
  const calls = instagram({ media: { data: [POST(1)] }, refresh: { access_token: "renewed" } });
  await ig.instagramCron(env);
  check("a token refreshed two days ago is left alone",
    !calls.some((c) => c.includes("refresh_access_token")));
  check("and stays the one in use", env.PHOTOS.read("admin/instagram-token.json").token === "current");
}

console.log("\nA refused refresh does not throw away the working token:");
{
  const env = makeEnv({ objects: { "admin/instagram-token.json": {
    token: "still-good", refreshedAt: Date.now() - 30 * DAY,
  } } });
  instagram({ media: { data: [POST(1)] }, refresh: null });
  await ig.instagramCron(env);
  check("the old token is kept", env.PHOTOS.read("admin/instagram-token.json").token === "still-good");
  check("and the feed is still refreshed with it",
    env.PHOTOS.read("admin/instagram-feed.json").posts.length === 1);
}

console.log("\nThe stored token wins over the configured one:");
{
  const env = makeEnv({ token: "the-original-secret", objects: {
    "admin/instagram-token.json": { token: "the-refreshed-one", refreshedAt: Date.now() },
  } });
  const calls = instagram({ media: { data: [POST(1)] } });
  await ig.instagramRoute(req, env, ctx);
  check("the refreshed token is the one sent",
    calls.some((c) => c.includes("the-refreshed-one")) &&
    !calls.some((c) => c.includes("the-original-secret")));
}

/* The endpoint has to be able to say why it is empty. The shop is not going to
   read Worker logs from a phone, and "live: false" on its own cannot tell a
   secret that never arrived from a token Instagram refused — two problems
   fixed in two different dashboards. */
console.log("\nAn empty feed says why it is empty:");
{
  const env = makeEnv({ token: "" });
  instagram();
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("with no token it names the secret to set",
    /INSTAGRAM_TOKEN/.test(body.reason || ""), body.reason);
  check("and reports that none arrived", body.configured === false);
  check("with no posts, as before", body.live === false && body.posts.length === 0);
}
{
  const env = makeEnv({ token: "IGAAgoodlookingtoken" });
  instagram();   // no media configured, so Instagram answers with an error
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("a refused token reads as refused, not as missing", body.configured === true);
  check("and Instagram's own words come through",
    /refused the token/.test(body.reason || ""), body.reason);
  /* The one thing this must never do. The endpoint is public. */
  check("the token appears nowhere in the answer",
    !JSON.stringify(body).includes("IGAAgoodlookingtoken"));
}
{
  /* exactly that: the provider quoting the token back inside its own error */
  const env = makeEnv({ token: "IGAAsecretvalue" });
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: "Invalid OAuth access token IGAAsecretvalue - cannot parse" } }),
    { status: 400 });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("a token echoed back by Instagram is redacted out",
    !JSON.stringify(body).includes("IGAAsecretvalue"));
  check("while the rest of the message survives",
    /cannot parse/.test(body.reason || ""), body.reason);
}
{
  const env = makeEnv({ token: "IGAAfine" });
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("a working token with no pictures says so instead",
    /no pictures/.test(body.reason || ""), body.reason);
  check("and does not blame the token", body.configured === true);
}
{
  const env = makeEnv({ token: "IGAAfine" });
  instagram({ media: { data: [POST(1)] } });
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("a working feed carries no diagnostics at all",
    body.live === true && body.reason === undefined && body.configured === undefined);
}

/* Resetting the token in Meta kills whatever is stored in R2. Before this, the
   stored one was consulted first and the configured secret was never read
   again — so the only way out was wrangler, which is exactly what somebody
   fixing this from a phone has not got. */
console.log("\nA dead stored token does not shadow a freshly-set secret:");
{
  const env = makeEnv({
    token: "IGAAthe-new-secret",
    objects: { "admin/instagram-token.json": { token: "IGAAdead-stored-one", refreshedAt: Date.now() } },
  });
  const tried = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    tried.push(u.includes("IGAAdead-stored-one") ? "stored" : "secret");
    if (u.includes("IGAAdead-stored-one")) {
      return new Response(JSON.stringify({ error: { message: "Error validating access token" } }),
        { status: 400 });
    }
    return new Response(JSON.stringify({ data: [POST(1), POST(2)] }), { status: 200 });
  };
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("the stored one is tried first", tried[0] === "stored");
  check("and when it is refused the secret is tried", tried[1] === "secret", tried.join(" then "));
  check("so the feed comes back", body.live === true && body.posts.length === 2);
  check("and the dead token is replaced by the one that worked",
    env.PHOTOS.read("admin/instagram-token.json").token === "IGAAthe-new-secret",
    env.PHOTOS.read("admin/instagram-token.json").token);
}
{
  /* both refused — then it is genuinely broken and should say so */
  const env = makeEnv({
    token: "IGAAalso-bad",
    objects: { "admin/instagram-token.json": { token: "IGAAdead", refreshedAt: Date.now() } },
  });
  let calls = 0;
  globalThis.fetch = async () => { calls++;
    return new Response(JSON.stringify({ error: { message: "Error validating access token" } }),
      { status: 400 }); };
  const body = await (await ig.instagramRoute(req, env, ctx)).json();
  check("both are tried before giving up", calls === 2, `${calls} calls`);
  check("and the answer says Instagram refused it",
    /refused the token/.test(body.reason || ""), body.reason);
  check("the good token is left alone in R2",
    env.PHOTOS.read("admin/instagram-token.json").token === "IGAAdead");
}

console.log("\nThe feed is never served from a stale browser cache:");
{
  const env = makeEnv();
  instagram({ media: { data: [POST(1)] } });
  const res = await ig.instagramRoute(req, env, ctx);
  check("it says no-store", res.headers.get("cache-control") === "no-store",
    res.headers.get("cache-control"));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
