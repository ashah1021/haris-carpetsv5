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
 * worker.js is loaded through a data: URL because the repo has no package.json
 * declaring "type": "module", so Node would otherwise read the .js as CommonJS.
 */
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const worker = (await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
)).default;

const ETAG = '"abc123"';
let cacheStore = new Map();
globalThis.caches = { default: {
  async match(req){ return cacheStore.get(req.url); },
  async put(req,res){ cacheStore.set(req.url,res); },
}};
const ctx = { waitUntil(){} };

function makeEnv({ present = ['assets/hero-living-room.jpg'], throws = false } = {}) {
  return {
    PHOTOS: { async get(key){
      if (throws) throw new Error('bucket unreachable');
      if (!present.includes(key)) return null;
      return { body: 'JPEGBYTES', httpEtag: ETAG,
               writeHttpMetadata(h){ h.set('content-type','image/jpeg'); } };
    }},
    ASSETS: { async fetch(req){ return new Response('ASSETS:'+new URL(req.url).pathname,{status:200}); } },
  };
}
const req = (path, init) => new Request('https://x.test'+path, init);
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
await check('nested mask path stays a static asset', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/assets/masks/hero-living-room.png'), makeEnv(), ctx);
  eq(await r.text(),'ASSETS:/assets/masks/hero-living-room.png','mask');
});
await check('index passes through', async()=>{
  cacheStore.clear();
  const r = await worker.fetch(req('/'), makeEnv(), ctx);
  eq(await r.text(),'ASSETS:/','index');
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
await check('traversal cannot escape the photo prefix', async()=>{
  cacheStore.clear();
  for (const p of ['/assets/../data.js','/assets/..%2f..%2fdata.js','/assets/sub/dir.jpg']) {
    const r = await worker.fetch(req(p), makeEnv({present:['assets/../data.js']}), ctx);
    const t = await r.text();
    if (t === 'JPEGBYTES') throw new Error('served R2 object for '+p);
  }
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
