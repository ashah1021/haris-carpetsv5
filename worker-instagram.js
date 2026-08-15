/**
 * Hari's Carpets — the live Instagram feed.
 *
 * WHAT THIS COSTS TO RUN, BECAUSE IT IS NOT FREE
 * Instagram's Basic Display API was retired at the end of 2024. What is left is
 * the Graph API, which needs a Business or Creator account tied to a Facebook
 * Page, a Meta app, and a long-lived token that expires after 60 days. A token
 * that quietly expires empties the front page of a shop's website, so this is
 * built around that being the likeliest failure rather than an afterthought:
 *
 *   - the token is refreshed on a schedule, weeks before it would lapse
 *   - the refreshed token is kept in R2, because a Worker cannot write its own
 *     secrets; the secret is only the starting point
 *   - the last good feed is kept too, and served when Instagram is unreachable
 *   - if it is all unavailable the site falls back to the posts chosen by hand
 *     in /admin, and if there are none the section does not render
 *
 * So the worst case is the front page showing slightly old posts, then chosen
 * posts, then nothing — never a row of broken images.
 */

const TOKEN_KEY = "admin/instagram-token.json";
const FEED_KEY = "admin/instagram-feed.json";

/* Instagram's CDN links are short-lived, so the feed is refetched often enough
   that a cached URL is still good when a visitor uses it. */
const FEED_TTL = 3 * 3600 * 1000;

/* A long-lived token lasts 60 days and can be refreshed any time after 24
   hours. Refreshing weekly means five missed runs in a row before anything
   breaks. */
const REFRESH_AFTER = 7 * 86400 * 1000;

const GRAPH = "https://graph.instagram.com";

/* Named apart from the identical helper in worker-admin.js: the two live in
   separate module scopes in production, but the test loader inlines both into
   one and a duplicate declaration is a syntax error there. */
const reply = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });

async function readJson(env, key) {
  try {
    const obj = await env.PHOTOS.get(key);
    return obj ? JSON.parse(await obj.text()) : null;
  } catch { return null; }
}

const writeJson = (env, key, value) =>
  env.PHOTOS.put(key, JSON.stringify(value),
    { httpMetadata: { contentType: "application/json" } });

/** The token in use: whatever the last refresh stored, or the configured one. */
async function currentToken(env) {
  const stored = await readJson(env, TOKEN_KEY);
  return stored?.token || env.INSTAGRAM_TOKEN || "";
}

/**
 * Ask Instagram for the newest posts. Returns null on any failure, so the
 * caller can fall back rather than replacing a good feed with an empty one.
 */
async function fetchFeed(env) {
  const token = await currentToken(env);
  if (!token) return null;

  const fields = "id,caption,media_url,permalink,media_type,thumbnail_url,timestamp";
  const url = `${GRAPH}/me/media?fields=${fields}&limit=12&access_token=${encodeURIComponent(token)}`;

  let body;
  try {
    const res = await fetch(url, { cf: { cacheTtl: 0 } });
    body = await res.json();
    if (!res.ok || body.error) return null;
  } catch { return null; }

  const posts = (body.data || [])
    /* a video's media_url is the video file; its still is thumbnail_url */
    .map((m) => ({
      image: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
      link: m.permalink,
      caption: typeof m.caption === "string" ? m.caption.slice(0, 200) : "",
      at: m.timestamp || "",
    }))
    .filter((p) => p.image && p.link);

  return posts.length ? posts : null;
}

/**
 * GET /api/instagram — the posts, from cache unless it has gone stale.
 * Always answers with something: a stale feed beats an empty one.
 */
export async function instagramRoute(request, env, ctx) {
  const cached = await readJson(env, FEED_KEY);
  const fresh = cached && Date.now() - (cached.at || 0) < FEED_TTL;

  if (fresh) return reply({ posts: cached.posts, at: cached.at, live: true });

  const posts = await fetchFeed(env);
  if (posts) {
    const doc = { posts, at: Date.now() };
    ctx.waitUntil(writeJson(env, FEED_KEY, doc));
    return reply({ posts, at: doc.at, live: true });
  }

  /* Instagram said no. Hand back the last good feed if there is one — old
     posts are a far smaller problem than an empty section. */
  if (cached?.posts?.length) {
    return reply({ posts: cached.posts, at: cached.at, live: true, stale: true });
  }
  return reply({ posts: [], live: false });
}

/**
 * Runs on a schedule. Refreshes the token well before it lapses and takes a
 * fresh copy of the feed while it is here.
 */
export async function instagramCron(env) {
  const token = await currentToken(env);
  if (!token) return;

  const stored = await readJson(env, TOKEN_KEY);
  const due = !stored?.refreshedAt || Date.now() - stored.refreshedAt > REFRESH_AFTER;

  if (due) {
    try {
      const res = await fetch(
        `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (res.ok && body.access_token) {
        await writeJson(env, TOKEN_KEY, {
          token: body.access_token,
          refreshedAt: Date.now(),
          expiresIn: body.expires_in || null,
        });
      } else {
        console.error("instagram token refresh refused:", JSON.stringify(body).slice(0, 200));
      }
    } catch (err) {
      console.error("instagram token refresh failed:", err && err.message);
    }
  }

  const posts = await fetchFeed(env);
  if (posts) await writeJson(env, FEED_KEY, { posts, at: Date.now() });
}
