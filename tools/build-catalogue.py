#!/usr/bin/env python3
"""
Turn the supplier photo dump in R2 into a catalogue.

The suppliers sent two different kinds of image and they are not
interchangeable:

  colour chips  a photograph of the physical swatch, shot flat and evenly lit.
                The colour of these pixels IS the colour of the carpet, so the
                hex is measured from the image rather than invented.
  roomsets      a styled interior. Useful as range photography, useless for
                measuring colour — the floor is lit, shadowed and at an angle.

So chips give the palette, roomsets give the pictures, and the script never
takes a colour reading from a roomset.

Colour names come from the filenames, which each supplier formats differently;
FOLDER_RULES below carries one parser per source. Anything it cannot parse is
reported rather than guessed at, because a wrong colour name on a carpet
catalogue is worse than a missing one.

    export R2_ACCOUNT=... AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
    python3 tools/build-catalogue.py            # writes catalogue.json
    python3 tools/build-catalogue.py --limit 40 # quick sample while tweaking

Requires: pip install boto3 Pillow numpy
"""
import io
import json
import os
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

import boto3
import numpy as np
from botocore.config import Config
from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # supplier scans are large by design

BUCKET = "haris-carpets"
PREFIX = "incoming/"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "catalogue.json")
WORKERS = 24

SKIP = {".DS_Store", "Thumbs.db"}
IMAGE_EXT = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp")


def titlecase(s):
    """ALABASTER -> Alabaster, but leave MixedCase names alone."""
    s = re.sub(r"\s+", " ", s.replace("_", " ").replace("-", " ")).strip()
    return s.title() if s.isupper() or s.islower() else s


# ---------------------------------------------------------------------------
# One filename parser per source. Each returns the colour name, or None when
# the filename does not carry one.
# ---------------------------------------------------------------------------
# A supplier product code, not a colour: ZENIALAB4S, NBELCHAM4S. The digit is
# what separates a code from a range name shouted in caps (ULTIMA, WESTEND).
CODE_ONLY = re.compile(r"^(?=[A-Z0-9]*\d)[A-Z0-9]{6,}$")
SUFFIXES = re.compile(r"[_\- ]?(overhead|above|wide|\d+px|copy|cameo|roomset|C)$", re.I)


def strip_noise(stem):
    s = re.sub(r"^copy of\s+", "", stem, flags=re.I)
    prev = None
    while prev != s:                      # names stack several: "...-223px-Wide"
        prev = s
        s = SUFFIXES.sub("", s).strip(" -_")
    return s


def camel_split(s):
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)


# Words that describe a finish or a board format, never a colour. A name is cut
# at the first of these: "Chic Brushed & Smoked UV Lacquered Plank" is the shade
# "Chic", photographed on a particular board.
FINISH_WORDS = {"brushed", "smoked", "uv", "lacquered", "oiled", "matt", "plank",
                "herringbone", "fishbone", "parquet", "render", "worn", "tile",
                "stone", "wood", "engineered", "roomset", "lifestyle"}
VARIANT_TAIL = re.compile(r"(\s+[A-Za-z]?\d+)+$")   # "Sand Dune P1", "Nimbus Cloud 2"
LETTER_TAIL = re.compile(r"\s+[A-Z]$")              # "Sand Dune L"


def normalise_colour(name):
    """Collapse the supplier's shot variants down to the shade itself.

    Hugh Mackay ship one shade several times over — "Sand Dune", "Sand Dune L",
    "Sand Dune P1", "Sand Dune P2" are the same carpet lit four ways, and
    "Puddle Duck & Nimbus Cloud 3" is a room containing two of them. Listing
    those as separate colours is what makes a catalogue unreadable.
    """
    if not name:
        return None
    s = name.split("&")[0].strip()      # a pairing shot is filed under its first shade
    s = VARIANT_TAIL.sub("", s).strip()
    s = LETTER_TAIL.sub("", s).strip()
    kept = []
    for tok in s.split():
        if tok.lower() in FINISH_WORDS:
            break
        kept.append(tok)
    s = " ".join(kept).strip()
    if len(s) < 3 or re.fullmatch(r"[\d\s]+", s):
        return None                      # a board size, not a shade
    return s


