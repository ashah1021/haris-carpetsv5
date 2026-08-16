/**
 * Hari's Carpets — the enquiry form, actually delivered.
 *
 * Until this existed the form on the Contact us page printed "Demo form — not
 * connected yet" to real visitors and threw every submission away.
 *
 * WHY NOT CLOUDFLARE'S OWN EMAIL
 * This is the third time this repo has run into "Cloudflare's thing only works
 * on a zone you own", so it is worth writing down. Cloudflare Access could not
 * guard the admin because the site is on workers.dev; WAF rate-limiting rules
 * are zone-scoped for the same reason; and both the send_email binding and the
 * Email Service require the sending domain to be a zone in the account. The
 * shop's domain is on Wix. None of them are available until it moves, and all
 * three become available on the same day. MailChannels, which used to be the
 * free way out of this, ended its Workers integration in 2024.
 *
 * SO: RESEND
 * One fetch, one secret, no SDK — which matters because this repo deliberately
 * has no package.json. While the domain is elsewhere we send from Resend's own
 * onboarding@resend.dev, which is allowed to deliver to the address the Resend
 * account was opened with. That address is sales@hariscarpets.co.uk, which is
 * exactly and only where these need to go, so the restriction costs nothing.
 * When the domain moves, verify it in Resend and change ENQUIRY_FROM. No code.
 *
 * The From: header must NOT claim the shop's own domain while its SPF and DKIM
 * live somewhere else. Mail claiming to be from a domain, sent to that same
 * domain, with no authority to do so, is the self-spoof pattern and lands in
 * junk or is refused outright. The visitor's address goes in Reply-To, so
 * hitting Reply in the shop's mail client does the obvious thing.
 *
 * Careful with the two domains: the mailbox is sales@hariscarpets.co.uk with no
 * hyphen, the website is haris-carpets.co.uk with one. Verifying one does not
 * authenticate the other.
 *
 * NOTHING IS LOST
 * The enquiry is written to R2 before Resend is called. If Resend is down, or
 * the key is missing, or the account is over quota, the enquiry is already
 * durable and the cron drains the backlog later. The visitor is told the truth
 * either way and never shown a thank-you for a message that went nowhere.
 */

const PENDING = "admin/enquiries/pending/";
const SENT = "admin/enquiries/sent/";

/* How long a copy is kept. These are names, emails and phone numbers belonging
   to members of the public, so the bucket is a personal-data store and the
   copies are a delivery safety net, not an archive — the shop's mailbox is the
   record. Short by design. */
const KEEP_SENT = 30 * 86400 * 1000;
const KEEP_PENDING = 90 * 86400 * 1000;

/* A form filled in and submitted inside three seconds was not filled in by a
   person. The timestamp comes from the page so it is forgeable — this is a
   tax on the careless bots, not a control, and it is worth exactly the one
   line it costs. */
const MIN_FILL_MS = 3000;
const MAX_AGE_MS = 24 * 3600 * 1000;

const MAX_BODY = 64 * 1024;

/* Named apart from the helpers in worker-admin.js (`json`) and
   worker-instagram.js (`reply`): in production these are separate module
   scopes, but tools/load-worker.mjs inlines all three into one, where a
   duplicate declaration is a syntax error. */
const answer = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const trim = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* Refused, not sanitised. This value is going into a Reply-To header, and a
   newline in it is a header-injection attempt, not a typo worth rescuing. */
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>".]+\.[^\s@,;<>"]+$/;
const cleanEmail = (v) => {
  const s = trim(v, 200);
  if (!s || /[\r\n]/.test(s) || !EMAIL.test(s)) return "";
  return s;
};

/**
 * Same-origin only. Without this, any page anywhere could post enquiries
 * through the shop's own form endpoint.
 */
function fromOurSite(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === new URL(request.url).host; }
  catch { return false; }
}

/** Everything the shop needs to read, as plain text. */
function compose(e) {
  return [
    `Name:    ${e.name}`,
    `Email:   ${e.email}`,
    e.phone ? `Phone:   ${e.phone}` : null,
    `About:   ${e.topic || "not said"}`,
    "",
    e.message || "(no message)",
    "",
    "—",
    `Sent from the website${e.page ? " (" + e.page + ")" : ""} at ${e.at}.`,
    "Reply to this email and it goes straight back to them.",
  ].filter((l) => l !== null).join("\n");
}

async function sendMail(env, e) {
  const key = env.RESEND_KEY;
  if (!key) return { ok: false, reason: "not configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.ENQUIRY_FROM || "Hari's Carpets <onboarding@resend.dev>",
      to: [env.ENQUIRY_TO || "sales@hariscarpets.co.uk"],
      reply_to: e.email,
      subject: `Website enquiry — ${e.topic || "general"} — ${e.name}`,
      text: compose(e),
    }),
  });
  if (res.ok) return { ok: true };
  /* The body can carry the shop's own API key back in an error message from a
     misconfigured proxy. Log the status, never the body. */
  return { ok: false, reason: "provider said " + res.status };
}

/**
 * POST /api/enquiry — take an enquiry, keep it, send it.
 */
