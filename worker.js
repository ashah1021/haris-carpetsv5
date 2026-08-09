/**
 * Hari's Carpets — Worker in front of the static site.
 *
 * Its only real job is to serve the roomset photography out of the R2 bucket
 * instead of out of the deployment bundle, while keeping the URLs identical
 * (/assets/<name>.jpg). Because the photos then come from the site's own
 * origin, there is no CORS to configure and no dependency on the r2.dev public
 * URL, which Cloudflare rate-limits and does not intend for production traffic.
 * That matters here specifically: the visualiser reads raw canvas pixels, and
 * cross-origin images taint the canvas unless CORS is exactly right.
 *
 * Everything else falls straight through to the static assets.
 *
 * The copies committed in /assets stay as a fallback. If R2 is unreachable, or
 * an object is missing, the bundled file is served instead — so a bucket
 * problem degrades to "slightly larger images" rather than a site with no
 * photographs on it.
 */

const PHOTO_DIR = "/assets/";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Only bare .jpg filenames directly inside /assets/ come from R2.
 *  Anything nested (/assets/masks/…) stays a static asset. */
function photoKey(pathname) {
  if (!pathname.startsWith(PHOTO_DIR)) return null;
  const name = pathname.slice(PHOTO_DIR.length);
  if (!/^[A-Za-z0-9._-]+\.jpg$/.test(name)) return null;
  return "assets/" + name;
}

async function servePhoto(request, env, ctx, key) {
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;

  const object = await env.PHOTOS.get(key);
  if (!object) return null; // caller falls back to the bundled copy

  const headers = new Headers();
  object.writeHttpMetadata(headers); // content-type etc. as stored on upload
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", CACHE_CONTROL);

  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  const response = new Response(request.method === "HEAD" ? null : object.body, { headers });
  if (request.method === "GET") {
    ctx.waitUntil(cache.put(request, response.clone()));
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === "GET" || request.method === "HEAD") {
        const key = photoKey(new URL(request.url).pathname);
        if (key && env.PHOTOS) {
          const hit = await servePhoto(request, env, ctx, key);
          if (hit) return hit;
        }
      }
    } catch (err) {
      // never let a bucket problem take the site down — fall through to assets
      console.error("R2 photo fetch failed:", err && err.message);
    }
    return env.ASSETS.fetch(request);
  },
};
