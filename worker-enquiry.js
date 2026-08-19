/**
 * Hari's Carpets — the enquiry form.
 *
 * Until this existed the form printed "Demo form — not connected yet" to real
 * visitors and threw every submission away.
 *
 * WHERE AN ENQUIRY GOES
 * Into R2, and that copy is the record. The shop reads it in /admin, replies
 * with the Reply button — which opens their own mail client addressed to the
 * customer — and deletes it when they are done. No third party sees a customer's
 * details on the way, there is no API key to leak or let lapse, and there is no
 * deliverability problem because no mail is being sent to the shop at all.
 *
 * The cost of that is real and worth stating plainly: nothing arrives to tell
 * the shop an enquiry is waiting. Somebody has to open /admin. The unread count
 * is shown on every tab for exactly that reason.
 *
 * EMAIL, IF IT IS EVER WANTED
 * Set RESEND_KEY and a copy is emailed as well, with the visitor's address in
 * Reply-To. Not having it set is a normal state, not a fault — the enquiry is
 * already safe in the bucket either way. Note Cloudflare cannot send this mail
 * itself: the send_email binding and the Email Service both need the sending
 * domain to be a zone in the account, and the shop's is on Wix. That is the
 * third time this repo has hit that same wall, after Access and WAF rate
 * limiting. MailChannels, the old free way out, ended its Workers integration
 * in 2024.
 */

/* One folder. There were two — pending and sent — back when the bucket was a
   safety net for an email that had already gone. It is the record now, so an
   enquiry has one home and a `read` flag. */
const INBOX = "admin/enquiries/";

/* How long an enquiry is kept if nobody deletes it. These are names, emails and
   phone numbers belonging to members of the public, so this is a personal-data
   store and the limit is a promise made on the privacy page — change one and
   change the other, or the page becomes a lie. Twelve months: long enough to
   pick a conversation back up, short enough to be defensible. */
const KEEP = 365 * 86400 * 1000;

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

  /* The write is the delivery. If this fails the enquiry has genuinely not
     reached anybody, and the visitor is told so rather than thanked. */
  e.read = false;
  const key = INBOX + e.at.replace(/[:.]/g, "-") + "-"
    + Math.random().toString(16).slice(2, 10) + ".json";
  try {
    await env.PHOTOS.put(key, JSON.stringify(e),
      { httpMetadata: { contentType: "application/json" } });
  } catch (err) {
    console.error("could not store enquiry:", err && err.message);
    /* Nowhere for it to go. Hand the visitor another way through, with what
       they typed still on screen. */
    return answer({ ok: false, fallback: true,
      error: "We couldn't send that just now." }, 502);
  }

  /* A copy by email as well, if the shop has set that up. Its failure is not
     the visitor's problem — the enquiry is already where the shop reads it. */
  if (env.RESEND_KEY) {
    ctx.waitUntil(sendMail(env, e).catch(() => ({ ok: false })).then((r) => {
      if (!r.ok) console.error("enquiry copy not emailed:", r.reason);
    }));
  }
  return answer({ ok: true });
}

/**
 * Let old enquiries go.
 *
 * The privacy page promises twelve months and this is what keeps that true, so
 * the two move together or the promise stops being one.
 */
export async function enquiryCron(env) {
  const now = Date.now();
  for (const obj of await list(env, INBOX)) {
    if (now - new Date(obj.uploaded || now).getTime() > KEEP) await drop(env, obj.key);
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
