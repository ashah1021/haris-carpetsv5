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

const ROOT = new URL("../public/", import.meta.url).pathname;
const PORT = Number(process.argv[2] || 8890);
const MODE = process.argv[3] || "signed-in";

let DOC = { version: 0, content: {}, featured: null, styles: {},
            overrides: {}, ranges: [], extra: {} };

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
    if (MODE === "unconfigured") return send(res, 503, '{"error":"Sign-in is not set up yet."}');
    if (MODE === "anon") return send(res, 401, '{"error":"not signed in"}');
    if (p === "/api/admin/whoami") return send(res, 200, '{"email":"hari@haris-carpets.co.uk"}');
    if (p === "/api/admin/site" && req.method === "PUT") {
      let body = ""; for await (const c of req) body += c;
      const input = JSON.parse(body);
      if (input.baseVersion !== DOC.version) return send(res, 409, '{"error":"stale"}');
      DOC = { ...input, version: DOC.version + 1 };
      delete DOC.baseVersion;
      return send(res, 200, JSON.stringify({ ok: true, version: DOC.version }));
    }
    if (p === "/api/admin/photo") {
      for await (const _ of req) { /* drain the upload */ }
      return send(res, 200, JSON.stringify({ ok: true, file: url.searchParams.get("name") }));
    }
    return send(res, 404, "{}");
  }

  const file = join(ROOT, normalize(p.endsWith("/") ? p + "index.html" : p));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end("no");
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(data);
  } catch { res.writeHead(404).end("not found"); }
}).listen(PORT, () => console.log(`stub-api on ${PORT} (${MODE})`));
