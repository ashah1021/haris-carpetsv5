/**
 * Tests for worker.js — the R2-backed photo route.
 *
 *     node tools/worker.test.mjs
 *
 * No dependencies and no network: R2, the static-asset binding and the cache
 * are all stubbed. What matters here is that a bucket problem can never take
 * the site down, and that only bare .jpg files directly inside /assets/ are
 * ever pulled from R2.
 *
 * Loading is handled by load-worker.mjs — see the note there on why the Worker
 * cannot simply be imported by path.
 */
import { loadWorker } from "./load-worker.mjs";

const worker = (await loadWorker()).default;

const ETAG = '"abc123"';
let cacheStore = new Map();
globalThis.caches = { default: {
  async match(req){ return cacheStore.get(req.url); },
  async put(req,res){ cacheStore.set(req.url,res); },
}};
const ctx = { waitUntil(){} };

const INDEX = `<!DOCTYPE html><html><head>
<title>Hari's Carpets — Carpet &amp; Flooring Showroom, Hounslow</title>
<meta name="description" content="SHIPPED DESCRIPTION">
<meta property="og:title" content="OG TITLE">
<meta property="og:description" content="OG DESCRIPTION">
<meta property="og:url" content="https://haris-carpets.co.uk/">
<link rel="canonical" href="https://haris-carpets.co.uk/">
</head><body><main id="app"><!-- views render here --></main></body></html>`;

function makeEnv({ present = ['assets/hero-living-room.jpg'], throws = false } = {}) {
  return {
    PHOTOS: { async get(key){
      if (throws) throw new Error('bucket unreachable');
      if (!present.includes(key)) return null;
      return { body: 'JPEGBYTES', httpEtag: ETAG,
               writeHttpMetadata(h){ h.set('content-type','image/jpeg'); } };
    }},
    /* /index.html answers with a miniature of the real document, because the
       page route rewrites its head and the point of these tests is to see
       that it did. Everything else answers with its own path, as before. */
    ASSETS: { async fetch(req){
      const path = new URL(req.url).pathname;
      if (path === '/index.html') return new Response(INDEX, {status:200, headers:{'content-type':'text/html'}});
      return new Response('ASSETS:'+path,{status:200});
    } },
  };
}
const req = (path, init) => new Request('https://x.test'+path, init);
const pages = await import('../worker-pages.js');

