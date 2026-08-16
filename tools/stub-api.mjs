/**
 * A stand-in for Cloudflare, so the admin page can be driven end to end here.
 *
 *     node tools/stub-api.mjs <port> [signed-in|anon|unconfigured|down]
 *
 * Serves public/ and answers /api/* in memory. It deliberately does NOT verify
 * anything — auth is covered properly in admin.test.mjs against real signatures.
 * What this exists for is the wiring: that the admin page reads and writes the
 * shapes the Worker actually uses, and that the shop copes when it cannot.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { loadAdmin } from "./load-worker.mjs";

const ROOT = new URL("../public/", import.meta.url).pathname;
const PORT = Number(process.argv[2] || 8890);
const MODE = process.argv[3] || "signed-in";  // …| stale = a Worker older than the page
const PASSWORD = "correct-horse-battery-staple";
let session = null;

/* The real validator, not a copy of it.

   This stub used to echo the posted document straight back, which made the
   41-field sweep in admin-e2e.mjs prove only that the *browser* sent the value.
   The Worker was meanwhile dropping every camelCase key on the floor, so 28 of
   the admin's 44 boxes saved nothing and every test still passed. Running the
   shipped clean() here means the stub and the Worker cannot disagree about what
   survives a save. */
const { clean, empty } = await loadAdmin();

let DOC = empty();

/* Uploads are kept in memory and served back from /assets/, because a stub
   that accepts a photograph and then 404s it is not testing the thing that
   matters: the site has to end up showing the picture. */
const UPLOADS = new Map();

/* Set with ?feed= on the stub's own port to pretend Instagram is answering. */
let LIVE_FEED = { posts: [], live: false };

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
                ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json",
                ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const send = (res, code, body) =>
  res.writeHead(code, { "content-type": "application/json" }).end(body);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  if (p.startsWith("/api/")) {
    if (MODE === "down") return send(res, 500, '{"error":"boom"}');
    if (p === "/api/site") return send(res, 200, JSON.stringify(DOC));
    /* the live Instagram feed, off unless a test turns it on */
    if (p === "/api/instagram") return send(res, 200, JSON.stringify(LIVE_FEED));
    if (MODE === "unconfigured") return send(res, 503, '{"error":"Sign-in is not set up yet."}');

    /* password mode: the gate offers a box, and the right password gets in.
       "both" is the live shape — Access configured AND a password set — which
       is the combination that shipped a sign-in form with no input in it. */
    if (MODE === "password" || MODE === "both") {
      const signedIn = (req.headers.cookie || "").includes("haris_admin=" + session);
      if (p === "/api/admin/login" && req.method === "POST") {
        let body = ""; for await (const c of req) body += c;
        if (JSON.parse(body).password !== PASSWORD) {
          return send(res, 401, '{"error":"That password is not right."}');
        }
        session = "stub-session";
        return res.writeHead(200, { "content-type": "application/json",
          "set-cookie": `haris_admin=${session}; Path=/; HttpOnly; SameSite=Strict` })
          .end('{"ok":true}');
      }
      if (!signedIn || !session) {
        return send(res, 401, '{"error":"not signed in","reason":"no token",'
          + `"methods":{"access":${MODE === "both"},"password":true}}`);
      }
    }

    /* a deploy that predates password sign-in: no methods field at all */
    if (MODE === "stale") return send(res, 401, '{"error":"not signed in","reason":"no token"}');
    /* Access configured but the host is workers.dev, where it can never apply */
    if (MODE === "anon") return send(res, 401, '{"error":"not signed in","reason":"no token","methods":{"access":true,"password":false}}');
    if (p === "/api/admin/whoami") return send(res, 200, '{"email":"hari@haris-carpets.co.uk"}');
    if (p === "/api/admin/site" && req.method === "PUT") {
      let body = ""; for await (const c of req) body += c;
      const input = JSON.parse(body);
      if (input.baseVersion !== DOC.version) return send(res, 409, '{"error":"stale"}');
      DOC = clean(input);
      DOC.version = input.baseVersion + 1;
      DOC.updated = new Date().toISOString();
      return send(res, 200, JSON.stringify({ ok: true, version: DOC.version }));
    }
    if (p === "/api/admin/photo") {
      for await (const _ of req) { /* drain the upload */ }
      return send(res, 200, JSON.stringify({ ok: true, file: url.searchParams.get("name") }));
    }
    if (p === "/api/admin/upload") {
      const chunks = []; for await (const c of req) chunks.push(c);
      const slot = (url.searchParams.get("slot") || "photo").replace(/:/g, "-");
      const path = `uploads/${slot}-${Math.random().toString(16).slice(2, 12)}.jpg`;
      UPLOADS.set("/assets/" + path, Buffer.concat(chunks));
      return send(res, 200, JSON.stringify({ ok: true, path, url: "/assets/" + path }));
    }
    return send(res, 404, "{}");
  }

  /* test hook: /_feed?n=3 turns the live feed on, ?n=0 turns it off */
  if (p === "/_feed") {
    const n = Number(url.searchParams.get("n") || 0);
    LIVE_FEED = { live: n > 0, posts: Array.from({ length: n }, (_, i) => ({
      image: `https://scontent.example/live-${i}.jpg`,
      link: `https://www.instagram.com/p/live${i}/`,
      caption: `Live post ${i}`,
    })) };
    return send(res, 200, JSON.stringify(LIVE_FEED));
  }

  if (UPLOADS.has(p)) {
    return res.writeHead(200, { "content-type": "image/jpeg" }).end(UPLOADS.get(p));
  }

  const file = join(ROOT, normalize(p.endsWith("/") ? p + "index.html" : p));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end("no");
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(data);
  } catch { res.writeHead(404).end("not found"); }
}).listen(PORT, () => console.log(`stub-api on ${PORT} (${MODE})`));
