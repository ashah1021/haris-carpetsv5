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

import { adminRoutes } from "./worker-admin.js";
import { instagramRoute, instagramCron } from "./worker-instagram.js";

const PHOTO_DIR = "/assets/";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/** Photography under /assets/ comes from R2 — including the nested per-colour
 *  swatch and roomset tiles (/assets/swatches/<range>/<colour>.jpg).
 *  Floor masks are the exception: they are .png, they live in the bundle, and
 *  the visualiser must keep working when the bucket does not. */
function photoKey(pathname) {
  if (!pathname.startsWith(PHOTO_DIR)) return null;
  const name = pathname.slice(PHOTO_DIR.length);
  if (name.startsWith("masks/")) return null;
  // at most two folders deep, no traversal, jpg only
  if (!/^(?:[A-Za-z0-9._-]+\/){0,2}[A-Za-z0-9._-]+\.jpg$/.test(name)) return null;
  if (name.split("/").some((seg) => seg === "." || seg === "..")) return null;
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
    /* The admin API and the shop's own settings. Answered before the photo
       route because /api/ is not a photograph, and before static assets
       because there is no file there to serve. */
    if (env.PHOTOS) {
      try {
        if (new URL(request.url).pathname === "/api/instagram") {
          return await instagramRoute(request, env, ctx);
        }
        const res = await adminRoutes(request, env, ctx);
        if (res) return res;
      } catch (err) {
        console.error("admin route failed:", err && err.message);
        return new Response(JSON.stringify({ error: "admin unavailable" }),
          { status: 500, headers: { "content-type": "application/json" } });
      }
    }

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

  /* Keeps the Instagram token alive and the feed warm. See worker-instagram.js
     — a token lapsing is the failure this whole arrangement is built around. */
  async scheduled(event, env, ctx) {
    if (env.PHOTOS) ctx.waitUntil(instagramCron(env));
  },
};