let pass=0, fail=0;
async function check(name, fn){
  try { await fn(); console.log('  ok   '+name); pass++; }
  catch(e){ console.log('  FAIL '+name+' — '+e.message); fail++; }
}
const eq=(a,b,m)=>{ if(a!==b) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

console.log('Worker routing:');
await check('photo in R2 is served from R2', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/hero-living-room.jpg'), makeEnv(), ctx);
  eq(r.status,200,'status'); eq(await r.text(),'JPEGBYTES','body');
  eq(r.headers.get('content-type'),'image/jpeg','content-type');
  eq(r.headers.get('cache-control'),'public, max-age=31536000, immutable','cache-control');
  eq(r.headers.get('etag'),ETAG,'etag');
});
await check('photo missing from R2 falls back to bundled asset', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/showroom.jpg'), makeEnv(), ctx);
  eq(await r.text(),'ASSETS:/assets/showroom.jpg','fallback');
});
await check('R2 throwing does not break the site', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/hero-living-room.jpg'), makeEnv({throws:true}), ctx);
  eq(await r.text(),'ASSETS:/assets/hero-living-room.jpg','fallback on throw');
});
await check('nested swatch tile is served from R2', async()=>{
  cacheStore.clear();
  const env = makeEnv({present:['assets/swatches/westex-ultima/alabaster.jpg']});
  const r = await worker.fetch(req('/assets/swatches/westex-ultima/alabaster.jpg'), env, ctx);
  eq(await r.text(),'JPEGBYTES','served from R2');
});
await check('nested mask path stays a static asset', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/masks/hero-living-room.png'), makeEnv(), ctx);
  eq(await r.text(),'ASSETS:/assets/masks/hero-living-room.png','mask');
});
await check('the home page is served with its own title', async()=>{
  const r = await worker.fetch(req('/'), makeEnv(), ctx);
  eq(r.status, 200, 'status');
  const html = await r.text();
  if (!html.includes("<title>Hari's Carpets — Carpet &amp; Flooring Showroom, Hounslow</title>")) throw new Error('title');
  if (!html.includes('<h1>')) throw new Error('no server-rendered heading');
});
await check('an old Wix path is a permanent redirect to the nearest page', async()=>{
  for (const [from, to] of [['/about-us-1','/about'], ['/contact-us-1','/contact'],
                            ['/carpets','/collections/carpets'], ['/lvt-1','/collections/lvt'],
                            ['/copy-of-carina-herringbone','/collections/lvt'],
                            ['/velvet','/collections/carpets/velvet']]) {
    const r = await worker.fetch(req(from), makeEnv(), ctx);
    eq(r.status, 301, from+' status');
    eq(new URL(r.headers.get('location')).pathname, to, from+' destination');
  }
});
await check('the redirect survives a trailing slash and capitals', async()=>{
  const r = await worker.fetch(req('/About-Us-1/'), makeEnv(), ctx);
  eq(r.status, 301, 'status');
  eq(new URL(r.headers.get('location')).pathname, '/about', 'destination');
});
await check('a redirect goes straight to its destination, never via another', async()=>{
  for (const [from] of Object.entries(pages.REDIRECTS)) {
    const to = pages.redirectFor(from);
    if (pages.redirectFor(to.split('#')[0])) throw new Error(from+' redirects to a redirect');
  }
});
await check('www goes to the bare domain, once', async()=>{
  const r = await worker.fetch(new Request('https://www.haris-carpets.co.uk/about'), makeEnv(), ctx);
  eq(r.status, 301, 'status');
  eq(r.headers.get('location'), 'https://haris-carpets.co.uk/about', 'destination');
});
await check('a real path is a real page, with its own canonical', async()=>{
  const r = await worker.fetch(req('/about'), makeEnv(), ctx);
  eq(r.status, 200, 'status');
  const html = await r.text();
  if (!html.includes("<title>About us — Hari's Carpets</title>")) throw new Error('title');
  if (!html.includes('href="https://haris-carpets.co.uk/about"')) throw new Error('canonical');
  if (!html.includes('property="og:url" content="https://haris-carpets.co.uk/about"')) throw new Error('og:url');
  if (html.includes('SHIPPED DESCRIPTION')) throw new Error('description not replaced');
});
await check('a collection page names its floor type', async()=>{
  const r = await worker.fetch(req('/collections/lvt'), makeEnv(), ctx);
  const html = await r.text();
  if (!html.includes("<title>LVT — Hari's Carpets, Hounslow</title>")) throw new Error('title');
  if (!html.includes('<h1>LVT</h1>')) throw new Error('heading');
});
await check('favourites is a page but not one to index', async()=>{
  const r = await worker.fetch(req('/favourites'), makeEnv(), ctx);
  eq(r.status, 200, 'status');
  if (!(await r.text()).includes('name="robots" content="noindex')) throw new Error('indexable');
});
await check('a path the site has never had still 404s', async()=>{
  const r = await worker.fetch(req('/no-such-page'), makeEnv(), ctx);
  eq(await r.text(), 'ASSETS:/no-such-page', 'passed to assets to answer');
});
await check("Wix's own plumbing is gone, not redirected", async()=>{
  const r = await worker.fetch(req('/_partials/masterPage'), makeEnv(), ctx);
  eq(r.status, 410, 'status');
});
await check('the admin is not treated as a page of the site', async()=>{
  const r = await worker.fetch(req('/admin/'), makeEnv(), ctx);
  eq(await r.text(), 'ASSETS:/admin/', 'passed through');
});
await check('non-jpg in /assets passes through', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/fetch-images.sh'), makeEnv(), ctx);
  eq(await r.text(),'ASSETS:/assets/fetch-images.sh','sh');
});
await check('If-None-Match returns 304 with no body', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/hero-living-room.jpg',{headers:{'if-none-match':ETAG}}), makeEnv(), ctx);
  eq(r.status,304,'status'); eq(await r.text(),'','body');
});
await check('HEAD returns headers without body', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/hero-living-room.jpg',{method:'HEAD'}), makeEnv(), ctx);
  eq(r.status,200,'status'); eq(await r.text(),'','body');
  eq(r.headers.get('content-type'),'image/jpeg','content-type');
});
await check('POST is not intercepted', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/hero-living-room.jpg',{method:'POST'}), makeEnv(), ctx);
  eq(await r.text(),'ASSETS:/assets/hero-living-room.jpg','post');
});

/* adminRoutes answers 404 for anything under /api/ it does not recognise, so a
   new endpoint dispatched after it looks exactly like an endpoint that was
   never built. Both of these have to be reached first. */
await check('an enquiry reaches the enquiry route, not the admin 404', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/api/enquiry',{ method:'POST',
    headers:{ origin:'https://x.test', 'content-type':'application/json' },
    body: JSON.stringify({ t: Date.now() - 20000 }) }), makeEnv(), ctx);
  const body = await r.json();
  /* An empty body is refused for a missing name, and only worker-enquiry.js
     knows the form has a name box — adminRoutes would have said "not found". */
  eq(r.status, 400, 'status');
  eq(body.field, 'name', 'names the box to fill in');
});
await check('and the Instagram feed still reaches its own route', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/api/instagram'), makeEnv(), ctx);
  eq(r.status, 200, 'status');
  eq(Array.isArray((await r.json()).posts), true, 'posts');
});
await check('traversal cannot escape the photo prefix', async()=>{
  cacheStore.clear();
  for (const p of ['/assets/../data.js','/assets/..%2f..%2fdata.js','/assets/a/b/c/d.jpg']) {
    const r = await worker.fetch(req(p), makeEnv({present:['assets/../data.js']}), ctx);
    const t = await r.text();
    if (t === 'JPEGBYTES') throw new Error('served R2 object for '+p);
  }
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
