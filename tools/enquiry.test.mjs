/**
 * Tests for the enquiry form — worker-enquiry.js.
 *
 *     node tools/enquiry.test.mjs
 *
 * The thing being protected here is a customer's message. Before this existed
 * the form threw every one away behind a fake "Thanks", so every assertion
 * below is really the same question asked from a different angle: did the
 * message reach somebody, or was the visitor told something untrue?
 *
 * Which is why so many of these count outbound fetches rather than reading
 * status codes. A spam submission that answers 200 *and sends the email* looks
 * identical to one that answers 200 and drops it, from the outside.
 */
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker-enquiry.js", import.meta.url), "utf8");
const eq = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${detail ? "  — " + detail : ""}`);
  ok ? pass++ : fail++;
};

const ORIGIN = "https://haris-carpets.co.uk";
const ctx = { waitUntil(p) { return p; } };
const DAY = 86400 * 1000;

function makeEnv({ key = "re_test_key", objects = {}, limit = true, budget = true,
                   breakPut = false } = {}) {
  const store = new Map(Object.entries(objects));
  return {
    RESEND_KEY: key,
    ENQUIRY_TO: "sales@hariscarpets.co.uk",
    ENQUIRY_FROM: "Hari's Carpets <onboarding@resend.dev>",
    ENQUIRY_LIMIT: { async limit() { return { success: limit }; } },
    ENQUIRY_BUDGET: { async limit() { return { success: budget }; } },
    PHOTOS: {
      async get(k) {
        return store.has(k) ? { async text() { return store.get(k).body; } } : null;
      },
      async put(k, v) {
        if (breakPut) throw new Error("bucket full");
        store.set(k, { body: v, uploaded: new Date() });
      },
      async delete(k) { store.delete(k); },
      async list({ prefix }) {
        return { objects: [...store.entries()].filter(([k]) => k.startsWith(prefix))
          .map(([key, v]) => ({ key, uploaded: v.uploaded })) };
      },
      _store: store,
    },
  };
}

/* Resend, as far as the Worker can tell. Returns the array the calls land in,
   so a test can assert on how many were made as well as what was in them. */
function resend({ status = 200, throws = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: JSON.parse(init.body) });
    if (throws) throw new Error("network down");
    return new Response(JSON.stringify({ id: "sent" }), { status });
  };
  return calls;
}

const FILLED_IN = Date.now() - 20000;
const post = (body, { origin = ORIGIN, method = "POST" } = {}) =>
  new Request(ORIGIN + "/api/enquiry", {
    method,
    headers: { origin, "content-type": "application/json", "cf-connecting-ip": "1.2.3.4" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

const GOOD = {
  name: "Jo Bloggs", email: "jo@example.com", phone: "07700 900123",
  topic: "Carpets", message: "Stairs and landing please.", website: "", t: FILLED_IN,
};

console.log("\nenquiry form\n");

console.log("A real enquiry reaches the shop:");
{
  const env = makeEnv({ key: null });   // no email set up: the normal state now
  const calls = resend();
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  const body = await res.json();
  check("the visitor is thanked", res.status === 200 && body.ok === true);
  check("with no third party involved", calls.length === 0, `${calls.length} calls`);
  const keys = [...env.PHOTOS._store.keys()];
  check("and it is in the shop's inbox", keys.length === 1 && keys[0].startsWith("admin/enquiries/"),
    keys[0]);
  const kept = JSON.parse(env.PHOTOS._store.get(keys[0]).body);
  check("with their name", kept.name === "Jo Bloggs");
  check("their email", kept.email === "jo@example.com");
  check("their phone number", kept.phone === "07700 900123");
  check("what they wrote", kept.message.includes("Stairs and landing"));
  check("and marked unread, so it shows as new", kept.read === false);
}

console.log("\nIf the enquiry cannot be stored, nobody is thanked:");
{
  /* The write is the delivery now. Failing it means the enquiry reached nobody,
     and saying "thanks" would be a lie. */
  const env = makeEnv({ key: null, breakPut: true });
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  const body = await res.json();
  check("the visitor is told it did not send", res.status === 502 && body.ok === false);
  check("and offered another way through", body.fallback === true);
}

console.log("\nEmail is a copy, not the delivery:");
{
  const env = makeEnv();   // RESEND_KEY set
  const calls = resend();
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("the visitor is thanked", (await res.json()).ok === true);
  check("a copy is emailed too", calls.length === 1);
  check("to the shop", calls[0]?.body.to[0] === "sales@hariscarpets.co.uk");
  check("replying reaches the customer", calls[0]?.body.reply_to === "jo@example.com");
  check("and it is still in the inbox regardless",
    [...env.PHOTOS._store.keys()].some((k) => k.startsWith("admin/enquiries/")));
}

console.log("\nA failed email copy is not the visitor's problem:");
{
  const env = makeEnv();
  resend({ status: 500 });
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("they are still thanked", (await res.json()).ok === true);
  check("because the enquiry is already where the shop reads it",
    [...env.PHOTOS._store.keys()].some((k) => k.startsWith("admin/enquiries/")));
}

console.log("\nCloudflare sends the notification once the domain is a zone:");
{
  /* The point of this path: the shop's customers' details never leave accounts
     the shop already controls, and the privacy policy — which names Cloudflare
     and nobody else — stays true. */
  const sent = [];
  globalThis.EmailMessage = class { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } };
  const env = makeEnv({ key: null });
  env.ENQUIRY_FROM_ADDRESS = "enquiries@haris-carpets.co.uk";
  env.SEND_EMAIL = { async send(msg) { sent.push(msg); } };
  const calls = resend();

  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("the visitor is thanked", (await res.json()).ok === true);
  check("the shop is emailed", sent.length === 1, `${sent.length} sent`);
  check("by Cloudflare, not by anybody else", calls.length === 0, `${calls.length} outbound`);
  check("to the shop's address", sent[0]?.to === "sales@hariscarpets.co.uk", sent[0]?.to);
  check("and it is still in the inbox regardless",
    [...env.PHOTOS._store.keys()].some((k) => k.startsWith("admin/enquiries/")));

  check("sent from the website's domain, not the mailbox's",
    sent[0]?.from === "enquiries@haris-carpets.co.uk", sent[0]?.from);

  const raw = sent[0]?.raw || "";
  check("replying reaches the customer",
    /^Reply-To: Jo Bloggs <jo@example\.com>$/m.test(raw), (raw.match(/Reply-To:.*/) || [])[0]);
  check("the subject says who and what",
    /^Subject: Website enquiry — Carpets — Jo Bloggs$/m.test(raw), (raw.match(/Subject:.*/) || [])[0]);
  check("what they wrote is in it", raw.includes("Stairs and landing"));
  check("headers are separated from the body properly", raw.includes("\r\n\r\n"));
  check("and it carries a Message-ID", /^Message-ID: <.+@.+>$/m.test(raw));

  /* The enquiry route refuses a CR/LF email address outright, so this is the
     second line of defence on the header it would have been written into. */
  sent.length = 0;
  await eq.enquiryRoute(post({ ...GOOD, name: "Jo\r\nBcc: everyone@example.com" }), env, ctx);
  const injected = sent[0]?.raw || "";
  const headers = injected.split("\r\n\r\n")[0];
  check("a newline in a name cannot add a header",
    !/^Bcc:/mi.test(headers), (headers.match(/Reply-To:.*/) || [])[0]);
  /* And it does not get a line of its own at the left margin of the message
     either, where it would read as part of the form. */
  check("nor a line of its own in the message",
    !/^Bcc:/mi.test(injected), (injected.match(/^Bcc:.*/mi) || [])[0]);
}

console.log("\nWith both set up, Cloudflare is preferred:");
{
  const sent = [];
  const env = makeEnv();                      // RESEND_KEY set
  env.ENQUIRY_FROM_ADDRESS = "enquiries@haris-carpets.co.uk";
  env.SEND_EMAIL = { async send(m) { sent.push(m); } };
  const calls = resend();
  await eq.enquiryRoute(post(GOOD), env, ctx);
  check("Cloudflare sends it", sent.length === 1);
  check("and the third party is not used at all", calls.length === 0, `${calls.length} calls`);
}

/* The shop owns three domains and they are not interchangeable. The mail goes
   TO the mailbox domain and must be sent FROM the website one, because that is
   the only zone Cloudflare will have. Guessing the sender from the recipient
   would build an address on a domain Cloudflare has nothing to do with. */
console.log("\nThe sending address is never guessed from the recipient:");
{
  const sent = [];
  const env = makeEnv({ key: null });   // no ENQUIRY_FROM_ADDRESS on purpose
  env.SEND_EMAIL = { async send(m) { sent.push(m); } };
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("the visitor is still thanked", (await res.json()).ok === true);
  check("and the enquiry is still in the inbox",
    [...env.PHOTOS._store.keys()].some((k) => k.startsWith("admin/enquiries/")));
  check("but nothing is sent from a domain nobody configured", sent.length === 0,
    `${sent.length} sent as ${sent[0]?.from}`);
}

/* The first live enquiry sent nothing and logged "no EmailMessage in this
   runtime": the class comes from the cloudflare:email module, not the global
   scope, and this file had assumed the global. Node has no such module, so
   what is asserted here is the half that can be: with no global to fall back
   on, it reaches for the module, fails to find one, and *reports* rather than
   throwing into waitUntil where nobody would ever see it. */
console.log("\nWhen the mail runtime is not there, it says so:");
{
  const saved = globalThis.EmailMessage;
  delete globalThis.EmailMessage;
  const env = makeEnv({ key: null });
  env.ENQUIRY_FROM_ADDRESS = "enquiries@haris-carpets.co.uk";
  let asked = false;
  env.SEND_EMAIL = { async send() { asked = true; } };

  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("the visitor is thanked anyway", (await res.json()).ok === true);
  check("the enquiry is in the inbox, which is the delivery",
    [...env.PHOTOS._store.keys()].some((k) => k.startsWith("admin/enquiries/")));
  check("and nothing was half-sent", asked === false);
  if (saved) globalThis.EmailMessage = saved;
}

console.log("\nA failed notification is never the visitor's problem:");
{
  const env = makeEnv({ key: null });
  env.ENQUIRY_FROM_ADDRESS = "enquiries@haris-carpets.co.uk";
  env.SEND_EMAIL = { async send() { throw new Error("destination address not verified"); } };
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("they are still thanked", (await res.json()).ok === true);
  check("because the enquiry is already where the shop reads it",
    [...env.PHOTOS._store.keys()].some((k) => k.startsWith("admin/enquiries/")));
  delete globalThis.EmailMessage;
}

console.log("\nSpam is dropped without telling it why:");
{
  const env = makeEnv();
  const calls = resend();
  const res = await eq.enquiryRoute(post({ ...GOOD, website: "http://buy-followers.example" }), env, ctx);
  const body = await res.json();
  /* A 400 here would teach the script which field to leave alone next time. */
  check("it is answered as though it worked", res.status === 200 && body.ok === true);
  check("but nothing is sent", calls.length === 0, `${calls.length} calls`);
  check("and nothing is stored", env.PHOTOS._store.size === 0);
}

console.log("\nFilled in too fast to be a person:");
{
  const env = makeEnv();
  const calls = resend();
  const res = await eq.enquiryRoute(post({ ...GOOD, t: Date.now() - 500 }), env, ctx);
  check("refused", res.status === 400);
  check("nothing sent", calls.length === 0);

  const stale = await eq.enquiryRoute(post({ ...GOOD, t: Date.now() - 3 * DAY }), env, ctx);
  check("and a page left open for days is refused too", stale.status === 400);
  const missing = await eq.enquiryRoute(post({ ...GOOD, t: undefined }), env, ctx);
  check("as is one with no timestamp at all", missing.status === 400);
}

console.log("\nWhat has to be there, and what must not be:");
{
  const env = makeEnv();
  const calls = resend();
  const noName = await eq.enquiryRoute(post({ ...GOOD, name: "" }), env, ctx);
  check("a missing name is refused", noName.status === 400);
  check("and names the box to fix", (await noName.json()).field === "name");

  const noMail = await eq.enquiryRoute(post({ ...GOOD, email: "" }), env, ctx);
  check("so is a missing email", noMail.status === 400 && (await noMail.json()).field === "email");

  const junk = await eq.enquiryRoute(post({ ...GOOD, email: "not an address" }), env, ctx);
  check("and one that isn't an address", junk.status === 400);

  /* The address goes into a Reply-To header. A newline in it is somebody
     trying to write their own headers, so it is refused rather than tidied. */
  const inject = await eq.enquiryRoute(
    post({ ...GOOD, email: "a@b.com\r\nBcc: everyone@example.com" }), env, ctx);
  check("a newline in the email address is refused, not cleaned up", inject.status === 400);
  check("nothing was sent by any of those", calls.length === 0, `${calls.length} calls`);
}

console.log("\nOnly from our own pages, only by POST:");
{
  const env = makeEnv();
  const calls = resend();
  const other = await eq.enquiryRoute(post(GOOD, { origin: "https://evil.example" }), env, ctx);
  check("a cross-site post is refused", other.status === 403);
  const get = await eq.enquiryRoute(post(GOOD, { method: "GET" }), env, ctx);
  check("GET is not an enquiry", get.status === 405);
  const big = new Request(ORIGIN + "/api/enquiry", {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json",
               "content-length": String(600 * 1024) },
    body: JSON.stringify(GOOD),
  });
  check("an oversized body is refused before it is read",
    (await eq.enquiryRoute(big, env, ctx)).status === 413);
  check("none of them sent anything", calls.length === 0);
}

console.log("\nToo many, too fast:");
{
  const env = makeEnv({ limit: false });
  const calls = resend();
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  check("the visitor is asked to wait", res.status === 429);
  check("nothing sent", calls.length === 0);

  const budget = makeEnv({ budget: false });
  check("and there is a ceiling for everyone together",
    (await eq.enquiryRoute(post(GOOD), budget, ctx)).status === 429);
}

console.log("\nEnquiries do not pile up for ever:");
{
  const DAY = 86400 * 1000;
  const env = makeEnv({ objects: {
    "admin/enquiries/old.json": { body: JSON.stringify(GOOD), uploaded: new Date(Date.now() - 400 * DAY) },
    "admin/enquiries/recent.json": { body: JSON.stringify(GOOD), uploaded: new Date() },
  } });
  await eq.enquiryCron(env);
  /* Twelve months is a promise made on the privacy page. If this number moves,
     that page has to move with it or it stops being true. */
  check("one past twelve months is deleted", !env.PHOTOS._store.has("admin/enquiries/old.json"));
  check("a recent one is left alone", env.PHOTOS._store.has("admin/enquiries/recent.json"));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
