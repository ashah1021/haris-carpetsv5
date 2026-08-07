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

### Which rooms can be masked automatically

Matching works in chromaticity space, so it needs the floor to be a different
*colour* from whatever it touches — not merely a different brightness. Currently
automatic:

- `hero-living-room` — carpet against wood floor and a grey sofa. Clean.
- `lvt-kitchen` — pale floor against dark units. Clean apart from the island's
  own cast shadow.

These two **cannot** be done automatically, with the measured reason recorded at
the top of `tools/make-floor-mask.py`:

- `bedroom-wool` — the carpet and the bed linen are the same colour to within
  0.003 chromaticity, and they touch.
- `stairs-wool-twist` — the carpet runs from sunlight to deep shadow, and the
  wall colour falls inside that spread.

To add either, cut the mask by hand: open the photo, select the floor, fill white
on black, save a 1024px-wide greyscale PNG to `assets/masks/`. Then add the room
to `VIS_ROOMS` in `data.js`. The visualiser doesn't care how a mask was made.

Real supplier roomsets are usually easier to mask than these, because the
photography is lit to make the floor read clearly.

## Optimising

The generated files are 2048px PNGs (~2–3 MB each). Before deploying:

```sh
# needs imagemagick
for f in assets/*.jpg; do convert "$f" -resize 2000x -quality 82 "$f"; done
```
