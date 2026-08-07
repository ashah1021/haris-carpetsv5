#!/usr/bin/env python3
"""
Build a floor mask for the carpet visualiser.

For each roomset we need a greyscale PNG where white = "this is carpet".
The visualiser recolours only those pixels, keeping the photograph's own
shading so the result still looks lit.

Matching is done in *chromaticity* space — r/(r+g+b), g/(r+g+b) — rather than
raw RGB. Chromaticity is close to illumination-invariant, so one threshold
holds across a carpet that's bright by the window and in shadow under a sofa.
A raw-RGB threshold splits that same carpet into two regions.

Usage:
    python3 tools/make-floor-mask.py                 # rebuild all rooms
    python3 tools/make-floor-mask.py hero-living-room

Writes assets/masks/<name>.png, plus a _preview.jpg per room so you can eyeball
the cut before wiring it up.
"""
import sys
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "assets", "masks")

WORK_W = 1024  # masks are built (and shipped) at this width

# seed = where we're certain the carpet is, in fractions of the image.
# tol   = chromaticity radius; raise it if the mask comes out patchy.
# lum   = allowed luminance band (0-1), keeps dark furniture legs out.
ROOMS = {
    "hero-living-room":   dict(seeds=[(0.50, 0.82), (0.22, 0.72), (0.78, 0.70)], tol=0.030, lum=(0.28, 1.00)),
    "lvt-kitchen":        dict(seeds=[(0.50, 0.90), (0.30, 0.78), (0.70, 0.80), (0.09, 0.53), (0.15, 0.62)], tol=0.017, lum=(0.24, 0.88), roi=(0.0, 0.42, 1.0, 1.0), close=17),
}

# ---------------------------------------------------------------------------
# Rooms this script CANNOT mask, and why. Measured chromaticity, not a guess:
#
#   bedroom-wool       carpet rg=(0.350,0.339) lum 0.69-0.75
#                      bed linen rg=(0.348,0.340) lum 0.75
#     The carpet and the duvet are the same colour to within 0.003, with
#     overlapping luminance, and they touch. No threshold separates them.
#
#   stairs-wool-twist  carpet rg spans (0.332,0.335)-(0.349,0.349), lum 0.39-0.98
#                      wall    rg=(0.357,0.340) lum 0.70
#     The wall sits inside the carpet's own spread, because the carpet runs
#     from full sunlight to deep shadow across one frame.
#
# Both need a hand-cut mask: open the photo, select the carpet, fill white on
# black, save 1024px-wide greyscale PNG to assets/masks/<name>.png. The
# visualiser picks up any mask in that folder — it does not care how it was
# made. Then add the room to ROOMS_IN_APP in data.js.
# ---------------------------------------------------------------------------


def chromaticity(arr):
    """RGB -> (r,g) chromaticity + luminance, all float 0-1."""
    a = arr.astype(np.float32) / 255.0
    s = a.sum(axis=2) + 1e-6
    rg = np.stack([a[:, :, 0] / s, a[:, :, 1] / s], axis=2)
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]
    return rg, lum


def grow(candidate, seeds):
    """Keep only the blob(s) connected to a seed — 4-way flood on a bool array."""
    h, w = candidate.shape
    out = np.zeros_like(candidate)
    q = deque()
    for sx, sy in seeds:
        x, y = int(sx * w), int(sy * h)
        if 0 <= x < w and 0 <= y < h and candidate[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and candidate[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((nx, ny))
    return out


def fill_holes(mask):
    """Close pockets the threshold missed — a shadow in the middle of a carpet
    is still carpet. Anything unreachable from the border is interior."""
    h, w = mask.shape
    free = ~mask
    seen = np.zeros_like(mask)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if free[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and free[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((nx, ny))
    return mask | (free & ~seen)


def build(name, cfg):
    src = os.path.join(SRC, name + ".jpg")
    if not os.path.exists(src):
        print(f"  !! {name}: source missing, skipped")
        return None

    im = Image.open(src).convert("RGB")
    scale = WORK_W / im.width
    im = im.resize((WORK_W, round(im.height * scale)), Image.LANCZOS)
    arr = np.asarray(im)

    rg, lum = chromaticity(arr)
    h, w = lum.shape

    # average the seeds so one unlucky pixel can't skew the target colour
    samples = [rg[int(sy * h), int(sx * w)] for sx, sy in cfg["seeds"]]
    target = np.mean(samples, axis=0)

    dist = np.linalg.norm(rg - target, axis=2)
    lo, hi = cfg["lum"]
    candidate = (dist < cfg["tol"]) & (lum >= lo) & (lum <= hi)
    # optional region of interest — keeps a match from climbing the walls
    if cfg.get("roi"):
        x0, y0, x1, y1 = cfg["roi"]
        box = np.zeros_like(candidate)
        box[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
        candidate &= box
    mask = grow(candidate, cfg["seeds"])
    mask = fill_holes(mask)

    img = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    # close pile speckle, reopen, then feather so edges don't alias
    k = cfg.get("close", 9)
    img = img.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    img = img.filter(ImageFilter.GaussianBlur(1.6))

    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, name + ".png"), optimize=True)

    # preview: flood the matched area magenta so mistakes are obvious
    m = np.asarray(img).astype(np.float32)[:, :, None] / 255.0
    tint = np.array([255, 0, 170], dtype=np.float32)
    prev = (arr * (1 - m * 0.65) + tint * (m * 0.65)).astype(np.uint8)
    Image.fromarray(prev).save(os.path.join(OUT, name + "_preview.jpg"), quality=82)

    pct = 100.0 * mask.sum() / mask.size
    print(f"  {name}: {pct:.1f}% of frame matched")
    return pct


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(ROOMS)
    print("Building floor masks...")
    for n in wanted:
        if n not in ROOMS:
            print(f"  !! {n}: not configured in ROOMS")
            continue
        build(n, ROOMS[n])
    print("Done. Check assets/masks/*_preview.jpg before shipping.")
