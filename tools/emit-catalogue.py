#!/usr/bin/env python3
"""
Turn catalogue.json into the CATALOGUE block of data.js, and upload one
optimised roomset photo per range.

Run tools/build-catalogue.py first. This step makes two judgement calls worth
knowing about:

  * A colour with no name is dropped. The hex is fine, but an unnamed swatch is
    no use to a customer and a guessed name on a carpet catalogue is worse than
    a missing one. Ranges left with nothing are reported, not silently binned.

  * Range photography comes from the supplier roomsets where they exist. Westex
    sent swatches only, so those ranges fall back to the stand-in photography
    already on the site until real roomsets arrive.

    export R2_ACCOUNT=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
    python3 tools/emit-catalogue.py
"""
import io
import json
import os
import re
import sys
from collections import defaultdict, OrderedDict
from concurrent.futures import ThreadPoolExecutor

import boto3
from botocore.config import Config
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUCKET = "haris-carpets"
PHOTO_W = 1600

# Westex sent no roomsets; these keep the existing stand-in photography.
WESTEX_FALLBACK = ["IMG.velvet", "IMG.hero", "IMG.bedroom", "IMG.stairs", "IMG.pile"]


# Supplier folder names carry typos and internal shorthand. Fixed here rather
# than renaming their folders, so a re-download still works.
RANGE_FIXUP = {
    "Ulitmate Impressions": "Ultimate Impressions",
    "Freedom and Freedom Xtra": "Freedom & Freedom Xtra",
    "14-3 Herringbone": "Engineered Wood 14-3 Herringbone",
    "14-3 Plank": "Engineered Wood 14-3 Plank",
    "18-4 Plank": "Engineered Wood 18-4 Plank",
}


def tidy(brand, coll, rng):
    """Display name and flooring type for a range."""
    rng = RANGE_FIXUP.get(rng, rng)
    name = rng
    ftype = "carpets"
    if brand == "Victoria Carpets":
        if coll and coll.startswith("Universal"):
            # Victoria's Universal collection is LVT, not timber
            name, ftype = f"Universal {rng}", "lvt"
        elif rng.startswith("Engineered Wood"):
            ftype = "wood"
    elif coll:
        name = f"{coll} {rng}"
    return name, ftype


def slug(*parts):
    s = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return re.sub(r"-+", "-", s)


def code_for(brand, rng):
    b = "".join(w[0] for w in re.split(r"\s+", brand) if w)[:2].upper()
    r = "".join(w[0] for w in re.split(r"\s+", rng) if w)[:3].upper()
    return f"{b}-{r}"


def main():
    data = json.load(open(os.path.join(ROOT, "catalogue.json")))
    chips, roomsets = data["chips"], data["roomsets"]

    groups = OrderedDict()
    dropped = defaultdict(int)
    for ch in chips:
        if not ch.get("hex") or not ch.get("range"):
            continue
        key = (ch["brand"], ch["collection"], ch["range"])
        if not ch["colour"]:
            dropped[key] += 1
            continue
        groups.setdefault(key, []).append(ch)

    # de-duplicate colours within a range, keeping first seen
    for key, cols in groups.items():
        seen, out = set(), []
        for c in sorted(cols, key=lambda x: x["colour"]):
            if c["colour"].lower() in seen:
                continue
            seen.add(c["colour"].lower())
            out.append(c)
        groups[key] = out

    # ---- pick a roomset per range -------------------------------------------
    photo_for = {}
    for key in groups:
        brand, coll, rng = key
        cands = [r for r in roomsets if r["brand"] == brand and
                 (r.get("range") == rng or (rng and rng.lower() in r["file"].lower()))]
        cands = [r for r in cands if r["file"].lower().endswith((".jpg", ".jpeg", ".png"))]
        if cands:
            cands.sort(key=lambda r: ("portrait" in r["file"].lower(), len(r["file"])))
            photo_for[key] = cands[0]

    print(f"{len(groups)} ranges, {sum(len(v) for v in groups.values())} named colours")
    print(f"{len(photo_for)} ranges matched to a supplier roomset\n")

    # ---- upload the chosen roomsets, optimised ------------------------------
    account = os.environ.get("R2_ACCOUNT")
    s3 = boto3.client("s3", region_name="auto",
                      endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                      config=Config(max_pool_connections=24, retries={"max_attempts": 4}))

    def push(item):
        key, room = item
        name = slug(key[0], key[2]) + ".jpg"
        raw = s3.get_object(Bucket=BUCKET, Key=room["key"])["Body"].read()
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if im.width > PHOTO_W:
            im = im.resize((PHOTO_W, round(im.height * PHOTO_W / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=82, optimize=True, progressive=True)
        s3.put_object(Bucket=BUCKET, Key=f"assets/ranges/{name}", Body=buf.getvalue(),
                      ContentType="image/jpeg",
                      CacheControl="public, max-age=31536000, immutable")
        # keep a local copy so the site works without the bucket
        local = os.path.join(ROOT, "assets", "ranges", name)
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with open(local, "wb") as fh:
            fh.write(buf.getvalue())
        return name, len(buf.getvalue())

    uploaded = {}
    with ThreadPoolExecutor(16) as ex:
        for (key, _), (name, size) in zip(photo_for.items(), ex.map(push, photo_for.items())):
            uploaded[key] = name
    print(f"uploaded {len(uploaded)} range photos to r2://{BUCKET}/assets/ranges/\n")

    # ---- emit the JS --------------------------------------------------------
    lines = []
    wx = 0
    for i, (key, cols) in enumerate(groups.items()):
        brand, coll, rng = key
        name, ftype = tidy(brand, coll, rng)
        rid = slug(brand, name)
        approx = any(x.get("approx") for x in cols)
        if key in uploaded:
            photo = f'P("ranges/{uploaded[key]}")'
        else:
            photo = WESTEX_FALLBACK[wx % len(WESTEX_FALLBACK)]
            wx += 1
        lines.append(f"""  {{
    id: "{rid}", type: "{ftype}", brand: {json.dumps(brand)},
    name: {json.dumps(name)}, code: "{code_for(brand, rng)}", real: true,
    photo: {photo}, alt: {json.dumps(name + " carpet")},
    blurb: {json.dumps(f"{len(cols)} shades. Colours read from {brand} roomset photography, so treat them as a guide until the swatch book is in." if approx else f"{len(cols)} shades, measured from the {brand} swatch photographs.")},
    colours: [
{chr(10).join('      c(' + json.dumps(x['colour']) + ', ' + json.dumps(x['colour'][:3].upper() + str(n + 1).zfill(2)) + ', ' + json.dumps(x['hex']) + '),' for n, x in enumerate(cols))}
    ],
  }},""")

    out = os.path.join(ROOT, "catalogue.generated.js")
    with open(out, "w") as fh:
        fh.write("/* GENERATED by tools/emit-catalogue.py — do not edit by hand.\n"
                 "   Colours are measured from the supplier swatch photographs. */\n")
        fh.write("\n".join(lines) + "\n")
    print(f"written {out}")

    if dropped:
        print("\nranges with unnamed colours (filenames are supplier codes only):")
        for (brand, coll, rng), n in sorted(dropped.items()):
            kept = len(groups.get((brand, coll, rng), []))
            print(f"  {brand} · {rng}: {n} dropped, {kept} kept")


if __name__ == "__main__":
    main()
