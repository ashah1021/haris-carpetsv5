#!/usr/bin/env python3
"""Work out which swatch tiles are colour chips and which are photographs.

Several suppliers sent no flat colour chips for some ranges — only roomset
photography. build-catalogue.py measured the hex off the floor in those shots
(which is why those shades are flagged indicative), but the photograph itself
was then published as the colour tile. The catalogue grid ended up showing a
thumbnail of somebody's bedroom where a square of carpet belonged.

Telling them apart is measurable. Blur past the pile and a carpet chip goes
flat — it is one colour, that is the entire point of it. A room does not: the
window, the sofa and the skirting survive any blur that leaves the image
recognisable. So blur hard and measure what is left.

One threshold will not do, because the same measurement means opposite things
by flooring type. A wood or LVT tile SHOULD have structure — the grain and the
plank joins are the product, and a herringbone close-up scores as high as a
lived-in room. Carpet is the opposite: any structure at all means something is
in the shot that should not be. Hence a threshold per type, and the reason the
two cannot share one:

    carpets        chips measure under 5; anything above 6 has a room, a
                   skateboard or a cup of tea in it
    wood and lvt   plank close-ups run 7-11, rooms start around 14

There is no clean gap in the raw numbers — 34 of 792 tiles sit between 6 and
18 — so these thresholds were set by looking at every tile in that band rather
than by finding a natural break. Re-check them by eye if the tiles are ever
rebuilt.

    python3 tools/classify-tiles.py            # report
    python3 tools/classify-tiles.py --write    # rewrite the block in data.js

Runs against the published tiles in public/assets/swatches, so it can be rerun
without the original supplier dump.
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

TILES = "public/assets/swatches"
DATA = "public/data.js"

THRESHOLD = {"carpets": 6.0, "wood": 13.0, "lvt": 13.0, "vinyl": 13.0, "rugs": 13.0}

BEGIN = "/* BEGIN GENERATED room-only list"
END = "/* END GENERATED room-only list */"


def range_types():
    src = open(DATA).read()
    return dict(re.findall(r'id: "([a-z0-9-]+)", type: "([a-z]+)"', src))


def structure(path):
    """How much large-scale variation survives blurring past the pile."""
    im = Image.open(path).convert("L").resize((96, 96))
    return float(np.asarray(im.filter(ImageFilter.GaussianBlur(4)), dtype=float).std())


def scan():
    types = range_types()
    rooms, chips = [], []
    for rng in sorted(os.listdir(TILES)):
        d = os.path.join(TILES, rng)
        if not os.path.isdir(d):
            continue
        limit = THRESHOLD.get(types.get(rng, "carpets"), 6.0)
        for f in sorted(os.listdir(d)):
            if not f.endswith(".jpg"):
                continue
            key = f"{rng}:{f[:-4]}"
            (rooms if structure(os.path.join(d, f)) > limit else chips).append(key)
    return rooms, chips


def write(rooms):
    src = open(DATA).read()
    i, j = src.index(BEGIN), src.index(END)
    body = "\n".join(f'  "{k}",' for k in rooms)
    block = (
        BEGIN + " — tools/classify-tiles.py */\n"
        "const ROOM_ONLY = new Set([\n" + body + "\n]);\n"
    )
    open(DATA, "w").write(src[:i] + block + src[j:])


if __name__ == "__main__":
    rooms, chips = scan()
    print(f"{len(chips)} colour chips, {len(rooms)} photographs")
    by_range = {}
    for k in rooms:
        by_range.setdefault(k.split(":")[0], []).append(k)
    for rng in sorted(by_range, key=lambda r: -len(by_range[r])):
        print(f"  {rng:44} {len(by_range[rng]):3d}")
    if "--write" in sys.argv:
        write(rooms)
        print(f"\nwrote the room-only list into {DATA}")
