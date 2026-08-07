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

## Optimising

The generated files are 2048px PNGs (~2–3 MB each). Before deploying:

```sh
# needs imagemagick
for f in assets/*.jpg; do convert "$f" -resize 2000x -quality 82 "$f"; done
```
