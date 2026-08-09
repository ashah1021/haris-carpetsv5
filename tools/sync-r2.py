#!/usr/bin/env python3
"""
Optimise /assets photos and upload them to the R2 bucket.

The originals are 2048px PNGs of 3-6 MB each — around 60 MB for the set, which
is far too heavy to serve to customers. This resizes, converts to progressive
JPEG and uploads, which took the set to ~3.5 MB (6% of the original) with no
visible loss at the sizes the site actually displays.

Credentials come from the environment. Never hard-code them here — this file is
committed.

    export R2_ACCOUNT=<cloudflare account id>
    export AWS_ACCESS_KEY_ID=<r2 access key id>
    export AWS_SECRET_ACCESS_KEY=<r2 secret access key>
    python3 tools/sync-r2.py            # optimise + upload
    python3 tools/sync-r2.py --local    # optimise the local copies too, no upload

Requires: pip install boto3 Pillow
"""
import glob
import io
import os
import sys

import boto3
from PIL import Image

BUCKET = "haris-carpets"
# the hero runs full-bleed so it keeps more width; everything else is a card
WIDE = {"hero-living-room.jpg"}
WIDE_PX, NORMAL_PX = 2000, 1600
QUALITY = 82


def optimise(path):
    name = os.path.basename(path)
    im = Image.open(path).convert("RGB")
    target = WIDE_PX if name in WIDE else NORMAL_PX
    if im.width > target:
        im = im.resize((target, round(im.height * target / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return name, buf.getvalue()


def main():
    local_only = "--local" in sys.argv

    client = None
    if not local_only:
        account = os.environ.get("R2_ACCOUNT")
        if not account or not os.environ.get("AWS_ACCESS_KEY_ID"):
            sys.exit("Set R2_ACCOUNT, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY first.")
        client = boto3.client(
            "s3", region_name="auto",
            endpoint_url=f"https://{account}.r2.cloudflarestorage.com")

    before = after = 0
    for path in sorted(glob.glob("assets/*.jpg")):
        size_in = os.path.getsize(path)
        name, data = optimise(path)
        if client:
            client.put_object(
                Bucket=BUCKET, Key=f"assets/{name}", Body=data,
                ContentType="image/jpeg",
                # filenames are stable, so a long immutable TTL is safe; change
                # the filename (not the contents) when a photo is replaced
                CacheControl="public, max-age=31536000, immutable")
        else:
            with open(path, "wb") as fh:
                fh.write(data)
        before += size_in
        after += len(data)
        print(f"  {name:34s} {size_in/1e6:5.1f}MB -> {len(data)/1e6:5.2f}MB")

    where = "optimised in place" if local_only else f"uploaded to r2://{BUCKET}/assets/"
    print(f"\n{before/1e6:.1f}MB -> {after/1e6:.1f}MB ({100*after/before:.0f}%), {where}")


if __name__ == "__main__":
    main()
