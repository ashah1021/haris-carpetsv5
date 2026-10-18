#!/usr/bin/env python3
"""
Pull a batch of photos staged in R2, inspect them, and build contact sheets.

Step one of getting real photography onto the site. Upload from your machine to
a staging prefix in the bucket, then run this to see what's actually there:

    rclone copy ~/Pictures/haris r2:haris-carpets/incoming/ --progress
    python3 tools/ingest-photos.py

It downloads to a scratch folder (never into the repo), reports dimensions,
orientation, file size and EXIF capture date, flags duplicates by content hash,
and writes contact sheets so a large batch can be reviewed as a handful of grids
rather than one file at a time.

Nothing here modifies the site. Cataloguing decisions come after looking.

    export R2_ACCOUNT=<cloudflare account id>
    export AWS_ACCESS_KEY_ID=<r2 access key id>
    export AWS_SECRET_ACCESS_KEY=<r2 secret access key>

Requires: pip install boto3 Pillow pillow-heif
"""
import hashlib
import io
import os
import sys
from collections import defaultdict

import boto3
from PIL import Image, ImageDraw

try:  # iPhone photos are HEIC by default
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    print("note: pip install pillow-heif for HEIC support")

BUCKET = "haris-carpets"
PREFIX = os.environ.get("INGEST_PREFIX", "incoming/")
WORK = os.environ.get("INGEST_DIR", os.path.expanduser("~/haris-incoming"))
SHEET_COLS, SHEET_ROWS, THUMB = 4, 3, 420


def client():
    account = os.environ.get("R2_ACCOUNT")
    if not account or not os.environ.get("AWS_ACCESS_KEY_ID"):
        sys.exit("Set R2_ACCOUNT, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY first.")
    return boto3.client("s3", region_name="auto",
                        endpoint_url=f"https://{account}.r2.cloudflarestorage.com")


def listing(s3):
    keys, token = [], None
    while True:
        kw = {"Bucket": BUCKET, "Prefix": PREFIX, "MaxKeys": 1000}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        keys += [o for o in page.get("Contents", []) if not o["Key"].endswith("/")]
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]
    return keys


def exif_date(im):
    try:
        exif = im.getexif()
        for tag in (36867, 306):  # DateTimeOriginal, DateTime
            if exif.get(tag):
                return str(exif[tag])[:10].replace(":", "-")
    except Exception:
        pass
    return ""


def main():
    s3 = client()
    objects = listing(s3)
    if not objects:
        sys.exit(f"Nothing under r2://{BUCKET}/{PREFIX} yet — upload the photos first.")

    os.makedirs(WORK, exist_ok=True)
    rows, by_hash = [], defaultdict(list)

    for obj in sorted(objects, key=lambda o: o["Key"]):
        key = obj["Key"]
        name = os.path.basename(key)
        blob = s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()
        by_hash[hashlib.sha256(blob).hexdigest()].append(name)
        path = os.path.join(WORK, name)
        with open(path, "wb") as fh:
            fh.write(blob)
        try:
            im = Image.open(path)
            im.load()
        except Exception as exc:
            rows.append((name, "UNREADABLE", str(exc)[:40], "", len(blob)))
            continue
        shape = "landscape" if im.width > im.height * 1.15 else \
                "portrait" if im.height > im.width * 1.15 else "square"
        rows.append((name, f"{im.width}x{im.height}", shape, exif_date(im), len(blob)))

    print(f"{len(rows)} file(s) under r2://{BUCKET}/{PREFIX}\n")
    print(f"  {'file':40s} {'pixels':>12s} {'shape':10s} {'taken':10s} {'size':>8s}")
    for name, px, shape, date, size in rows:
        print(f"  {name[:40]:40s} {px:>12s} {shape:10s} {date:10s} {size/1e6:7.2f}MB")

    dupes = {h: n for h, n in by_hash.items() if len(n) > 1}
    if dupes:
        print("\nidentical files (same bytes):")
        for names in dupes.values():
            print("  ", " == ".join(names))

    # contact sheets — review a big batch as a few grids
    good = [r[0] for r in rows if r[1] != "UNREADABLE"]
    per = SHEET_COLS * SHEET_ROWS
    sheets = 0
    for start in range(0, len(good), per):
        chunk = good[start:start + per]
        sheet = Image.new("RGB", (SHEET_COLS * THUMB, SHEET_ROWS * (THUMB + 26)), "white")
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(chunk):
            im = Image.open(os.path.join(WORK, name)).convert("RGB")
            im.thumbnail((THUMB, THUMB))
            x = (i % SHEET_COLS) * THUMB
            y = (i // SHEET_COLS) * (THUMB + 26)
            sheet.paste(im, (x + (THUMB - im.width) // 2, y + (THUMB - im.height) // 2))
            draw.text((x + 4, y + THUMB + 6), f"{start + i + 1}. {name[:44]}", fill="black")
        out = os.path.join(WORK, f"contact-{start // per + 1:02d}.jpg")
        sheet.save(out, quality=80)
        sheets += 1
    print(f"\n{sheets} contact sheet(s) written to {WORK}/contact-*.jpg")


if __name__ == "__main__":
    main()