def parse_easicare(stem, rng):
    """Hugh Mackay marks close-ups with a trailing "Cameo" or "C" and leads with
    the range, sometimes with "Easicare" in front of that:
       "Aura Sand Dune Cameo"           -> Sand Dune
       "Natural-Impressions---Azure-Breeze" -> Azure Breeze
       "Easicare_Grace_Cherish_C"       -> Cherish
       "EasiSisal_CAMEO"                -> None (the range itself, not a shade)
    """
    s = strip_noise(stem)
    if "---" in s:
        s = s.split("---", 1)[1]
    toks = [t for t in re.split(r"[\s_-]+", s) if t]
    drop = {"easicare"} | {t.lower() for t in re.split(r"[\s_-]+", rng or "") if t}
    while toks and toks[0].lower() in drop:
        toks.pop(0)
    return titlecase(camel_split(" ".join(toks))) if toks else None


def parse_colour(stem, rng):
    """Pull the colour name out of a supplier filename.

    Every supplier separates range from colour differently, and two of them
    change convention between ranges, so this works from the shape of the name
    rather than from a per-folder rule:

      "Elysian - Abalone"                 dash separated
      "FWT-Swatch-Bayton-Birch"           dash separated with a code prefix
      "Malabar Two Fold_Balm_Overhead"    underscore, range holds the spaces
      "Primo_Grande_Alloy_Grey"           underscore throughout
      "Sumptious_ManorGrey"               underscore, colour is camelCase
      "ZENIALAB4S"                        a code — returns None, never a guess
    """
    s = strip_noise(stem)
    if not s:
        return None

    if " - " in s:
        return titlecase(camel_split(s.split(" - ", 1)[1]))

    if "_" in s:
        parts = [p for p in s.split("_") if p]
        if CODE_ONLY.match(parts[0]):
            return None
        if len(parts) >= 2:
            if " " in parts[0]:
                # the range carries the spaces, so the colour is the next field
                return titlecase(camel_split(parts[1]))
            # underscores throughout: drop the leading tokens of the range name
            rtok = [t.lower() for t in re.split(r"[\s_-]+", rng or "") if t]
            i = 0
            while i < len(parts) - 1 and parts[i].lower() in rtok:
                i += 1
            if i == 0:
                i = 1       # nothing matched: assume the first field is a range label
            return titlecase(camel_split(" ".join(parts[i:])))
        return None

    if "-" in s:
        toks = [t for t in s.split("-") if t]
        # drop leading range/format tokens: FWT, Swatch, and the range's own words
        rtok = {t.lower() for t in re.split(r"[\s_-]+", rng or "") if t} | {"swatch", "fwt"}
        while len(toks) > 1 and toks[0].lower() in rtok:
            toks.pop(0)
        # a leading all-caps abbreviation is a product code, not a colour
        while len(toks) > 1 and CODE_ONLY.match(toks[0]):
            toks.pop(0)
        return titlecase(camel_split(" ".join(toks))) if toks else None

    if CODE_ONLY.match(s):
        return None
    return titlecase(camel_split(s))


# folder prefix -> (brand, type, kind, parser, range-from-folder?)
FOLDER_RULES = [
    # sample: how to read a colour off the image.
    #   center  flat swatch filling the frame — median of the central half
    #   frame   flat carpet with a styling prop on it — median of the whole
    #           frame, which the prop cannot shift because carpet dominates
    #   floor   a real roomset — median of the lower third. An approximation,
    #           and marked as one: the floor is lit and angled, so this is a
    #           guide colour, not a measurement.
    ("westex/", "Westex", "carpets", "chip", True, "center"),
    ("Cormar Colour Chips/", "Cormar Carpets", "carpets", "chip", True, "center"),
    ("Cormar Roomset Images", "Cormar Carpets", "carpets", "roomset", False, None),
    ("EasiCare Roomsets/", "Hugh Mackay", "carpets", "chip", True, "frame"),
    ("myvictoria_universal", "Victoria Carpets", "wood", "chip", True, "floor"),
    ("myvictoria_burfor", "Victoria Carpets", "carpets", "roomset", False, None),
]


