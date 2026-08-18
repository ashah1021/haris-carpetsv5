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

/* "Require app secret" in the Meta app's advanced settings. With it on, Meta
 * refuses any call that does not carry an appsecret_proof: an HMAC-SHA256 of
 * the access token, keyed with the app secret. It is the more secure setting
 * and the dashboard nudges people towards it, so this is sent whenever the app
 * secret is configured — harmless when the setting is off, essential when it
 * is on, and it means the toggle can be flipped either way without anybody
 * having to remember that this exists.
 *
 * INSTAGRAM_APP_SECRET is optional. Without it the calls go out unsigned, which
 * is what happened before this existed. */
async function proofFor(env, token) {
  const secret = typeof env.INSTAGRAM_APP_SECRET === "string" && env.INSTAGRAM_APP_SECRET.trim();
  if (!secret) return "";
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

/* Named apart from the identical helper in worker-admin.js: the two live in
   separate module scopes in production, but the test loader inlines both into
   one and a duplicate declaration is a syntax error there. */
const reply = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    /* no-store, like every other JSON route here. Without it a browser is
       entitled to cache this heuristically, and then reloading the page to see
       whether the feed has come to life shows you the answer from before you
       fixed it — which is a miserable thing to debug. */
    headers: { "content-type": "application/json; charset=utf-8",
               "cache-control": "no-store", ...extra },
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

/* Every token worth trying, best first.
 *
 * This used to be `stored || configured`, full stop, and that is a trap with no
 * way out of it from a browser. The moment anything was written to R2 the
 * Cloudflare secret was never read again — so resetting the token in Meta, which
 * kills the stored one, left the Worker using a dead token and ignoring the new
 * secret for ever. Clearing it needed wrangler, which is exactly what somebody
 * on a phone does not have.
 *
 * So: try the stored one first, because a refreshed token is newer than the
 * secret it came from, then fall back to the secret. The one that works wins and
 * gets stored, which drops the dead one. */
async function tokens(env) {
  const stored = await readJson(env, TOKEN_KEY);
  return [stored && stored.token, env.INSTAGRAM_TOKEN]
    .map((t) => (typeof t === "string" ? t.trim() : ""))   /* a pasted value can carry a newline */
    .filter(Boolean)
    .filter((t, i, all) => all.indexOf(t) === i);
}

/* What this string is, if it is not a token.
 *
 * The App ID, the App Secret and the access token sit within a few clicks of
 * each other in Meta's dashboard and only one of them works here. Recognising
 * the wrong one and saying which it is beats sending it to Instagram and
 * relaying "Cannot parse access token" back — which tells somebody nothing
 * about what to go and fetch instead.
 *
 * It also keeps the App Secret out of Meta's request logs. That is the more
 * dangerous of the two to leak, and there is no reason to transmit it once we
 * can see what it is. */
function wrongShape(token) {
  if (/^[0-9a-f]{32}$/i.test(token)) {
    return "that is the App Secret \u2014 32 characters of hex \u2014 not an access token";
  }
  if (/^\d{8,25}$/.test(token)) return "that is the App ID, not an access token";
  /* Nothing else is refused here. Only those two are unmistakable; anything
     else is Instagram's call, not ours, and a guess at "too short" would one
     day reject a perfectly good token because the format had changed. */
  return "";
}

/* A refusal reads better with a nudge attached when the string was never
   token-shaped to begin with. A hint, not a rule — Instagram has already
   decided; this only helps somebody act on its answer. */
const looksLikeToken = (t) => /^IG[A-Za-z]/.test(t) && t.length >= 50;

const TOKEN_HELP = " An Instagram access token is 150\u2013200 characters and starts IGAA or IGQ."
  + " In the Meta app dashboard it is under Instagram \u2192 API setup, as"
  + " \u201cGenerate access token\u201d beside the connected account.";

/* Whatever Instagram said, trimmed, and with any echo of the token taken back
   out. Some APIs quote the offending value at you, and this one ends up on a
   public endpoint. */
function refusal(body, token) {
  const said = String((body && body.error && (body.error.message || body.error.type))
    || "no reason given").slice(0, 160);
  return token ? said.split(token).join("[token]") : said;
}

/**
 * Ask Instagram for the newest posts.
 *
 * Returns { posts, reason, configured }. posts is null on any failure, so the
 * caller can fall back rather than replacing a good feed with an empty one —
 * and `reason` says which failure it was, because "no posts" has four causes
 * that are fixed in four different places.
 */
async function fetchFeed(env) {
  const candidates = await tokens(env);
  if (!candidates.length) {
    return { posts: null, configured: false,
      reason: "No token. Set INSTAGRAM_TOKEN as a secret in Cloudflare, then redeploy." };
  }

  const fields = "id,caption,media_url,permalink,media_type,thumbnail_url,timestamp";
  let last = "no reason given";

  for (const token of candidates) {
    const wrong = wrongShape(token);
    if (wrong) {
      last = "The value set as the token isn't one \u2014 " + wrong + "." + TOKEN_HELP;
      continue;   /* not sent anywhere: see wrongShape() */
    }

    const proof = await proofFor(env, token);
    const url = `${GRAPH}/me/media?fields=${fields}&limit=12`
      + `&access_token=${encodeURIComponent(token)}`
      + (proof ? `&appsecret_proof=${proof}` : "");

    let res, body;
    try {
      res = await fetch(url, { cf: { cacheTtl: 0 } });
      body = await res.json();
    } catch (err) {
      last = "Couldn't reach Instagram: " + ((err && err.message) || "request failed");
      continue;
    }
    if (!res.ok || (body && body.error)) {
      const said = refusal(body, token);
      /* This refusal has one cause and a one-line fix, so it is worth
         recognising rather than passing straight through. */
      const needsProof = /appsecret_proof|app secret/i.test(said)
        && !(await proofFor(env, token));
      last = "Instagram refused the token — " + said
        + (needsProof
          ? ". The app has \u201cRequire app secret\u201d switched on, so either turn that"
            + " off in the Meta app\u2019s advanced settings, or add the app secret to"
            + " Cloudflare as a second secret called INSTAGRAM_APP_SECRET and redeploy."
          : looksLikeToken(token) ? "" : "." + TOKEN_HELP);
      continue;   /* the stored one may be dead; the configured one may not be */
    }

    const posts = (body.data || [])
      /* a video's media_url is the video file; its still is thumbnail_url */
      .map((m) => ({
        image: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
        link: m.permalink,
        caption: typeof m.caption === "string" ? m.caption.slice(0, 200) : "",
        at: m.timestamp || "",
      }))
      .filter((p) => p.image && p.link);

    if (!posts.length) {
      return { posts: null, configured: true,
        reason: "The token works, but the account returned no pictures we can show." };
    }
    return { posts, configured: true, token };
  }

  return { posts: null, configured: true, reason: last };
}

/**
 * GET /api/instagram — the posts, from cache unless it has gone stale.
 * Always answers with something: a stale feed beats an empty one.
 */
export async function instagramRoute(request, env, ctx) {
  const cached = await readJson(env, FEED_KEY);
  const fresh = cached && Date.now() - (cached.at || 0) < FEED_TTL;

  if (fresh) return reply({ posts: cached.posts, at: cached.at, live: true });

  const { posts, reason, configured, token } = await fetchFeed(env);
  if (posts) {
    const doc = { posts, at: Date.now() };
    ctx.waitUntil(writeJson(env, FEED_KEY, doc));
    /* Whichever token just worked is the one to keep, so a dead stored token
       stops being tried the moment a good secret replaces it. */
    ctx.waitUntil(keepToken(env, token));
    return reply({ posts, at: doc.at, live: true });
  }

  /* Instagram said no. Hand back the last good feed if there is one — old
     posts are a far smaller problem than an empty section. */
  if (cached?.posts?.length) {
    return reply({ posts: cached.posts, at: cached.at, live: true, stale: true });
  }

  /* Nothing to show, so say why. "live: false" on its own cannot tell the
     difference between a secret that never arrived and a token Instagram
     refused, and those are fixed in completely different places — one in the
     Cloudflare dashboard, one in the Meta app. The shop cannot read Worker
     logs from a phone, so the answer goes here, in words, the same way the
     admin sign-in gate names its own fault instead of making somebody guess.
     The token itself never appears: see refusal(). */
  console.error("instagram feed empty:", reason);
  return reply({ posts: [], live: false, configured, reason });
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

  const { posts, token: worked } = await fetchFeed(env);
  if (posts) {
    await writeJson(env, FEED_KEY, { posts, at: Date.now() });
    await keepToken(env, worked);
  }
}

/** Remember the token that worked, unless it is already the one we remember. */
async function keepToken(env, token) {
  if (!token) return;
  try {
    const stored = await readJson(env, TOKEN_KEY);
    if (stored && stored.token === token) return;
    await writeJson(env, TOKEN_KEY, { token, refreshedAt: Date.now(), expiresIn: null });
  } catch { /* the feed still went out, which is the part that matters */ }
}