export async function enquiryRoute(request, env, ctx) {
  if (request.method !== "POST") return answer({ ok: false, error: "not found" }, 405);
  if (!fromOurSite(request)) return answer({ ok: false, error: "cross-site request refused" }, 403);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) return answer({ ok: false, error: "too long" }, 413);

  /* Refused before anything is read, and refused loudly. Taking the message
     and filing it in a bucket nobody has been told to look in would be a
     backlog of customers who think they have been in touch — the same reasoning
     as the admin API, which answers 503 rather than letting everyone in when it
     has not been configured. Note a Worker cannot see a secret added after its
     last deploy: if this fires with the key set, it needs redeploying. */
  if (!env.RESEND_KEY) {
    return answer({ ok: false, fallback: true,
      error: "The contact form isn't switched on yet." }, 503);
  }

  let input;
  try { input = await request.json(); } catch { input = null; }
  if (!input || typeof input !== "object") {
    return answer({ ok: false, error: "we couldn't read that" }, 400);
  }

  /* Filled in by something that reads the markup rather than the page. Answer
     as though it worked: a 400 tells the bot which field to leave alone next
     time. Nothing is stored and nothing is sent. */
  if (trim(input.website, 200)) return answer({ ok: true });

  const started = Number(input.t);
  const age = Date.now() - started;
  if (!Number.isFinite(started) || age < MIN_FILL_MS || age > MAX_AGE_MS) {
    return answer({ ok: false, error: "Please try that once more." }, 400);
  }

  const e = {
    name: trim(input.name, 100),
    email: cleanEmail(input.email),
    phone: trim(input.phone, 40).replace(/[\r\n]/g, " "),
    topic: trim(input.topic, 60).replace(/[\r\n]/g, " "),
    message: trim(input.message, 4000),
    page: trim(input.page, 120).replace(/[\r\n]/g, " "),
    at: new Date().toISOString(),
  };
  if (!e.name) return answer({ ok: false, error: "Please add your name.", field: "name" }, 400);
  if (!e.email) {
    return answer({ ok: false, error: "That email address doesn't look right.", field: "email" }, 400);
  }

  /* Per-visitor, then a ceiling for everyone. The binding is a Worker feature
     and so works on workers.dev, where a zone-scoped WAF rule cannot. Its
     counter is per Cloudflare location and reconciled after the fact, so a
     determined distributed sender gets a few through per location — which is
     the right trade for a shop that gets a handful of enquiries a week. */
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.ENQUIRY_LIMIT && !(await env.ENQUIRY_LIMIT.limit({ key: ip })).success) {
    return answer({ ok: false, error: "Give us a moment before sending another." }, 429);
  }
  if (env.ENQUIRY_BUDGET && !(await env.ENQUIRY_BUDGET.limit({ key: "all" })).success) {
    return answer({ ok: false, error: "Give us a moment before sending another." }, 429);
  }

  /* Written down before it is sent, so a provider outage costs a delay rather
     than an enquiry. */
  const key = PENDING + e.at.replace(/[:.]/g, "-") + "-"
    + Math.random().toString(16).slice(2, 10) + ".json";
  let kept = false;
  try {
    await env.PHOTOS.put(key, JSON.stringify(e),
      { httpMetadata: { contentType: "application/json" } });
    kept = true;
  } catch (err) {
    console.error("could not store enquiry:", err && err.message);
  }

  let sent;
  try { sent = await sendMail(env, e); }
  catch (err) { sent = { ok: false, reason: err && err.message }; }

  if (sent.ok) {
    if (kept) ctx.waitUntil(fileAsSent(env, key, e));
    return answer({ ok: true });
  }

  console.error("enquiry not sent:", sent.reason);
  /* It is safely in the bucket and the cron will get it out — say so rather
     than claiming it has arrived. */
  if (kept) return answer({ ok: true, queued: true });

  /* Neither sent nor stored. The only honest answer is to hand the visitor
     another way through, with what they typed still on screen. */
  return answer({ ok: false, fallback: true,
    error: "We couldn't send that just now." }, 502);
}

async function fileAsSent(env, pendingKey, e) {
  try {
    await env.PHOTOS.put(SENT + pendingKey.slice(PENDING.length), JSON.stringify(e),
      { httpMetadata: { contentType: "application/json" } });
    await env.PHOTOS.delete(pendingKey);
  } catch (err) {
    console.error("could not file enquiry as sent:", err && err.message);
  }
}

/**
 * Drain anything the send failed on, and let old copies go.
 */
export async function enquiryCron(env) {
  const now = Date.now();

  const pending = await list(env, PENDING);
  for (const obj of pending) {
    const age = now - new Date(obj.uploaded || now).getTime();
    if (age > KEEP_PENDING) { await drop(env, obj.key); continue; }
    let e;
    try {
      const got = await env.PHOTOS.get(obj.key);
      e = got ? JSON.parse(await got.text()) : null;
    } catch { e = null; }
    if (!e) continue;
    let sent;
    try { sent = await sendMail(env, e); }
    catch { sent = { ok: false }; }
    if (sent.ok) await fileAsSent(env, obj.key, e);
  }

  /* The shop's mailbox is the record; these are only the safety net. */
  for (const obj of await list(env, SENT)) {
    if (now - new Date(obj.uploaded || now).getTime() > KEEP_SENT) await drop(env, obj.key);
  }
}

async function list(env, prefix) {
  try {
    const out = await env.PHOTOS.list({ prefix, limit: 200 });
    return out?.objects || [];
  } catch { return []; }
}

async function drop(env, key) {
  try { await env.PHOTOS.delete(key); } catch { /* it will come round again */ }
}
