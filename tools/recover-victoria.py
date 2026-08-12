#!/usr/bin/env python3
"""Recover the Victoria Carpets wood and LVT shades the catalogue builder lost.

build-catalogue.py parses a colour name out of each supplier filename. Victoria
name their files by range first and colour last — universal-plank-cashew.jpg —
and the parser kept the range, so an entire wood and LVT catalogue collapsed
into a handful of shades called things like "Universal Design". Fifty real,
correctly named colours were sitting on disk unreferenced, which is why the LVT
section offered one shade.

This reads the tiles that were already published, recovers the colour from the
tail of each filename, and rewrites the seven Victoria ranges in data.js.

Two files can describe the same colour — a flat plank close-up and a roomset —
so each colour keeps both: the flattest for its swatch and its measured hex,
the most structured as its room photograph. Flatness is the same blur-and-
measure test tools/classify-tiles.py uses.

Victoria's hexes stay flagged indicative. Some of these shades only exist as a
floor in a lit, angled photograph, and no amount of care makes that the same
thing as a colour chip.

    python3 tools/recover-victoria.py           # report
    python3 tools/recover-victoria.py --write   # rewrite data.js
"""
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

TILES = "public/assets/swatches"
DATA = "public/data.js"

# Range prefixes to strip off the front of a filename, longest first so
# "universal-design-plank-" wins over "universal-".
PREFIXES = [
    "engineered-wood-14-3-herringbone-", "engineered-wood-14-3-plank-",
    "engineered-wood-18-4-", "14-3-herringbone-",
    "universal-design-fishbone-", "universal-design-parquet-",
    "universal-design-plank-", "universal-herringbone-", "universal-plank-",
    "universal-tile-", "universal-design-", "universal-",
]

# Finish descriptions that trail the colour: "chic-brushed-smoked-uv-lacquered-
# plank" is the colour Chic in a brushed, smoked, UV-lacquered finish.
SUFFIXES = [
    "-brushed-smoked-uv-lacquered-herringbone", "-brushed-smoked-uv-lacquered-plank",
    "-handscaped-lacquered-plank", "-handscaped", "-calico-render",
    "-plank", "-herringbone", "-render",
]

# Filenames left with nothing but the range once stripped — no colour in them.
JUNK = {"", "14-3", "18-4", "oh", "universal", "universal-design", "design"}

# Filenames Victoria truncated. "chi" is Chic with the c lost.
ALIAS = {"chi": "chic"}

TITLE_FIX = {"Uv": "UV"}


def colour_of(stem):
    name = stem
    for p in PREFIXES:
        if name.startswith(p):
            name = name[len(p):]
            break
    for s in SUFFIXES:
        if name.endswith(s):
            name = name[: -len(s)]
            break
    name = ALIAS.get(name, name)
    if name in JUNK:
        return None
    # "brushed-and-oiled-oak" and "brushed-oiled-oak" are one colour spelt two
    # ways across two files; drop the conjunction so they group together.
    words = [w for w in name.split("-") if w != "and"]
    return " ".join(TITLE_FIX.get(w.title(), w.title()) for w in words)


def flatness(path):
    im = Image.open(path).convert("L").resize((96, 96))
    return float(np.asarray(im.filter(ImageFilter.GaussianBlur(4)), dtype=float).std())


def hex_of(path, flat):
    """Median of the central half for a flat tile, of the lower third for a room."""
    im = Image.open(path)
    im.draft("RGB", (400, 400))
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    crop = (a[h // 4: 3 * h // 4, w // 4: 3 * w // 4] if flat else a[int(h * 0.66):, :])
    r, g, b = np.median(crop.reshape(-1, 3), axis=0).astype(int)
    return f"#{r:02x}{g:02x}{b:02x}"


def scan():
    out = {}
    for rng in sorted(os.listdir(TILES)):
        if not rng.startswith("victoria-"):
            continue
        d = os.path.join(TILES, rng)
        by_colour = {}
        for f in sorted(os.listdir(d)):
            if not f.endswith(".jpg"):
                continue
            name = colour_of(f[:-4])
            if not name:
                continue
            by_colour.setdefault(name, []).append((flatness(os.path.join(d, f)), f[:-4]))
        cols = []
        for name in sorted(by_colour):
            shots = sorted(by_colour[name])            # flattest first
            flat, stem = shots[0]
            room = shots[-1][1] if shots[-1][0] > 13 and shots[-1][1] != stem else None
            cols.append({
                "name": name,
                "hex": hex_of(os.path.join(d, stem + ".jpg"), flat <= 13),
                "file": stem,
                "room": room,
            })
        if cols:
            out[rng] = cols
    return out


def js(rng, cols):
    """The colours: [...] body for one range."""
    lines = []
    for i, col in enumerate(cols, 1):
        code = re.sub(r"[^A-Z]", "", col["name"].upper())[:3].ljust(3, "X") + f"{i:02d}"
        args = [f'"{col["name"]}"', f'"{code}"', f'"{col["hex"]}"', f'"{col["file"]}"']
        if col["room"]:
            args.append(f'"{col["room"]}"')
        lines.append("      v(" + ", ".join(args) + "),")
    return "\n".join(lines)


def write(found):
    src = open(DATA).read()
    for rng, cols in found.items():
        pat = re.compile(
            r'(\{\s*\n    id: "' + re.escape(rng) + r'".*?colours: \[\n).*?(\n    \],)',
            re.S)
        # the duplicate Universal Plank block is replaced by the same body; the
        # dedupe pass afterwards drops whichever copy is left over
        src, n = pat.subn(lambda m: m.group(1) + js(rng, cols) + m.group(2), src)
        if not n:
            print(f"  !! could not find {rng} in {DATA}")
    open(DATA, "w").write(src)


if __name__ == "__main__":
    found = scan()
    total = sum(len(v) for v in found.values())
    print(f"recovered {total} shades across {len(found)} Victoria ranges\n")
    for rng, cols in found.items():
        rooms = sum(1 for c in cols if c["room"])
        print(f"  {rng:50} {len(cols):3d} shades, {rooms} with a roomset")
        print(f"      {', '.join(c['name'] for c in cols)}")
    if "--write" in sys.argv:
        write(found)
        print(f"\nrewrote the Victoria ranges in {DATA}")
