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
SRC = os.path.join(ROOT, "public", "assets")
OUT = os.path.join(ROOT, "public", "assets", "masks")

WORK_W = 1024  # masks are built (and shipped) at this width

# seed = where we're certain the carpet is, in fractions of the image.
# tol   = chromaticity radius; raise it if the mask comes out patchy.
# lum   = allowed luminance band (0-1), keeps dark furniture legs out.
ROOMS = {
    # Rug reads as one flat field against wood — the easy case. tol is generous
    # so the woven edge binding comes in too; leaving it out left a pale rim
    # around every recolour.
    "hero-living-room": dict(
        seeds=[(0.50, 0.82), (0.22, 0.72), (0.78, 0.70), (0.50, 0.66)],
        tol=0.042, lum=(0.20, 1.00), close=13),

    # Carpet and bed linen are the same colour to within 0.003 chromaticity and
    # they touch, so colour alone can't cut this. The polygon does the cutting;
    # chroma then trims the wood floor out of the bottom corners.
    "bedroom-wool": dict(
        seeds=[(0.45, 0.80), (0.15, 0.70), (0.75, 0.85)],
        tol=0.030, lum=(0.30, 1.00), close=13,
        poly=[(0.0, 1.0), (0.0, 0.47), (0.28, 0.40), (0.34, 0.46),
              (0.55, 0.49), (0.72, 0.535), (0.86, 0.57), (1.0, 0.61), (1.0, 1.0)]),

    # Stair carpet sits at luminance 0.28-0.41; the walls and spindles it touches
    # sit at 0.60-0.70. The luminance ceiling separates them outright, which
    # chromaticity alone could not — the two overlap in colour.
    # Three regions with different rules, because one rule cannot do it.
    # Sun-blown treads (luminance ~0.95) and the white spindles (~0.63) are both
    # far from the carpet in brightness AND close to it in colour, so nothing
    # global separates them. What does separate them is *where they are*: the
    # spindles only ever cross the upper flight. So the lower flight and landing
    # get a wide-open luminance range, and only the upper flight is capped.
    "stairs-wool-twist": dict(
        close=15,
        parts=[
            dict(  # landing floor, bottom left of frame
                seeds=[(0.10, 0.88), (0.22, 0.93)],
                tol=0.040, lum=(0.05, 1.00),
                poly=[(0.0, 1.0), (0.0, 0.70), (0.36, 0.87), (0.42, 1.0)]),
            dict(  # lower flight — no spindles in front of it
                seeds=[(0.60, 0.85), (0.55, 0.70), (0.55, 0.79), (0.62, 0.62)],
                tol=0.040, lum=(0.05, 1.00),
                # traces the stepped nosing line; with luminance left open the
                # polygon is the only thing holding the wall out, so it hugs
                poly=[(0.455, 1.00), (0.455, 0.60), (0.495, 0.375), (0.555, 0.335),
                      (0.600, 0.375), (0.655, 0.445), (0.715, 0.525),
                      (0.775, 0.605), (0.835, 0.700), (0.890, 0.800),
                      (0.905, 1.00)]),
            dict(  # upper flight — capped to stay off the spindles
                seeds=[(0.22, 0.08), (0.28, 0.14), (0.28, 0.20), (0.16, 0.08)],
                tol=0.038, lum=(0.05, 0.56), connect=False,
                poly=[(0.08, 0.0), (0.45, 0.0), (0.45, 0.34), (0.30, 0.45), (0.08, 0.34)]),
        ]),

    # A box ROI was not enough: the cabinet toe-kicks sit at the same height as
    # the floor behind the island, so a straight cut either clipped the floor or
    # painted the plinths. The polygon traces the actual floor/unit junction —
    # down around the island, back up to the run of units behind it.
    "lvt-kitchen": dict(
        seeds=[(0.50, 0.90), (0.30, 0.78), (0.70, 0.80), (0.09, 0.60), (0.15, 0.66)],
        tol=0.017, lum=(0.24, 0.88), close=5,
        poly=[(0.0, 1.0), (0.0, 0.470), (0.200, 0.435), (0.295, 0.450),
              (0.300, 0.570), (0.520, 0.570), (0.527, 0.492),
              (1.0, 0.512), (1.0, 1.0)]),

    # Real supplier roomsets: wall-to-wall carpet, which is what the visualiser
    # is actually selling. Strongly coloured walls make these the easy case —
    # chroma separates them outright, so only a loose ROI is needed to keep the
    # match below the skirting line.
    "room-living-carpet": dict(
        seeds=[(0.50, 0.92), (0.08, 0.80), (0.93, 0.86)],
        # 0.026 leaves the carpet seen through the glass coffee table unmasked,
        # which reads as a reflection. Widening it to take that in also recoloured
        # the tray and candlestick sitting on the glass, which reads as a bug.
        tol=0.026, lum=(0.30, 1.00), roi=(0.0, 0.505, 1.0, 1.0), close=11),

    "room-bedroom-carpet": dict(
        seeds=[(0.50, 0.93), (0.10, 0.85), (0.90, 0.88)],
        tol=0.026, lum=(0.28, 1.00), roi=(0.0, 0.60, 1.0, 1.0), close=11),

    # Floor, wall and cabinet doors are all the same pale oak — wall is within
    # 0.003 of the floor. Polygon only; chroma is left loose on purpose.
    "vinyl-utility": dict(
        seeds=[(0.30, 0.90), (0.45, 0.72), (0.08, 0.78)],
        tol=0.075, lum=(0.30, 1.00), close=3, connect=False,
        poly=[(0.0, 1.0), (0.0, 0.540), (0.200, 0.478), (0.325, 0.442),
              (0.348, 0.560), (0.500, 0.567), (0.615, 0.612), (0.720, 0.655),
              (0.855, 0.742), (1.0, 0.775), (1.0, 1.0)]),
}

