# Photography and the catalogue pipeline

> The site's public files live in `public/`. Paths below are relative to the
> repo root, so image files sit at `public/assets/…` and are served at
> `/assets/…`.

Every image path on the site is declared once, in the `IMG` object at the top of
`data.js`. Drop a file at the matching path here and it appears everywhere it's
used — no code changes needed anywhere else.

If a file is missing the page does **not** break: `photo()` in `app.js` removes the
broken `<img>` and a woven fallback texture shows in its place, captioned with the
alt text. So the site is always presentable, even part-way through a photo shoot.

## The twelve slots

| File | Used for | Best ratio |
|---|---|---|
| `hero-living-room.jpg` | Full-bleed home page hero | 16:9 (wide, ≥2000px) |
| `showroom.jpg` | Showroom split section, About, Contact | 3:2 |
| `fitting-hands.jpg` | "Supplied and fitted, properly" band | 3:2 |
| `samples-counter.jpg` | Small inset over the showroom photo | 1:1 |
| `stairs-wool-twist.jpg` | Gallery strip, About teaser, Pure Luxury | 3:4 / 3:2 |
| `bedroom-wool.jpg` | Gallery strip, Barrington range | 4:3 |
| `velvet-living-room.jpg` | Carpets category tile, Elysian Velvet | 4:3 |
| `pile-detail.jpg` | Gallery strip, Ultima Twist | 4:3 |
| `wood-herringbone-kitchen.jpg` | Wood & Laminate category | 4:3 |
| `lvt-kitchen.jpg` | LVT category | 4:3 |
| `vinyl-utility.jpg` | Vinyl category | 4:3 |
| `rug-living-room.jpg` | Rugs category | 4:3 |

## Current status: stand-ins, not the shop's own photographs

The images fetched by `fetch-images.sh` are **placeholders**, not real
photographs of the shop. They are there so the layout can be judged with real
imagery in it. Before this goes anywhere near a customer, replace them with:

1. **Real showroom photos** — `showroom.jpg`, `samples-counter.jpg`, and ideally the
   hero. A phone camera on a bright day is genuinely fine, and will beat any
   generated image for trust.
2. **Real fitted jobs** — the four `strip` photos are captioned "Recently fitted".
   That claim needs to be true, so use actual completed jobs.
3. **Supplier roomset packs** — Westex, Cormar, Furlong, Hugh Mackay and Victoria
   all supplied roomset imagery (Google Drive / Dropbox / WeTransfer, per the notes
   in `data.js`). Those are the correct source for the per-range shots, and they're
   licensed for retailer use.

## Fetching the placeholders

```sh
sh public/assets/fetch-images.sh
```

Run it from the repo root. It needs plain outbound HTTPS to the generation CDN —
it will not work from inside a restricted-egress sandbox, so run it locally.

## Floor masks (the visualiser)

`public/assets/masks/<room>.png` is a greyscale image where white marks the floor. The
visualiser recolours only those pixels, scaling the chosen colour by each pixel's
own luminance — so shadows stay shadows and the pile texture survives. Without a
mask a room simply doesn't appear in the picker.

Rebuild them with:

```sh
pip install Pillow numpy
python3 tools/make-floor-mask.py            # all configured rooms
python3 tools/make-floor-mask.py lvt-kitchen
```

It writes a `_preview.jpg` alongside each mask with the matched area flooded
magenta. **Always look at the preview before shipping** — a mask that bleeds is
obvious there and invisible in the code.

### The three levers

Reach for them in this order — each one exists because the one before it wasn't
enough for some room:

- **`tol`** — chromaticity radius. Widen if the mask is patchy, tighten if it
  bleeds into a neighbour of the same colour.
- **`lum`** / **`lum_bands`** — luminance band(s). Several bands exist because
  stair carpet occupies *two*: normal pile below 0.56 and sun-blown treads above
  0.86, with the white spindles sitting in the gap between them.
- **`poly`** — a hand-traced floor boundary in normalised coordinates. The last
  resort, for when the floor and its neighbour are genuinely the same colour.
- **`parts`** — several regions in one room, each with its own settings, unioned.
  Use when one rule can't cover the whole floor.
- **`connect: false`** — skip region growing. For floor sliced into disconnected
  slivers (carpet seen between stair spindles) there is no single blob to grow
  from, so the polygon has to do the confining.

