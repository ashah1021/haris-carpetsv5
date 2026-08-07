# /assets — site photography

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

## Current status: AI-generated stand-ins

The images fetched by `fetch-images.sh` are **AI-generated placeholders**, not real
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
sh assets/fetch-images.sh
```

Run it from the repo root. It needs plain outbound HTTPS to the generation CDN —
it will not work from inside a restricted-egress sandbox, so run it locally.

## Floor masks (the visualiser)

`assets/masks/<room>.png` is a greyscale image where white marks the floor. The
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
greyscale PNG as `assets/masks/stairs-wool-twist.png`, then add the room to
`VIS_ROOMS` in `data.js`. Five minutes, and the visualiser doesn't care how a
mask was made.

### Bathroom

There's no bathroom photograph in `/assets` yet. Add one, mask it, add it to
`VIS_ROOMS`, and list `"bathroom"` in the relevant entries of `VIS_TYPES`. The
utility room is standing in for it in the meantime — the same floors suit both.

Real supplier roomsets are usually *easier* to mask than these, because they're
lit to make the floor read clearly.

## Optimising

The generated files are 2048px PNGs (~2–3 MB each). Before deploying:

```sh
# needs imagemagick
for f in assets/*.jpg; do convert "$f" -resize 2000x -quality 82 "$f"; done
```