# ---------------------------------------------------------------------------
# Three levers, in the order worth reaching for:
#
#   tol   chromaticity radius. Widen if the mask is patchy, tighten if it
#         bleeds into something the same colour.
#   lum   luminance band. The one that rescues stair carpet: it is far darker
#         than the walls it touches, even though the two overlap in colour.
#   poly  hand-drawn floor boundary, normalised (x, y) from the top-left. Reach
#         for this when the floor and its neighbour are genuinely the same
#         colour — bedroom carpet vs bed linen, utility floor vs its walls.
#         Chroma still runs inside the polygon, so it can stay approximate.
#
# Always open the _preview.jpg. A mask that bleeds is obvious there and
# invisible in the code.
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


def polygon(h, w, pts):
    """Rasterise a normalised polygon by even-odd ray casting, vectorised."""
    ys, xs = np.mgrid[0:h, 0:w]
    x, y = xs / w, ys / h
    inside = np.zeros((h, w), dtype=bool)
    n = len(pts)
    j = n - 1
    for i in range(n):
        xi, yi = pts[i]
        xj, yj = pts[j]
        straddles = (yi > y) != (yj > y)
        xcross = (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi
        inside ^= straddles & (x < xcross)
        j = i
    return inside


def build_region(arr, cfg):
    """One region of a room: threshold, confine, grow from seeds, fill."""
    rg, lum = chromaticity(arr)
    h, w = lum.shape

    samples = [rg[int(sy * h), int(sx * w)] for sx, sy in cfg["seeds"]]
    target = np.mean(samples, axis=0)

    dist = np.linalg.norm(rg - target, axis=2)
    # luminance may be given as one band or several. Stair carpet needs two:
    # normal pile sits below 0.56 and sun-blown treads above 0.85, while the
    # spindles and walls it touches sit in the 0.60-0.70 gap between them.
    bands = cfg.get("lum_bands") or [cfg["lum"]]
    inband = np.zeros_like(lum, dtype=bool)
    for lo, hi in bands:
        inband |= (lum >= lo) & (lum <= hi)
    candidate = (dist < cfg["tol"]) & inband

    if cfg.get("roi"):
        x0, y0, x1, y1 = cfg["roi"]
        box = np.zeros_like(candidate)
        box[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
        candidate &= box
    if cfg.get("poly"):
        candidate &= polygon(h, w, cfg["poly"])

    dead = [(sx, sy) for sx, sy in cfg["seeds"] if not candidate[int(sy * h), int(sx * w)]]
    if dead:
        print(f"     seeds that matched nothing (adjust or drop): {dead}")

    # Region growing normally keeps the match anchored to known floor. Where a
    # foreground object slices the floor into many disconnected slivers — stair
    # carpet seen between spindles — there is no single blob to grow, so the
    # confinement has to come from the polygon instead.
    if cfg.get("connect", True):
        candidate = grow(candidate, cfg["seeds"])
    return fill_holes(candidate)


def build(name, cfg):
    src = os.path.join(SRC, name + ".jpg")
    if not os.path.exists(src):
        print(f"  !! {name}: source missing, skipped")
        return None

    im = Image.open(src).convert("RGB")
    scale = WORK_W / im.width
    im = im.resize((WORK_W, round(im.height * scale)), Image.LANCZOS)
    arr = np.asarray(im)

    parts = cfg.get("parts") or [cfg]
    mask = np.zeros(arr.shape[:2], dtype=bool)
    for part in parts:
        mask |= build_region(arr, part)

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