### Room status

| Room | Mask | Notes |
|---|---|---|
| `hero-living-room` | automatic | Clean. `tol` is deliberately wide so the rug's woven edge binding is included — leaving it out left a pale rim around every recolour. |
| `bedroom-wool` | polygon | Carpet and bed linen match to within 0.003 chromaticity and touch, so colour can't cut it. The polygon cuts; chroma then trims the wood floor from the corners. |
| `lvt-kitchen` | automatic | Clean apart from the island's own cast shadow. |
| `vinyl-utility` | polygon only | Floor, walls and cabinet doors are all the same pale oak — the wall is within 0.003 of the floor. `tol` is left wide open on purpose; the polygon alone defines the floor. |
| `stairs-wool-twist` | **needs hand-cutting** | See below. |

### Stairs: why it needs cutting by hand

This is the one the script can't do, and it's worth knowing why before trying
again. Three things stack up:

1. The carpet and the wall it touches are nearly the same colour (0.019 apart).
2. The carpet runs from full sun to deep shadow, so its own colour spread is
   *wider* than its distance from the wall.
3. Sun-blown treads land at luminance ~0.95 while the white spindles crossing
   the flight sit at ~0.63 — so brightness can't separate carpet from spindle
   either; the blown carpet is *brighter* than the thing to exclude.

A polygon tight enough to exclude the wall also clips the treads. Cut it by
hand: open the photo, select the carpet, fill white on black, save a 1024px-wide
greyscale PNG as `public/assets/masks/stairs-wool-twist.png`, then add the room to
`VIS_ROOMS` in `data.js`. Five minutes, and the visualiser doesn't care how a
mask was made.

### Bathroom

There's no bathroom photograph in `/assets` yet. Add one, mask it, add it to
`VIS_ROOMS`, and list `"bathroom"` in the relevant entries of `VIS_TYPES`. The
utility room is standing in for it in the meantime — the same floors suit both.

Real supplier roomsets are usually *easier* to mask than these, because they're
lit to make the floor read clearly.

## Serving from R2

The photos live in the Cloudflare R2 bucket `haris-carpets` under
`assets/<name>.jpg`, with `Cache-Control: public, max-age=31536000, immutable`.

`worker.js` serves them from the site's **own origin**, at the same
`/assets/<name>.jpg` URLs the repo uses. Nothing in the site needs to know where
a photo came from. This is deliberate rather than incidental:

- **No CORS to maintain.** The visualiser reads raw canvas pixels, and browsers
  taint the canvas for cross-origin images unless CORS is exactly right. Serving
  same-origin removes that failure mode entirely.
- **No dependency on `r2.dev`.** Cloudflare rate-limits the public bucket URL and
  says plainly it is not for production traffic.

`wrangler.jsonc` sets `assets.run_worker_first: true`, without which static
assets are served before the Worker ever runs and the bundled photos would
always win over R2.

**The bundled copies in this folder are the fallback, not dead weight.** If R2 is
unreachable or an object is missing, `worker.js` hands the request to the static
assets instead — so a bucket problem degrades to slightly larger images rather
than a site with no photographs on it. That is what `tools/worker.test.mjs`
exists to protect:

```sh
node tools/worker.test.mjs      # no deps, no network
```

If you would rather bypass the Worker and serve straight from the bucket's public
URL, set `IMG_BASE` in `data.js` to `https://pub-<hash>.r2.dev/`. The bucket
already carries a CORS policy allowing `GET`/`HEAD` from any origin for that case.

### Re-uploading after replacing photos

```sh
pip install boto3 Pillow
export R2_ACCOUNT=<cloudflare account id>
export AWS_ACCESS_KEY_ID=<r2 access key id>
export AWS_SECRET_ACCESS_KEY=<r2 secret access key>
python3 tools/sync-r2.py
```

Because the cache headers are immutable, **change the filename when you replace
a photo** rather than overwriting it — otherwise browsers and Cloudflare will
keep serving the old one for up to a year.

## Optimising

`tools/sync-r2.py` resizes to 2000px (hero) / 1600px (everything else) and
converts to progressive JPEG at quality 82. That took the set from 59.7 MB to
3.5 MB — 6% of the original — with no visible loss at the sizes the site
displays. The committed copies have already been through it.

To re-run on the local copies without uploading:

```sh
python3 tools/sync-r2.py --local
```