def classify(key):
    """key -> dict(brand, type, kind, range, colour) or None to skip."""
    rel = key[len(PREFIX):]
    name = os.path.basename(rel)
    if name in SKIP or not name.lower().endswith(IMAGE_EXT):
        return None
    stem = os.path.splitext(name)[0]
    folder = os.path.dirname(rel)

    for prefix, brand, ftype, kind, range_from_folder, sample in FOLDER_RULES:
        if not rel.startswith(prefix) and prefix not in rel:
            continue

        rng, collection = None, None
        if range_from_folder:
            segs = [s for s in folder.split("/") if s]
            # drop the wrapper folders the download tools added
            segs = [s for s in segs if not s.startswith("drive-download")
                    and s not in ("westex", "Cormar Colour Chips", "EasiCare Roomsets")
                    and not s.startswith("myvictoria_")]
            if segs and segs[0] in ("Fired Earth", "Universal Design Roomsets", "Universal Roomsets"):
                collection = segs[0]
                segs = segs[1:]
            if segs:
                rng = re.sub(r"\s+(Swatch|Roomset)s?$", "", segs[-1], flags=re.I).strip()

        colour = parse_easicare(stem, rng) if brand == "Hugh Mackay" else parse_colour(stem, rng)
        colour = normalise_colour(colour)

        return {"brand": brand, "type": ftype, "kind": kind, "range": rng,
                "collection": collection, "colour": colour, "key": key, "file": name,
                "sample": sample, "approx": sample == "floor"}
    return None


def swatch_hex(data, mode="center"):
    """Median colour of the central half of a chip.

    Median, not mean: it ignores the label, the backing card edge and any
    specular highlight without them dragging the result. Central half, because
    every one of these chips is shot with the swatch filling the frame."""
    im = Image.open(io.BytesIO(data))
    im.draft("RGB", (400, 400))  # decode JPEGs at reduced scale — much faster
    im = im.convert("RGB")
    a = np.asarray(im).astype(np.float32)
    h, w, _ = a.shape
    if mode == "frame":
        crop = a.reshape(-1, 3)
    elif mode == "floor":
        crop = a[int(h * 0.66):, :].reshape(-1, 3)
    else:
        crop = a[h // 4: 3 * h // 4, w // 4: 3 * w // 4].reshape(-1, 3)
    r, g, b = np.median(crop, axis=0).astype(int)
    return f"#{r:02x}{g:02x}{b:02x}"


def main():
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    account = os.environ.get("R2_ACCOUNT")
    if not account or not os.environ.get("AWS_ACCESS_KEY_ID"):
        sys.exit("Set R2_ACCOUNT, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY first.")
    s3 = boto3.client("s3", region_name="auto",
                      endpoint_url=f"https://{account}.r2.cloudflarestorage.com",
                      config=Config(max_pool_connections=WORKERS + 8,
                                    retries={"max_attempts": 4}))

    keys, token = [], None
    while True:
        kw = {"Bucket": BUCKET, "Prefix": PREFIX, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        keys += [o["Key"] for o in page.get("Contents", []) if not o["Key"].endswith("/")]
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]

    items = [c for c in (classify(k) for k in keys) if c]
    chips = [i for i in items if i["kind"] == "chip"]
    rooms = [i for i in items if i["kind"] == "roomset"]
    if limit:
        chips = chips[:limit]
    print(f"{len(keys)} objects -> {len(chips)} colour chips, {len(rooms)} roomsets\n")

    def measure(item):
        try:
            item["hex"] = swatch_hex(s3.get_object(Bucket=BUCKET, Key=item["key"])["Body"].read(),
                                     item.get("sample") or "center")
        except Exception as exc:
            item["hex"] = None
            item["error"] = str(exc)[:80]
        return item

    done = 0
    with ThreadPoolExecutor(WORKERS) as ex:
        for _ in ex.map(measure, chips):
            done += 1
            if done % 50 == 0:
                print(f"  measured {done}/{len(chips)}")

    named = [c for c in chips if c["colour"] and c["hex"]]
    unnamed = [c for c in chips if not c["colour"]]
    failed = [c for c in chips if c.get("error")]

    ranges = defaultdict(list)
    for c in named:
        ranges[(c["brand"], c["collection"], c["range"])].append(c)

    print(f"\n{len(named)} colours measured across {len(ranges)} ranges")
    for (brand, coll, rng), cols in sorted(ranges.items(), key=lambda x: (x[0][0], x[0][2] or "")):
        label = f"{brand} · {coll + ' · ' if coll else ''}{rng}"
        print(f"  {len(cols):4d}  {label}")

    if unnamed:
        by_folder = defaultdict(int)
        for c in unnamed:
            by_folder[f"{c['brand']} · {c['range']}"] += 1
        print(f"\n{len(unnamed)} chips whose filename carries no readable colour name:")
        for f, n in sorted(by_folder.items()):
            print(f"  {n:4d}  {f}")
    if failed:
        print(f"\n{len(failed)} unreadable: " + ", ".join(c["file"] for c in failed[:5]))

    json.dump({"chips": chips, "roomsets": rooms}, open(OUT, "w"), indent=1)
    print(f"\nwritten to {OUT}")


if __name__ == "__main__":
    main()
