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

/* How the next enquiry is answered, and what the last one contained. */
/* stand-ins for Instagram's own CDN, served from /assets by this stub */
const LIVE_PICS = ["hero-living-room.jpg", "showroom.jpg", "stairs-wool-twist.jpg",
  "velvet-living-room.jpg", "wood-herringbone-kitchen.jpg", "fitting-hands.jpg"];

/* test hook: makes the next save report one casualty, so the admin's "this did
   not save" path can be driven without posting a thousand collections. */
let DROP_NEXT = "";

let ENQUIRY_MODE = "ok";
let LAST_ENQUIRY = null;

/* The shop's inbox, keyed the way R2 keys it so the ordering the admin relies
   on (newest first, because the key starts with a timestamp) is the ordering
   under test. Seeded, because a tab that can only be tested after posting a
   form is a tab whose empty state never gets looked at. */
const seedInbox = () => new Map([
  ["2026-08-18T09-00-00-000Z-aaaa1111.json", { name: "Jo Bloggs", email: "jo@example.com",
    phone: "07700 900123", topic: "Carpets", message: "Stairs and landing please.",
    at: "2026-08-18T09:00:00.000Z", read: false }],
  ["2026-08-17T14-30-00-000Z-bbbb2222.json", { name: "Sam Patel", email: "sam@example.com",
    phone: "", topic: "Wood", message: "Herringbone in the hall.",
    at: "2026-08-17T14:30:00.000Z", read: true }],
]);
let INBOX = seedInbox();

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

    /* Enquiries. The real delivery is covered in enquiry.test.mjs against the
       Worker itself; what this exists for is the browser end — that the page
       posts what the visitor typed, and copes with each answer. */
    if (p === "/api/enquiry") {
      let body = ""; for await (const c of req) body += c;
      try { LAST_ENQUIRY = JSON.parse(body); } catch { LAST_ENQUIRY = { unparseable: body }; }
      if (ENQUIRY_MODE === "fail") return send(res, 502, '{"ok":false,"fallback":true,"error":"We couldn\'t send that just now."}');
      if (ENQUIRY_MODE === "off") return send(res, 503, '{"ok":false,"fallback":true,"error":"The contact form isn\'t switched on yet."}');
      if (ENQUIRY_MODE === "rate") return send(res, 429, '{"ok":false,"error":"Give us a moment before sending another."}');
      /* Storing it *is* the delivery in the real Worker, so the stub stores it
         too: the enquiry a visitor sends here has to turn up in the admin. */
      const at = new Date().toISOString();
      INBOX.set(at.replace(/[:.]/g, "-") + "-" + Math.random().toString(16).slice(2, 10) + ".json",
        { ...LAST_ENQUIRY, at, read: false });
      return send(res, 200, '{"ok":true}');
    }
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
      /* The real clean(), and the real list of what it would not take — the
         Worker hands this back so the admin can say what did not save. */
      const lost = [];
      DOC = clean(input, lost);
      DOC.version = input.baseVersion + 1;
      DOC.updated = new Date().toISOString();
      if (DROP_NEXT) { lost.push(DROP_NEXT); DROP_NEXT = ""; }
      return send(res, 200, JSON.stringify({ ok: true, version: DOC.version, dropped: lost }));
    }
    if (p === "/api/admin/photo") {
      for await (const _ of req) { /* drain the upload */ }
      return send(res, 200, JSON.stringify({ ok: true, file: url.searchParams.get("name") }));
    }
    if (p === "/api/admin/enquiries") {
      const id = url.searchParams.get("id") || "";
      /* the Worker's own guard, so a traversal fails here the way it fails there */
      const ok = /^[0-9A-Za-z-]{1,80}\.json$/.test(id) && INBOX.has(id);
      if (req.method === "DELETE") {
        if (!ok) return send(res, 404, '{"error":"not found"}');
        INBOX.delete(id);
        return send(res, 200, '{"ok":true}');
      }
      if (req.method === "POST") {
        if (!ok) return send(res, 404, '{"error":"not found"}');
        INBOX.get(id).read = url.searchParams.get("read") !== "0";
        return send(res, 200, JSON.stringify({ ok: true, read: INBOX.get(id).read }));
      }
      const enquiries = [...INBOX.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([key, e]) => ({ ...e, id: key }));
      return send(res, 200, JSON.stringify({ enquiries,
        unread: enquiries.filter((e) => !e.read).length }));
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
    /* n=0 answers in the shape the Worker really uses when it has nothing —
       diagnostics and all — so the admin's status line is exercised against
       what production sends rather than a simplified stand-in. */
    LIVE_FEED = { live: n > 0, ...(n > 0 ? {} : {
      configured: true, reason: "Instagram refused the token \u2014 Error validating access token" }),
      /* Real files, not scontent.example. Instagram serves absolute URLs and
         the grid handles both, but a picture that cannot load makes every
         layout assertion here meaningless — and the tiles unreadable in a
         screenshot. */
      profile: n > 0 ? { username: "hariscarpets", followers: 1417, posts: 276 } : null,
      posts: Array.from({ length: n }, (_, i) => ({
      image: LIVE_PICS[i % LIVE_PICS.length],
      link: `https://www.instagram.com/p/live${i}/`,
      caption: i % 3 === 0
        ? `Wool twist fitted to the stairs and landing on a job in Hounslow — post ${i}`
        : `Live post ${i}`,
    })) };
    return send(res, 200, JSON.stringify(LIVE_FEED));
  }

  /* test hook: /_enquiry?mode=ok|fail|off|rate picks how the next
     submission is answered; a GET with no mode hands back what was last
     posted, so a browser test can assert on what actually went over the wire
     rather than on what the page said afterwards. */
  /* test hook: /_inbox?state=seeded|empty puts the inbox back to a known state,
     so one test's deletions cannot decide what the next test sees. */
  if (p === "/_inbox") {
    const state = url.searchParams.get("state");
    if (state === "empty") INBOX = new Map();
    else if (state === "seeded") INBOX = seedInbox();
    return send(res, 200, JSON.stringify({ count: INBOX.size }));
  }

  if (p === "/_drop") {
    DROP_NEXT = url.searchParams.get("what") || "";
    return send(res, 200, JSON.stringify({ next: DROP_NEXT }));
  }

  if (p === "/_enquiry") {
    const mode = url.searchParams.get("mode");
    if (mode) ENQUIRY_MODE = mode;
    return send(res, 200, JSON.stringify({ mode: ENQUIRY_MODE, last: LAST_ENQUIRY }));
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
