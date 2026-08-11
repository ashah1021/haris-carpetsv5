#!/bin/sh
# ---------------------------------------------------------------------------
# Pull the AI-generated placeholder photography into /assets.
#
#   sh assets/fetch-images.sh        (run from the repo root)
#
# These are STAND-INS, not photos of the shop. See assets/README.md — they
# should be swapped for real showroom shots and supplier roomset packs before
# this site goes live.
#
# Run this on a normal machine. It will fail inside a restricted-egress
# sandbox, which is why the files aren't committed already.
# ---------------------------------------------------------------------------
set -e

BASE="https://d8j0ntlcm91z4.cloudfront.net/user_3EtMLeT3plYo62KphhPHGIZDUr9"
DIR="$(dirname "$0")"

fetch() {
  echo "  $2"
  curl -fsSL "$BASE/$1" -o "$DIR/$2"
}

echo "Fetching 12 placeholder images into $DIR ..."

fetch "hf_20260806_220618_a330d371-c6c1-4102-a4a4-672bce130604.png" "hero-living-room.jpg"
fetch "hf_20260806_221059_c532a91c-57e7-49ba-9d00-3ebafa9e3217.png" "showroom.jpg"
fetch "hf_20260806_221629_ac0dbb58-851a-43bb-b0fc-7611b7498b1d.png" "fitting-hands.jpg"
fetch "hf_20260806_221758_e3f6aec0-c2ac-4b30-9ad2-3fa6303976a2.png" "samples-counter.jpg"
fetch "hf_20260806_221059_5c310841-db1c-449e-8e1a-377114fec267.png" "stairs-wool-twist.jpg"
fetch "hf_20260806_221758_eeffba80-5b8e-4911-b22a-6e831fe1724f.png" "bedroom-wool.jpg"
fetch "hf_20260806_221713_617d82fc-eabd-45e8-a039-c3a0821b3754.png" "velvet-living-room.jpg"
fetch "hf_20260806_221257_b4e639ea-9cef-4ab7-a89d-737b8bd6369a.png" "pile-detail.jpg"
fetch "hf_20260806_221059_9a349fb0-01f8-45fa-bc91-ef219f854c2a.png" "wood-herringbone-kitchen.jpg"
fetch "hf_20260806_221004_b09f73ee-af7f-461f-a3b5-6c8a16d9d59d.png" "lvt-kitchen.jpg"
fetch "hf_20260806_221629_0176ab1b-b671-4843-8c14-ccd6d48ef009.png" "vinyl-utility.jpg"
fetch "hf_20260806_221629_e7322d90-113a-4a45-a1ec-ea0c37ff44d3.png" "rug-living-room.jpg"

echo "Done. Open index.html to see them in place."
