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
  const env = makeEnv();
  const calls = resend();
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  const body = await res.json();
  check("the visitor is told it sent", res.status === 200 && body.ok === true && !body.queued);
  check("exactly one email is sent", calls.length === 1, `${calls.length} calls`);
  check("to the shop", calls[0]?.body.to[0] === "sales@hariscarpets.co.uk");
  check("from an address we are allowed to send from",
    calls[0]?.body.from.includes("resend.dev"), calls[0]?.body.from);
  check("replying goes back to the customer", calls[0]?.body.reply_to === "jo@example.com");
  check("the subject says who and what",
    /Carpets/.test(calls[0]?.body.subject) && /Jo Bloggs/.test(calls[0]?.body.subject),
    calls[0]?.body.subject);
  check("their message is in it", calls[0]?.body.text.includes("Stairs and landing"));
  check("and their phone number", calls[0]?.body.text.includes("07700 900123"));
  check("the key is sent as a bearer token",
    calls[0]?.init.headers.authorization === "Bearer re_test_key");
  check("and never comes back in the reply",
    !JSON.stringify(body).includes("re_test_key"));
  check("nothing is left in the pending queue",
    [...env.PHOTOS._store.keys()].filter((k) => k.includes("pending")).length === 0);
  check("a copy is kept in case the shop loses the email",
    [...env.PHOTOS._store.keys()].some((k) => k.includes("sent/")));
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

console.log("\nWhen the email provider is down, nothing is lost:");
{
  const env = makeEnv();
  resend({ status: 500 });
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  const body = await res.json();
  check("the visitor is told we have it", res.status === 200 && body.ok === true);
  check("and told plainly that it is queued", body.queued === true);
  const pending = [...env.PHOTOS._store.keys()].filter((k) => k.includes("pending/"));
  check("the enquiry is in the bucket", pending.length === 1, pending[0]);

  /* and the cron gets it out again */
  const calls = resend({ status: 200 });
  await eq.enquiryCron(env);
  check("the retry sends it", calls.length === 1);
  check("their message survived the round trip",
    calls[0]?.body.text.includes("Stairs and landing"));
  check("and it leaves the queue",
    [...env.PHOTOS._store.keys()].filter((k) => k.includes("pending/")).length === 0);
}

console.log("\nWhen it can be neither sent nor stored:");
{
  const env = makeEnv({ breakPut: true });
  resend({ throws: true });
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  const body = await res.json();
  /* The one case where the visitor must not be thanked. */
  check("the visitor is not thanked", res.status === 502 && body.ok === false);
  check("and is offered another way through", body.fallback === true);
}

console.log("\nBefore the key is set:");
{
  const env = makeEnv({ key: null });
  const calls = resend();
  const res = await eq.enquiryRoute(post(GOOD), env, ctx);
  const body = await res.json();
  check("it refuses rather than pretending", res.status === 503 && body.ok === false);
  check("and says the form is not switched on", /switched on/i.test(body.error), body.error);
  check("the visitor is offered another way through", body.fallback === true);
  check("nothing was sent anywhere", calls.length === 0);
  /* Deliberately not banked. A message filed in a bucket nobody has been told
     to look in is a customer who thinks they have been in touch and has not. */
  check("and nothing is quietly stored for nobody to read", env.PHOTOS._store.size === 0);
}

console.log("\nOld copies do not pile up:");
{
  const old = new Date(Date.now() - 40 * DAY);
  const recent = new Date();
  const env = makeEnv({ objects: {
    "admin/enquiries/sent/old.json": { body: JSON.stringify(GOOD), uploaded: old },
    "admin/enquiries/sent/new.json": { body: JSON.stringify(GOOD), uploaded: recent },
  } });
  resend();
  await eq.enquiryCron(env);
  check("a sent copy past its keep-by is deleted",
    !env.PHOTOS._store.has("admin/enquiries/sent/old.json"));
  check("a recent one is left alone",
    env.PHOTOS._store.has("admin/enquiries/sent/new.json"));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
