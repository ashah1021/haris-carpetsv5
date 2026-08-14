/* ============================================================================
   HARI'S CARPETS — CATALOGUE + CONTENT DATA
   ----------------------------------------------------------------------------
   Everything on the site renders from this file.

   Real content (from haris-carpets.co.uk): business details, address, phone,
   socials, product categories, services, about copy.

   >>> STILL TO CONFIRM <<<
     - Carpet, wood and LVT colours are MEASURED from the supplier swatch
       photography by tools/build-catalogue.py — they are not eyeballed.
     - Vinyl and rugs are still invented: no colour chips arrived for either.
     - Photography in /assets is AI-generated stand-in imagery. Replace with
       real showroom + supplier roomset shots. See assets/README.md.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   FEATURE SWITCHES
   samples: the "order up to 5 free samples" postal tray. Off because it is not
   confirmed Hari's offer that service. This is NOT the same thing as the
   favourites shortlist, which is always on — favourites are a private list a
   customer builds while browsing, with nothing posted to anyone.
   -------------------------------------------------------------------------- */
const FEATURES = {
  samples: false,

  /* The floor visualiser is a separable add-on, not part of the website build.
     false hides every entry point and stops it loading; visualiser.js and
     visualiser.css can then be deleted with nothing else to change. */
  visualiser: true,
};

const BUSINESS = {
  name: "Hari's Carpets",
  since: "Hounslow · Over 30 years",
  strapline: "Carpets, wood, vinyl & rugs — supplied and fitted across London.",
  blurbShort:
    "A family-run flooring business in Hounslow, supplying and fitting for homes, trade and commercial projects across London and the Home Counties.",
};

const CONTACT = {
  phone: "020 8570 6502",
  phoneHref: "tel:+442085706502",
  email: "sales@hariscarpets.co.uk",
  address: "267 Hanworth Road, Hounslow, Middlesex, TW3 3RZ",
  mapsUrl: "https://www.google.com/maps/place/Hari's+Carpets/@51.4624955,-0.3671699,17z",
  hours: "Mon–Sat · Sun by appointment", // TODO: confirm exact opening hours
  area: "London & the Home Counties (within the M25)",
};

const SOCIALS = [
  { name: "Instagram", url: "https://www.instagram.com/hariscarpets/" },
  { name: "Facebook", url: "https://www.facebook.com/HarisCarpetsUK/" },
  { name: "Twitter", url: "https://twitter.com/hariscarpets1" },
];

/* ----------------------------------------------------------------------------
   PHOTOGRAPHY
   Photos live in the Cloudflare R2 bucket `haris-carpets`. In production
   worker.js serves them from this origin at these same /assets/<name>.jpg
   URLs, so there is no CORS to get right — which matters because the
   visualiser reads raw canvas pixels and a cross-origin image taints the
   canvas. The copies committed here are the fallback.

   IMG_BASE only needs setting to serve from somewhere else entirely:
     ""                        this origin  (default — Worker serves from R2)
     "https://pub-xxx.r2.dev/" the bucket's public URL, cross-origin

   Floor masks are never served from R2; they stay in /assets/masks.
   -------------------------------------------------------------------------- */
const IMG_BASE = "";

const P = (f) => IMG_BASE + "assets/" + f;

const IMG = {
  hero:        P("hero-living-room.jpg"),
  showroom:    P("showroom.jpg"),
  fitting:     P("fitting-hands.jpg"),
  samples:     P("samples-counter.jpg"),
  stairs:      P("stairs-wool-twist.jpg"),
  bedroom:     P("bedroom-wool.jpg"),
  velvet:      P("velvet-living-room.jpg"),
  pile:        P("pile-detail.jpg"),
  wood:        P("wood-herringbone-kitchen.jpg"),
  lvt:         P("lvt-kitchen.jpg"),
  vinyl:       P("vinyl-utility.jpg"),
  rug:         P("rug-living-room.jpg"),
};

/* =========================================================================
   PHOTOGRAPHS THE SHOP CAN REPLACE
   Each slot has a picture shipped with the site and, once the shop uploads one
   from /admin, an override recorded in the site document. Everything that can
   be replaced goes through here, so a slot nobody has touched keeps the
   original and a slot with no override never breaks.
   ========================================================================= */
const IMG_SLOTS = [
  ["hero",     "Home page banner",       "The big photograph at the top of the home page"],
  ["showroom", "The showroom",           "On the home page and About"],
  ["fitting",  "Fitting",                "Beside the fitting service"],
  ["stairs",   "Stairs and landings",    "Beside the stairs service"],
  ["samples",  "Samples on the counter", "Small inset on the home page"],
  ["velvet",   "Carpets",                "The Carpets tile in the catalogue"],
  ["wood",     "Wood & laminate",        "The Wood tile in the catalogue"],
  ["lvt",      "LVT",                    "The LVT tile in the catalogue"],
  ["vinyl",    "Vinyl",                  "The Vinyl tile in the catalogue"],
  ["rug",      "Rugs",                   "The Rugs tile in the catalogue"],
  ["pile",     "Pile close-up",          "Stands in for collections with no photograph"],
  ["bedroom",  "Bedroom",                "Stands in for collections with no photograph"],
];

/* ----------------------------------------------------------------------------
   VISUALISER ROOMS
   Each needs a photo and a greyscale floor mask. Masks come from
   tools/make-floor-mask.py; see assets/README.md for which rooms it can do
   automatically and which need cutting by hand. A room whose photo or mask is
   missing is dropped from the picker at runtime rather than rendering broken,
   so an entry can be added here before its assets exist.
   -------------------------------------------------------------------------- */
const VIS_ROOMS = [
  /* Real supplier roomsets, so the carpet is fitted wall to wall. The earlier
     living room was a rug on floorboards, which showed a rug changing colour
     rather than a fitted carpet — the wrong thing to be selling. */
  { id: "living-room", name: "Living room", photo: P("room-living-carpet.jpg"),
    mask: "assets/masks/room-living-carpet.png",
    note: "Fitted wall to wall, north-facing room." },
  { id: "bedroom", name: "Bedroom", photo: P("room-bedroom-carpet.jpg"),
    mask: "assets/masks/room-bedroom-carpet.png",
    note: "Fitted bedroom carpet, evening light." },
  { id: "kitchen", name: "Kitchen", photo: IMG.lvt, mask: "assets/masks/lvt-kitchen.png",
    note: "Open-plan kitchen-diner, large windows." },
  { id: "utility", name: "Utility", photo: IMG.vinyl, mask: "assets/masks/vinyl-utility.png",
    note: "Utility room — the same floors suit a bathroom." },

  /* Not yet live, both blocked on assets rather than code:
       stairs   — photo is in /assets but its mask needs cutting by hand. See
                  assets/README.md for the measurements and why.
       bathroom — no photograph yet. Add one, mask it, add it here. */
];

/* ----------------------------------------------------------------------------
   FLOORING TYPES
   The top level of the shop, of the catalogue filters and of the visualiser.
   `rooms` lists which visualiser scenes a type makes sense in.
   -------------------------------------------------------------------------- */
const TYPES = [
  { id: "carpets", name: "Carpets", route: "#/catalogue/carpets",
    photo: IMG.velvet, alt: "Wool velvet carpet in a panelled living room",
    blurb: "Wool-rich and synthetic carpets from Britain's leading mills. Browse by brand, range and colour.",
    rooms: ["living-room", "bedroom"] },

  { id: "wood", name: "Wood & Laminate", route: "#/catalogue/wood",
    photo: IMG.wood, alt: "Engineered oak herringbone flooring in a kitchen-diner",
    blurb: "Engineered and solid wood, plus hard-wearing laminate — herringbone, chevron and plank formats.",
    rooms: ["kitchen", "utility"] },

  { id: "lvt", name: "LVT", route: "#/catalogue/lvt",
    photo: IMG.lvt, alt: "Stone-effect luxury vinyl tile flooring in a modern kitchen",
    blurb: "Luxury vinyl tile — the look of wood or stone with the durability for kitchens, bathrooms and busy family spaces.",
    rooms: ["kitchen", "utility"] },

  { id: "vinyl", name: "Vinyl", route: "#/catalogue/vinyl",
    photo: IMG.vinyl, alt: "Cushioned wood-effect sheet vinyl in a utility room",
    blurb: "Cushioned sheet vinyl — practical, comfortable underfoot and easy to keep clean.",
    rooms: ["utility", "kitchen"] },

  { id: "rugs", name: "Luxury Rugs", route: "#/catalogue/rugs",
    photo: IMG.rug, alt: "Patterned woven luxury rug layered over wood flooring",
    blurb: "Luxury rugs, including Louis de Poortere, to finish and pull a room together.",
    rooms: ["living-room"] },
];

/* Four-up photo strip near the foot of the home page */
/* =========================================================================
   STYLES — how customers actually shop
   -------------------------------------------------------------------------
   Nobody walks in asking for Ultima or Apollo Elite. They ask for something
   easy to clean, or a wool twist, or "that smooth velvety one". Collection
   names are the mill's filing system, not the customer's, so these sit in
   front of them: pick the sort of floor you want, then the collection, then
   the colour. The existing brand and colour filters are untouched underneath
   — this is a way in, not a replacement.

   A range may belong to more than one style, and a range in no style at all
   is not lost: it still appears under its collection and in every filter. So
   a half-filled table degrades to today's behaviour rather than hiding stock.

   ON THE ACCURACY OF THIS TABLE
   The supplier dump carried colour and nothing else — no fibre, no pile
   construction — so these assignments come from two places, marked per entry:
     [name]  the range name says it outright (Bouclé is a loop; Wiske Velvet
             is a velvet; Universal Herringbone is a herringbone)
     [seen]  read off the swatch photography — loop, rib and smooth pile are
             unmistakable at tile resolution
     [ask]   neither: assigned from what these ranges usually are, and NOT
             verified against a spec sheet. Fibre is the weak spot, and it is
             exactly what "easy clean" turns on. Hari should confirm these
             before the site is handed over; they are all in one place here.
   ========================================================================= */
const STYLES = {
  carpets: [
    { id: "easy-clean", name: "Easy clean",
      blurb: "Stain-resistant synthetic piles that take a spill, a dog and a toddler without flinching.",
      ranges: [
        "cormar-carpets-apollo-elite",    /* [ask] polypropylene */
        "cormar-carpets-apollo-plus",     /* [ask] polypropylene */
        "cormar-carpets-primo-grande",    /* [ask] Primo is Cormar's synthetic family */
        "cormar-carpets-primo-tweeds",    /* [ask] */
        "cormar-carpets-primo-ultra",     /* [ask] */
      ] },

    { id: "wool-twist", name: "Wool twist pile",
      blurb: "The classic British carpet. Springy, hard-wearing and it keeps its looks in a hallway.",
      ranges: [
        "westex-fine-westex-twist",       /* [name] */
        "westex-ultima",                  /* [seen] cut twist pile */
        "westex-westend",                 /* [seen] */
        "cormar-carpets-hampstead",       /* [ask] */
        "cormar-carpets-kingston",        /* [seen] smooth cut pile */
        "cormar-carpets-linwood",         /* [ask] */
        "cormar-carpets-pembroke",        /* [ask] */
      ] },

    { id: "velvet", name: "Velvet & saxony",
      blurb: "A smooth, dense, flat pile with a sheen that shifts as you cross the room.",
      ranges: [
        "westex-fired-earth-wiske-velvet",/* [name] */
        "westex-silken",                  /* [seen] smooth, no visible loop */
        "westex-elysian",                 /* [seen] */
        "westex-pure-luxury",             /* [seen] */
        "cormar-carpets-trinity",         /* [seen] plain smooth cut pile */
      ] },

    { id: "loop", name: "Loop & textured",
      blurb: "Uncut loops and fine ribs — a quieter, more textural floor that hides a footprint.",
      ranges: [
        "westex-boucle",                  /* [name] bouclé is a loop */
        "westex-undyed-loop",             /* [name] */
        "westex-fired-earth-loxley-loop", /* [name] */
        "westex-cable",                   /* [seen] corded rib */
        "westex-briar",                   /* [seen] loop */
        "westex-barrington",              /* [seen] fine rib */
      ] },

    { id: "natural", name: "Natural looks",
      blurb: "Sisal and seagrass effects in wool — the coastal look, without the scratch.",
      ranges: [
        "hugh-mackay-easisisal",          /* [name] */
        "hugh-mackay-natural-impressions",/* [name] */
        "cormar-carpets-malabar",         /* [seen] ribbed natural weave */
      ] },

    /* Deliberately empty until Hari says which ranges belong. The original
       site had a stripes-and-patterns square, but nothing in the supplier
       photography is unambiguously striped, and inventing one would put a
       claim on the site that the swatch book does not back. An empty style
       does not render. */
    { id: "pattern", name: "Stripes & patterns",
      blurb: "Stripes, borders and figured designs.",
      ranges: [] },
  ],

  /* Wood and LVT need no guesswork — the format IS the range name. */
  wood: [
    { id: "plank", name: "Plank",
      blurb: "Long, wide boards. The straightforward, room-lengthening choice.",
      ranges: ["victoria-carpets-engineered-wood-14-3-plank",
               "victoria-carpets-engineered-wood-18-4-plank"] },
    { id: "herringbone", name: "Herringbone",
      blurb: "Short blocks laid in a zig-zag. Period looks and a lot of character.",
      ranges: ["victoria-carpets-engineered-wood-14-3-herringbone"] },
  ],

  lvt: [
    { id: "wood-effect", name: "Wood effect",
      blurb: "The look of a timber floor, in a tile that shrugs off water.",
      ranges: ["victoria-carpets-universal-plank"] },
    { id: "stone-effect", name: "Stone & tile effect",
      blurb: "Stone and slate looks, warm underfoot in a way the real thing is not.",
      ranges: ["victoria-carpets-universal-stone"] },
    { id: "herringbone", name: "Herringbone & parquet",
      blurb: "Herringbone, fishbone and parquet, in a format that suits a kitchen.",
      ranges: ["victoria-carpets-universal-herringbone",
               "victoria-carpets-universal-fishbone",
               "victoria-carpets-universal-parquet"] },
  ],

  /* vinyl and rugs are still the two placeholder ranges awaiting supplier
     data, so there is nothing to sort into styles yet. */
  vinyl: [],
  rugs: [],
};

const GALLERY = [
  { src: IMG.stairs,  alt: "Wool twist carpet fitted to a Victorian staircase and landing" },
  { src: IMG.bedroom, alt: "Plush oatmeal wool carpet in a bedroom" },
  { src: IMG.velvet,  alt: "Wool velvet carpet in a panelled living room" },
  { src: IMG.pile,    alt: "Close detail of deep wool velvet carpet pile" },
];

const ABOUT = {
  lead: "Flooring ties a whole interior together — so it's worth getting right.",
  body: [
    "Hari's Carpets is a family-run business based in Hounslow. For over thirty years we've supplied and fitted flooring for homeowners, trade and commercial customers right across London and the Home Counties.",
    "We carry an extensive range from trusted British mills, so there's a floor for every room, every level of traffic and every budget. We take the time to understand what you actually need, then help you find the right one — no pressure, no guesswork.",
    "When it comes to fitting, our own skilled team handles the whole job: measuring, planning, uplift of your old flooring and a clean, careful installation finished to a high standard.",
  ],
};

const SERVICES = [
  { title: "We arrange installation", body: "Our own skilled fitters handle the whole job, start to finish." },
  { title: "Free measuring & planning", body: "We measure up and plan the job at your home, at no cost and no obligation." },
  { title: "Uplift & removal service", body: "We lift and take away your old flooring so you don't have to." },
  { title: "Wear guarantee", body: "Every floor we supply and fit comes with a wear guarantee." },
];

/* ============================================================================
   THE CATALOGUE
   ----------------------------------------------------------------------------
   One flat list of ranges. Everything else is derived from it: the catalogue
   pages and their brand/colour filters, the brand pages, the visualiser
   palettes and the favourites shortlist. Add a range here and it appears in
   all of them.

   Colour families (Neutral, Grey, Brown, Green, Blue …) are NOT stored. They
   are computed from each hex value at runtime, so a new colour is filterable
   the moment it is added and nobody has to keep a label in sync with a swatch.

   Shape of a range:
     id      unique, used in URLs
     type    one of TYPES above
     brand   display name; brands are grouped from this
     name    range name
     code    supplier range code
     photo   roomset image
     spec    { fibre, pile, widths, use } — optional, shown on the range page
     real    false marks data still to be replaced from the supplier pack
     colours [{ name, code, hex }]
   ============================================================================ */
/* room: 1 marks a shade the supplier also photographed in a room. Set by
   tools/emit-catalogue.py; omitted for the majority that have no such shot. */
const c = (name, code, hex, room) => (room ? { name, code, hex, room: 1 } : { name, code, hex });

/* Victoria name their files range-first — universal-plank-cashew.jpg — so the
   tile for a shade is not named after the shade and cannot be derived from it.
   v() carries the file stem explicitly, plus a second stem when the same colour
   also came with a room photograph.
   Regenerate with: python3 tools/recover-victoria.py --write */
const v = (name, code, hex, file, room) =>
  (room ? { name, code, hex, file, roomFile: room } : { name, code, hex, file });

/* Colours whose photograph is a room or a styled shot rather than a flat
   colour chip — some suppliers sent no chips at all for a range. The hex was
   measured off the floor in the photograph, so the colour is sound; it is the
   picture that cannot serve as a swatch. The grid shows the measured colour
   for these and files the photograph where it belongs, as a roomset.
   Regenerate with: python3 tools/classify-tiles.py --write */
/* BEGIN GENERATED room-only list — tools/classify-tiles.py */
const ROOM_ONLY = new Set([
  "hugh-mackay-aura:puddle-duck-nimbus-cloud-1",
  "hugh-mackay-aura:puddle-duck-nimbus-cloud-2",
  "hugh-mackay-aura:puddle-duck-nimbus-cloud-3",
  "hugh-mackay-aura:puddle-duck-nimbus-cloud-4",
  "hugh-mackay-aura:puddle-duck",
  "hugh-mackay-aura:sand-dune-l",
  "hugh-mackay-aura:sand-dune-p1",
  "hugh-mackay-aura:sand-dune-p2",
  "hugh-mackay-aura:sand-dune",
  "hugh-mackay-easisisal:landscape-1",
  "hugh-mackay-easisisal:landscape-2",
  "hugh-mackay-easisisal:landscape",
  "hugh-mackay-easisisal:outdoor-1",
  "hugh-mackay-easisisal:outdoor-2",
  "hugh-mackay-easisisal:outdoor",
  "hugh-mackay-easisisal:portraits-1",
  "hugh-mackay-easisisal:portraits-2",
  "hugh-mackay-easisisal:portraits",
  "hugh-mackay-first-impressions:humble-l",
  "hugh-mackay-first-impressions:humble-p-cmyk",
  "hugh-mackay-first-impressions:humble-p",
  "hugh-mackay-first-impressions:humble",
  "hugh-mackay-first-impressions:welldressed-c-cmyk-smaller",
  "hugh-mackay-first-impressions:welldressed-c-cmyk",
  "hugh-mackay-first-impressions:welldressed-l1",
  "hugh-mackay-first-impressions:welldressed-l2-cmyk",
  "hugh-mackay-first-impressions:welldressed-l2",
  "hugh-mackay-first-impressions:welldressed-p",
  "hugh-mackay-first-impressions:welldressed",
  "hugh-mackay-freedom-freedom-xtra:doeskin-l",
  "hugh-mackay-freedom-freedom-xtra:doeskin-p1",
  "hugh-mackay-freedom-freedom-xtra:doeskin-p2",
  "hugh-mackay-freedom-freedom-xtra:doeskin",
  "hugh-mackay-freedom-freedom-xtra:skyline-l",
  "hugh-mackay-freedom-freedom-xtra:skyline-p",
  "hugh-mackay-freedom-freedom-xtra:skyline",
  "hugh-mackay-grace:cherish-l",
  "hugh-mackay-grace:cherish-p",
  "hugh-mackay-grace:cherish-p2",
  "hugh-mackay-grace:cherish",
  "hugh-mackay-grace:shimmer-l",
  "hugh-mackay-grace:shimmer-p",
  "hugh-mackay-grace:shimmer",
  "hugh-mackay-heartland:rubery-l",
  "hugh-mackay-heartland:rubery-p",
  "hugh-mackay-heartland:rubery",
  "hugh-mackay-heartland-heathers:sahara-c1",
  "hugh-mackay-heartland-heathers:sahara-c2",
  "hugh-mackay-heartland-heathers:sahara-c3",
  "hugh-mackay-heartland-heathers:sahara-l",
  "hugh-mackay-heartland-heathers:sahara-l1",
  "hugh-mackay-heartland-heathers:sahara-p",
  "hugh-mackay-heartland-heathers:sahara",
  "hugh-mackay-natural-impressions:golden-husk-1",
  "hugh-mackay-natural-impressions:golden-husk",
  "hugh-mackay-natural-impressions:victoria-natural-impressions-dew-drop-4",
  "hugh-mackay-natural-impressions:victoria-natural-impressions-dew-drop-5",
  "hugh-mackay-natural-impressions:victoria-natural-impressions-dew-drop",
  "hugh-mackay-pioneer:charming-c1",
  "hugh-mackay-pioneer:charming-l",
  "hugh-mackay-pioneer:charming-p",
  "hugh-mackay-pioneer:charming-p1",
  "hugh-mackay-pioneer:charming",
  "hugh-mackay-ultimate-expressions:antique-rose-l",
  "hugh-mackay-ultimate-expressions:antique-rose-p",
  "hugh-mackay-ultimate-expressions:antique-rose",
  "hugh-mackay-ultimate-expressions:sage-c-cmyk",
  "hugh-mackay-ultimate-expressions:sage-l1-cmyk",
  "hugh-mackay-ultimate-expressions:sage-l1",
  "hugh-mackay-ultimate-expressions:sage-l2",
  "hugh-mackay-ultimate-expressions:sage",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined-c-cmyk",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined-l1-cmyk",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined-l1",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined-l2-rs200pc-cmyk",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined-l2",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined-landscape-treehouse",
  "hugh-mackay-ultimate-impressions:ultimate-impressions-refined",
  "victoria-carpets-engineered-wood-14-3-herringbone:14-3-herringbone-calico-render",
  "victoria-carpets-engineered-wood-14-3-herringbone:14-3",
  "victoria-carpets-engineered-wood-14-3-herringbone:engineered-wood-14-3-herringbone-worn",
  "victoria-carpets-engineered-wood-14-3-plank:14-3",
  "victoria-carpets-engineered-wood-14-3-plank:engineered-wood-14-3-plank-calico",
  "victoria-carpets-engineered-wood-14-3-plank:engineered-wood-14-3-plank-chi",
  "victoria-carpets-engineered-wood-14-3-plank:engineered-wood-14-3-plank-ghost",
  "victoria-carpets-engineered-wood-18-4-plank:18-4",
  "victoria-carpets-engineered-wood-18-4-plank:engineered-wood-18-4-barn-oak",
  "victoria-carpets-engineered-wood-18-4-plank:engineered-wood-18-4-brushed-and-oiled-oak",
  "victoria-carpets-engineered-wood-18-4-plank:engineered-wood-18-4-buff-oak",
  "victoria-carpets-universal-fishbone:universal-design-fishbone-alpine",
  "victoria-carpets-universal-fishbone:universal-design-fishbone-fireside",
  "victoria-carpets-universal-fishbone:universal-design-fishbone-hardwick",
  "victoria-carpets-universal-fishbone:universal-design-fishbone-nordmann",
  "victoria-carpets-universal-fishbone:universal-design",
  "victoria-carpets-universal-herringbone:universal-herringbone-almond-buff",
  "victoria-carpets-universal-herringbone:universal-herringbone-fawn",
  "victoria-carpets-universal-herringbone:universal-herringbone-flint-grey",
  "victoria-carpets-universal-herringbone:universal-herringbone-haybale",
  "victoria-carpets-universal-herringbone:universal-herringbone-latte",
  "victoria-carpets-universal-herringbone:universal-herringbone-nimbus-cloud",
  "victoria-carpets-universal-herringbone:universal-herringbone-sesame",
  "victoria-carpets-universal-herringbone:universal-herringbone-smoke",
  "victoria-carpets-universal-herringbone:universal",
  "victoria-carpets-universal-parquet:universal-design-parquet-alder",
  "victoria-carpets-universal-parquet:universal-design-parquet-aspen",
  "victoria-carpets-universal-parquet:universal-design-parquet-rowan",
  "victoria-carpets-universal-parquet:universal-design",
  "victoria-carpets-universal-plank:universal-design-plank-alpine",
  "victoria-carpets-universal-plank:universal-design-plank-angora",
  "victoria-carpets-universal-plank:universal-design-plank-chalet",
  "victoria-carpets-universal-plank:universal-design-plank-fireside",
  "victoria-carpets-universal-plank:universal-design-plank-grouse",
  "victoria-carpets-universal-plank:universal-design-plank-hardwick",
  "victoria-carpets-universal-plank:universal-design-plank-nordmann",
  "victoria-carpets-universal-plank:universal-design-plank-saxon",
  "victoria-carpets-universal-plank:universal-design",
  "victoria-carpets-universal-plank:universal-plank-almond-buff",
  "victoria-carpets-universal-plank:universal-plank-cashew",
  "victoria-carpets-universal-plank:universal-plank-chateau-grey",
  "victoria-carpets-universal-plank:universal-plank-fawn",
  "victoria-carpets-universal-plank:universal-plank-flint-grey",
  "victoria-carpets-universal-plank:universal-plank-haybale",
  "victoria-carpets-universal-plank:universal-plank-latte",
  "victoria-carpets-universal-plank:universal-plank-nimbus-cloud",
  "victoria-carpets-universal-plank:universal-plank-puddle",
  "victoria-carpets-universal-plank:universal-plank-sesame",
  "victoria-carpets-universal-plank:universal-plank-smoke",
  "victoria-carpets-universal-plank:universal-plank-wenge",
  "victoria-carpets-universal-plank:universal",
  "victoria-carpets-universal-stone:universal-tile-alabaster",
  "victoria-carpets-universal-stone:universal-tile-fossil",
  "victoria-carpets-universal-stone:universal-tile-raven",
  "victoria-carpets-universal-stone:universal-tile-seashell",
  "victoria-carpets-universal-stone:universal",
]);
/* END GENERATED room-only list */

const CATALOGUE = [
  /* ------------------------------------------------- GENERATED FROM SUPPLIERS
     tools/build-catalogue.py measures every hex from the supplier's own swatch
     photography; tools/emit-catalogue.py writes this block and uploads a tile
     per colour. Regenerate rather than editing by hand. */
  {
    id: "cormar-carpets-apollo-elite", type: "carpets", brand: "Cormar Carpets",
    name: "Apollo Elite", code: "CC-AE", real: true,
    photo: P("ranges/cormar-carpets-apollo-elite.jpg"), alt: "Apollo Elite carpet",
    blurb: "14 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Cadet Grey", "CAD01", "#bcb9a7"),
      c("Campsie Cliff", "CAM02", "#777877"),
      c("Charente Beige", "CHA03", "#908778"),
      c("Chimney", "CHI04", "#4b4b43"),
      c("Coniston Slate", "CON05", "#817f73"),
      c("Dolomite", "DOL06", "#979590"),
      c("Grey Partridge", "GRE07", "#878685", 1),
      c("Helmsley Hazelnut", "HEL08", "#92866d"),
      c("Pale Angora", "PAL09", "#bfb99f"),
      c("Peanut", "PEA10", "#9e9b89"),
      c("Pretzel", "PRE11", "#a09a86"),
      c("Roman", "ROM12", "#796e5d"),
      c("Skyline Steel", "SKY13", "#9d9b99"),
      c("Soft Alabaster", "SOF14", "#b8b2a2"),
    ],
  },
  {
    id: "cormar-carpets-apollo-plus", type: "carpets", brand: "Cormar Carpets",
    name: "Apollo Plus", code: "CC-AP", real: true,
    photo: P("ranges/cormar-carpets-apollo-plus.jpg"), alt: "Apollo Plus carpet",
    blurb: "17 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Aluminium", "ALU01", "#9f9c98"),
      c("Caramel", "CAR02", "#b8a27c"),
      c("Cinder Grey", "CIN03", "#827a6d"),
      c("City Smoke", "CIT04", "#867a6f"),
      c("Cork Oak", "COR05", "#8a7a60"),
      c("Homerton Grey", "HOM06", "#898684"),
      c("Mahogany", "MAH07", "#745e48"),
      c("Marine Jade", "MAR08", "#364b49"),
      c("Meteorite", "MET09", "#a7a098", 1),
      c("Nigella", "NIG10", "#4f4b48"),
      c("Pebblestone", "PEB11", "#bab09e"),
      c("Rainstorm", "RAI12", "#7e7c7a"),
      c("Scarlet", "SCA13", "#4a090d"),
      c("Sea Breeze", "SEA14", "#bead95"),
      c("Smokestack", "SMO15", "#a79f93"),
      c("Thunder Cloud", "THU16", "#4e4e4e"),
      c("Tornado Blue", "TOR17", "#404649"),
    ],
  },
  {
    id: "cormar-carpets-hampstead", type: "carpets", brand: "Cormar Carpets",
    name: "Hampstead", code: "CC-H", real: true,
    photo: P("ranges/cormar-carpets-hampstead.jpg"), alt: "Hampstead carpet",
    blurb: "13 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Fossil", "FOS01", "#c2ae90", 1),
      c("Gunmetal", "GUN02", "#847d7e"),
      c("Italian", "ITA03", "#ad9c87"),
      c("Maize", "MAI04", "#b08f63"),
      c("Neptune", "NEP05", "#5f656b"),
      c("Pacific Pearl", "PAC06", "#c9b8a3"),
      c("Pole Star", "POL07", "#aeacaf"),
      c("Quartz", "QUA08", "#988c87"),
      c("Rice", "RIC09", "#c9b699"),
      c("Ridge Rock", "RID10", "#a09082"),
      c("Spirit Glow", "SPI11", "#bdb4a9"),
      c("Toffee", "TOF12", "#a68b6e"),
      c("White Pepper", "WHI13", "#b09e92"),
    ],
  },
  {
    id: "cormar-carpets-kingston", type: "carpets", brand: "Cormar Carpets",
    name: "Kingston", code: "CC-K", real: true,
    photo: P("ranges/cormar-carpets-kingston.jpg"), alt: "Kingston carpet",
    blurb: "11 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Classic Bay Light", "CLA01", "#b7a791"),
      c("Classic Caracal", "CLA02", "#ad9c83"),
      c("Classic Cedar", "CLA03", "#8d765d"),
      c("Classic Iron Ore", "CLA04", "#8c8780"),
      c("Classic Kernel", "CLA05", "#918270"),
      c("Classic Molasses", "CLA06", "#73685b"),
      c("Classic Mushroom", "CLA07", "#9a8f87"),
      c("Classic Pale Oak", "CLA08", "#988d7c"),
      c("Classic Silver Birch", "CLA09", "#8f8d8a"),
      c("Classic Skiddaw Slate", "CLA10", "#595554"),
      c("Classic Woodbrook", "CLA11", "#b3a796"),
    ],
  },
  {
    id: "cormar-carpets-linwood", type: "carpets", brand: "Cormar Carpets",
    name: "Linwood", code: "CC-L", real: true,
    photo: P("ranges/cormar-carpets-linwood.jpg"), alt: "Linwood carpet",
    blurb: "11 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Cappuccino", "CAP01", "#998979"),
      c("Fyfield Frost", "FYF02", "#807f80"),
      c("Glendale Granite", "GLE03", "#666563"),
      c("Irish Linen", "IRI04", "#b2afa5"),
      c("Juniper Grey", "JUN05", "#404348"),
      c("Langdale Slate", "LAN06", "#474546"),
      c("Midas Touch", "MID07", "#956e33"),
      c("Summer Meadow", "SUM08", "#a28461"),
      c("Supernova", "SUP09", "#bebdbc", 1),
      c("Teal", "TEA10", "#404c4c"),
      c("Walmersley Natural", "WAL11", "#75644e"),
    ],
  },
  {
    id: "cormar-carpets-malabar", type: "carpets", brand: "Cormar Carpets",
    name: "Malabar", code: "CC-M", real: true,
    photo: P("ranges/cormar-carpets-malabar.jpg"), alt: "Malabar carpet",
    blurb: "17 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Balm", "BAL01", "#c1af95"),
      c("Chinchilla", "CHI02", "#b7ac9e"),
      c("Cocoa", "COC03", "#a99983"),
      c("Cottonwood", "COT04", "#cbbca1"),
      c("Derby", "DER05", "#b5ab9b"),
      c("Dune", "DUN06", "#bda281"),
      c("Flagstone", "FLA07", "#b3a590"),
      c("Hardwick", "HAR08", "#9d9185"),
      c("Koala", "KOA09", "#9c876b"),
      c("Muesli", "MUE10", "#c8b99f"),
      c("Nubuck", "NUB11", "#baa78e"),
      c("Oatmeal", "OAT12", "#cfba9a"),
      c("Pinto", "PIN13", "#ad9c88"),
      c("Reed", "REE14", "#baa890"),
      c("Rhino", "RHI15", "#948a80"),
      c("Sahara", "SAH16", "#c5aa88"),
      c("Timber", "TIM17", "#96836b"),
    ],
  },
  {
    id: "cormar-carpets-pembroke", type: "carpets", brand: "Cormar Carpets",
    name: "Pembroke", code: "CC-P", real: true,
    photo: P("ranges/cormar-carpets-pembroke.jpg"), alt: "Pembroke carpet",
    blurb: "2 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Pembanvi", "PEM01", "#5b574c"),
      c("Pembkies", "PEM02", "#797471"),
    ],
  },
  {
    id: "cormar-carpets-primo-grande", type: "carpets", brand: "Cormar Carpets",
    name: "Primo Grande", code: "CC-PG", real: true,
    photo: P("ranges/cormar-carpets-primo-grande.jpg"), alt: "Primo Grande carpet",
    blurb: "9 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Alloy Grey", "ALL01", "#b1aca9"),
      c("Cerami", "CER02", "#cab89f"),
      c("Cloudy Bay", "CLO03", "#b4a18c", 1),
      c("Curlew", "CUR04", "#a98e78"),
      c("Merlin", "MER05", "#94908c"),
      c("Pearl River", "PEA06", "#b2a8a2"),
      c("Shadow", "SHA07", "#7f7a74"),
      c("Snow Drift", "SNO08", "#cfc7b7"),
      c("Welsh Slate", "WEL09", "#88878a"),
    ],
  },
  {
    id: "cormar-carpets-primo-tweeds", type: "carpets", brand: "Cormar Carpets",
    name: "Primo Tweeds", code: "CC-PT", real: true,
    photo: P("ranges/cormar-carpets-primo-tweeds.jpg"), alt: "Primo Tweeds carpet",
    blurb: "5 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Brownstone", "BRO01", "#7e664d"),
      c("Butterscotch", "BUT02", "#866639"),
      c("Moccasin", "MOC03", "#a99988"),
      c("New Moon", "NEW04", "#9c9a97"),
      c("Westwood Beige", "WES05", "#b49d84"),
    ],
  },
  {
    id: "cormar-carpets-primo-ultra", type: "carpets", brand: "Cormar Carpets",
    name: "Primo Ultra", code: "CC-PU", real: true,
    photo: P("ranges/cormar-carpets-primo-ultra.jpg"), alt: "Primo Ultra carpet",
    blurb: "2 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Peverell Pewter", "PEV01", "#8c8886"),
      c("Shadow", "SHA02", "#8a827c"),
    ],
  },
  {
    id: "cormar-carpets-trinity", type: "carpets", brand: "Cormar Carpets",
    name: "Trinity", code: "CC-T", real: true,
    photo: P("ranges/cormar-carpets-trinity.jpg"), alt: "Trinity carpet",
    blurb: "1 shades, measured from the Cormar Carpets swatch photographs.",
    colours: [
      c("Driftwood", "DRI01", "#90786a"),
    ],
  },
  {
    id: "hugh-mackay-aura", type: "carpets", brand: "Hugh Mackay",
    name: "Aura", code: "HM-A", real: true,
    photo: IMG.velvet, alt: "Aura carpet",
    blurb: "2 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Puddle Duck", "PUD01", "#a0babc"),
      c("Sand Dune", "SAN02", "#c1b199"),
    ],
  },
  {
    id: "hugh-mackay-easisisal", type: "carpets", brand: "Hugh Mackay",
    name: "EasiSisal", code: "HM-E", real: true,
    photo: P("swatches/hugh-mackay-easisisal/landscape.jpg"), alt: "EasiSisal sisal-effect wool carpet",
    blurb: "Hugh Mackay's sisal-effect wool range."
      + " We have the photography but not the shade names — Hugh Mackay named every"
      + " EasiSisal file after the shot rather than the colour, so ask in the showroom"
      + " and we will go through the book with you.",
    pending: true,
    colours: [],
  },
  {
    id: "hugh-mackay-first-impressions", type: "carpets", brand: "Hugh Mackay",
    name: "First Impressions", code: "HM-FI", real: true,
    photo: IMG.bedroom, alt: "First Impressions carpet",
    blurb: "6 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Humble", "HUM01", "#a3a3a2"),
      c("Humble P CMYK", "HUM02", "#909e99"),
      c("Welldressed", "WEL03", "#a7a7a7"),
      c("Welldressed C CMYK", "WEL04", "#92a2a0"),
      c("Welldressed C CMYK smaller", "WEL05", "#8e9c9a"),
      c("Welldressed L2 CMYK", "WEL06", "#a0afa9"),
    ],
  },
  {
    id: "hugh-mackay-freedom-freedom-xtra", type: "carpets", brand: "Hugh Mackay",
    name: "Freedom & Freedom Xtra", code: "HM-FAF", real: true,
    photo: IMG.stairs, alt: "Freedom & Freedom Xtra carpet",
    blurb: "2 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Doeskin", "DOE01", "#b5ab98"),
      c("Skyline", "SKY02", "#8c96aa"),
    ],
  },
  {
    id: "hugh-mackay-grace", type: "carpets", brand: "Hugh Mackay",
    name: "Grace", code: "HM-G", real: true,
    photo: IMG.pile, alt: "Grace carpet",
    blurb: "2 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Cherish", "CHE01", "#c6bba9"),
      c("Shimmer", "SHI02", "#b6b0af"),
    ],
  },
  {
    id: "hugh-mackay-heartland-heathers", type: "carpets", brand: "Hugh Mackay",
    name: "Heartland Heathers", code: "HM-HH", real: true,
    photo: IMG.velvet, alt: "Heartland Heathers carpet",
    blurb: "1 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Sahara", "SAH01", "#948d8e"),
    ],
  },
  {
    id: "hugh-mackay-heartland", type: "carpets", brand: "Hugh Mackay",
    name: "Heartland", code: "HM-H", real: true,
    photo: IMG.hero, alt: "Heartland carpet",
    blurb: "1 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Rubery", "RUB01", "#afab9b"),
    ],
  },
  {
    id: "hugh-mackay-natural-impressions", type: "carpets", brand: "Hugh Mackay",
    name: "Natural Impressions", code: "HM-NI", real: true,
    photo: IMG.bedroom, alt: "Natural Impressions carpet",
    blurb: "11 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Azure Breeze", "AZU01", "#7f7d76"),
      c("Dew Drop", "DEW02", "#7d7267"),
      c("Fresh Fern", "FRE03", "#81796b"),
      c("Golden Husk", "GOL04", "#b7b19d"),
      c("Harvest Moon", "HAR05", "#8f7f73"),
      c("Mid Summer", "MID06", "#b9ab9b"),
      c("Misty Morn", "MIS07", "#7a6d64"),
      c("Solar Shift", "SOL08", "#403834"),
      c("Solstice", "SOL09", "#928d89"),
      c("Sunlit Sand", "SUN10", "#a59b8d"),
      c("Victoria Natural Impressions Dew Drop", "VIC11", "#8c878b"),
    ],
  },
  {
    id: "hugh-mackay-pioneer", type: "carpets", brand: "Hugh Mackay",
    name: "Pioneer", code: "HM-P", real: true,
    photo: IMG.stairs, alt: "Pioneer carpet",
    blurb: "1 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Charming", "CHA01", "#afaaa5"),
    ],
  },
  {
    id: "hugh-mackay-ultimate-impressions", type: "carpets", brand: "Hugh Mackay",
    name: "Ultimate Impressions", code: "HM-UI", real: true,
    photo: IMG.pile, alt: "Ultimate Impressions carpet",
    blurb: "5 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Ultimate Impressions Refined", "ULT01", "#b0afaf"),
      c("Ultimate Impressions Refined C CMYK", "ULT02", "#a1afae"),
      c("Ultimate Impressions Refined L1 CMYK", "ULT03", "#aebebd"),
      c("Ultimate Impressions Refined L2 RS200pc CMYK", "ULT04", "#a8b8ba"),
      c("Ultimate Impressions Refined Landscape Treehouse", "ULT05", "#abacad"),
    ],
  },
  {
    id: "hugh-mackay-ultimate-expressions", type: "carpets", brand: "Hugh Mackay",
    name: "Ultimate Expressions", code: "HM-UE", real: true,
    photo: IMG.velvet, alt: "Ultimate Expressions carpet",
    blurb: "4 shades, measured from the Hugh Mackay swatch photographs.",
    colours: [
      c("Antique Rose", "ANT01", "#ad949d"),
      c("Sage", "SAG02", "#aab2b5"),
      c("Sage C CMYK", "SAG03", "#98b7b4"),
      c("Sage L1 CMYK", "SAG04", "#9cb5b2"),
    ],
  },
  {
    id: "victoria-carpets-engineered-wood-14-3-herringbone", type: "wood", brand: "Victoria Carpets",
    name: "Engineered Wood 14-3 Herringbone", code: "VC-1H", real: true,
    photo: IMG.hero, alt: "Engineered Wood 14-3 Herringbone flooring",
    blurb: "1 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Calico", "CAL01", "#b68d5a", "14-3-herringbone-calico-render"),
      v("Chic", "CHI02", "#b48657", "chic"),
      v("Worn", "WOR03", "#ac8f66", "engineered-wood-14-3-herringbone-worn"),
    ],
  },
  {
    id: "victoria-carpets-engineered-wood-14-3-plank", type: "wood", brand: "Victoria Carpets",
    name: "Engineered Wood 14-3 Plank", code: "VC-1P", real: true,
    photo: IMG.bedroom, alt: "Engineered Wood 14-3 Plank flooring",
    blurb: "2 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Calico", "CAL01", "#c29963", "engineered-wood-14-3-plank-calico"),
      v("Chic", "CHI02", "#9f7442", "chic", "engineered-wood-14-3-plank-chi"),
      v("Ghost", "GHO03", "#cfaf8e", "ghost-handscaped", "engineered-wood-14-3-plank-ghost"),
    ],
  },
  {
    id: "victoria-carpets-engineered-wood-18-4-plank", type: "wood", brand: "Victoria Carpets",
    name: "Engineered Wood 18-4 Plank", code: "VC-1P", real: true,
    photo: IMG.stairs, alt: "Engineered Wood 18-4 Plank flooring",
    blurb: "2 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Barn Oak", "BAR01", "#684f39", "barn-oak", "engineered-wood-18-4-barn-oak"),
      v("Brushed Oiled Oak", "BRU02", "#d4b28e", "brushed-oiled-oak-plank", "engineered-wood-18-4-brushed-and-oiled-oak"),
      v("Buff Oak", "BUF03", "#c3966d", "buff-oak", "engineered-wood-18-4-buff-oak"),
    ],
  },
  {
    id: "victoria-carpets-universal-fishbone", type: "lvt", brand: "Victoria Carpets",
    name: "Universal Fishbone", code: "VC-F", real: true,
    photo: IMG.pile, alt: "Universal Fishbone luxury vinyl tile flooring",
    blurb: "1 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Alpine", "ALP01", "#b99a75", "universal-design-fishbone-alpine"),
      v("Fireside", "FIR02", "#a19276", "universal-design-fishbone-fireside"),
      v("Hardwick", "HAR03", "#bfa477", "universal-design-fishbone-hardwick"),
      v("Nordmann", "NOR04", "#b8a07e", "universal-design-fishbone-nordmann"),
    ],
  },
  {
    id: "victoria-carpets-universal-parquet", type: "lvt", brand: "Victoria Carpets",
    name: "Universal Parquet", code: "VC-P", real: true,
    photo: IMG.velvet, alt: "Universal Parquet luxury vinyl tile flooring",
    blurb: "1 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Alder", "ALD01", "#90897a", "universal-design-parquet-alder"),
      v("Aspen", "ASP02", "#b49669", "universal-design-parquet-aspen"),
      v("Mountain Birch", "MOU03", "#9a9087", "universal-design-parquet-mountain-birch"),
      v("Rowan", "ROW04", "#75644b", "universal-design-parquet-rowan"),
    ],
  },
  {
    id: "victoria-carpets-universal-plank", type: "lvt", brand: "Victoria Carpets",
    name: "Universal Plank", code: "VC-P", real: true,
    photo: IMG.hero, alt: "Universal Plank luxury vinyl tile flooring",
    blurb: "1 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Almond Buff", "ALM01", "#9f8e5c", "universal-plank-almond-buff"),
      v("Alpine", "ALP02", "#a39279", "universal-design-plank-alpine"),
      v("Angora", "ANG03", "#bdb49e", "universal-design-plank-angora"),
      v("Cashew", "CAS04", "#ad9a7e", "universal-plank-cashew"),
      v("Chalet", "CHA05", "#968c77", "universal-design-plank-chalet"),
      v("Chateau Grey", "CHA06", "#a6a49f", "universal-plank-chateau-grey"),
      v("Fawn", "FAW07", "#a7977e", "universal-plank-fawn"),
      v("Fireside", "FIR08", "#ada6a3", "universal-design-plank-fireside"),
      v("Flint Grey", "FLI09", "#98928b", "universal-plank-flint-grey"),
      v("Grouse", "GRO10", "#907e64", "universal-design-plank-grouse"),
      v("Hardwick", "HAR11", "#c2ab82", "universal-design-plank-hardwick"),
      v("Haybale", "HAY12", "#a19177", "universal-plank-haybale"),
      v("Latte", "LAT13", "#888a68", "universal-plank-latte"),
      v("Nimbus Cloud", "NIM14", "#c1b8aa", "universal-plank-nimbus-cloud"),
      v("Nordmann", "NOR15", "#d1b697", "universal-design-plank-nordmann"),
      v("Puddle", "PUD16", "#928b80", "universal-plank-puddle"),
      v("Saxon", "SAX17", "#958971", "universal-design-plank-saxon"),
      v("Sesame", "SES18", "#a6a68b", "universal-plank-sesame"),
      v("Smoke", "SMO19", "#a48d71", "universal-plank-smoke"),
      v("Wenge", "WEN20", "#93836e", "universal-plank-wenge"),
    ],
  },
  {
    id: "victoria-carpets-universal-stone", type: "lvt", brand: "Victoria Carpets",
    name: "Universal Stone", code: "VC-S", real: true,
    photo: IMG.bedroom, alt: "Universal Stone luxury vinyl tile flooring",
    blurb: "1 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Alabaster", "ALA01", "#cac4b4", "universal-tile-alabaster"),
      v("Fossil", "FOS02", "#b2b2ac", "universal-tile-fossil"),
      v("Raven", "RAV03", "#4b4c48", "universal-tile-raven"),
      v("Seashell", "SEA04", "#c8c5c0", "universal-tile-seashell"),
    ],
  },
  {
    id: "victoria-carpets-universal-herringbone", type: "lvt", brand: "Victoria Carpets",
    name: "Universal Herringbone", code: "VC-H", real: true,
    photo: IMG.stairs, alt: "Universal Herringbone luxury vinyl tile flooring",
    blurb: "1 shades. Colours read from Victoria Carpets roomset photography, so treat them as a guide until the swatch book is in.",
    colours: [
      v("Almond Buff", "ALM01", "#b8956e", "universal-herringbone-almond-buff"),
      v("Fawn", "FAW02", "#c7c1b5", "universal-herringbone-fawn"),
      v("Flint Grey", "FLI03", "#898179", "universal-herringbone-flint-grey"),
      v("Haybale", "HAY04", "#bca68e", "universal-herringbone-haybale"),
      v("Latte", "LAT05", "#826e5d", "universal-herringbone-latte"),
      v("Nimbus Cloud", "NIM06", "#bbb4a7", "universal-herringbone-nimbus-cloud"),
      v("Sesame", "SES07", "#9a7f62", "universal-herringbone-sesame"),
      v("Smoke", "SMO08", "#b49f86", "universal-herringbone-smoke"),
    ],
  },
  {
    id: "westex-barrington", type: "carpets", brand: "Westex",
    name: "Barrington", code: "W-B", real: true,
    photo: IMG.velvet, alt: "Barrington carpet",
    blurb: "12 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Cobble", "COB01", "#919697"),
      c("Corn", "COR02", "#9e8461"),
      c("Diamond Dove", "DIA03", "#a9aeaa"),
      c("Flint Grey", "FLI04", "#a0aaab"),
      c("Frappe", "FRA05", "#969794"),
      c("Furrow", "FUR06", "#72787e"),
      c("Hardwick", "HAR07", "#b0afaa"),
      c("Sandcastle", "SAN08", "#d3cfc5"),
      c("Sea Fret", "SEA09", "#c5c6c3"),
      c("Soya", "SOY10", "#c5b69a"),
      c("Stucco", "STU11", "#b2b4ac"),
      c("Thatch", "THA12", "#c7c4b3"),
    ],
  },
  {
    id: "westex-boucle", type: "carpets", brand: "Westex",
    name: "Boucle", code: "W-B", real: true,
    photo: IMG.hero, alt: "Boucle carpet",
    blurb: "20 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Chrome", "CHR01", "#717479"),
      c("Cobble", "COB02", "#9c9d98"),
      c("Coffee Cream", "COF03", "#b3a89a"),
      c("Cord", "COR04", "#d6ccbd"),
      c("Corn", "COR05", "#ae9778"),
      c("Flax", "FLA06", "#d2c9bd"),
      c("Furrow", "FUR07", "#868f94"),
      c("Hardwick", "HAR08", "#bcb8b1"),
      c("Honeycomb", "HON09", "#aeada8"),
      c("Maple", "MAP10", "#a19484"),
      c("Nordi", "NOR11", "#979e98"),
      c("Pewter", "PEW12", "#a9a8a2"),
      c("Rum Raisin", "RUM13", "#85726c"),
      c("Rusti", "RUS14", "#b1a89a"),
      c("Sandcastle", "SAN15", "#d6d1c3"),
      c("Shingle", "SHI16", "#9e9f9e"),
      c("Soya", "SOY17", "#cbbfa9"),
      c("Stucco", "STU18", "#b7b3aa"),
      c("Tallow", "TAL19", "#afb4b0"),
      c("Thatch", "THA20", "#d1c9bd"),
    ],
  },
  {
    id: "westex-briar", type: "carpets", brand: "Westex",
    name: "Briar", code: "W-B", real: true,
    photo: IMG.bedroom, alt: "Briar carpet",
    blurb: "20 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Chrome", "CHR01", "#6a6e72"),
      c("Cobble", "COB02", "#9e9f9a"),
      c("Coffee Cream", "COF03", "#bdb5aa"),
      c("Cord", "COR04", "#d9cebe"),
      c("Corn", "COR05", "#ab9475"),
      c("Flax", "FLA06", "#d4ccc0"),
      c("Furrow", "FUR07", "#838c90"),
      c("Hardwick", "HAR08", "#c0bbb3"),
      c("Honeycomb", "HON09", "#b3b2ac"),
      c("Maple", "MAP10", "#a09282"),
      c("Nordi", "NOR11", "#969e9c"),
      c("Pewter", "PEW12", "#a5a39c"),
      c("Rum Raisin", "RUM13", "#917e77"),
      c("Rusti", "RUS14", "#c0baaa"),
      c("Sandcastle", "SAN15", "#d6d1c3"),
      c("Shingle", "SHI16", "#acaca7"),
      c("Soya", "SOY17", "#c5b9a2"),
      c("Stucco", "STU18", "#b5b2a6"),
      c("Tallow", "TAL19", "#acafa7"),
      c("Thatch", "THA20", "#cfc8ba"),
    ],
  },
  {
    id: "westex-cable", type: "carpets", brand: "Westex",
    name: "Cable", code: "W-C", real: true,
    photo: IMG.stairs, alt: "Cable carpet",
    blurb: "20 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Chrome", "CHR01", "#6f7174"),
      c("Cobble", "COB02", "#979691"),
      c("Coffee Cream", "COF03", "#aaa194"),
      c("Cord", "COR04", "#cec4b4"),
      c("Corn", "COR05", "#a99374"),
      c("Flax", "FLA06", "#d2c9bd"),
      c("Furrow", "FUR07", "#868f94"),
      c("Hardwick", "HAR08", "#bcb7af"),
      c("Honeycomb", "HON09", "#aeaca7"),
      c("Maple", "MAP10", "#9a8b7c"),
      c("Nordi", "NOR11", "#969e9b"),
      c("Pewter", "PEW12", "#a8a8a2"),
      c("Rum Raisin", "RUM13", "#7c6864"),
      c("Rusti", "RUS14", "#b1a79a"),
      c("Sandcastle", "SAN15", "#d7d2c6"),
      c("Shingle", "SHI16", "#999b99"),
      c("Soya", "SOY17", "#c5baa5"),
      c("Stucco", "STU18", "#b7b4aa"),
      c("Tallow", "TAL19", "#acaea7"),
      c("Thatch", "THA20", "#d2c9bc"),
    ],
  },
  {
    id: "westex-elysian", type: "carpets", brand: "Westex",
    name: "Elysian", code: "W-E", real: true,
    photo: IMG.pile, alt: "Elysian carpet",
    blurb: "15 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Abalone", "ABA01", "#b4b5a8"),
      c("Canvas", "CAN02", "#a9a9a2"),
      c("Ice", "ICE03", "#aaaeb1"),
      c("Kobicha", "KOB04", "#838176"),
      c("Macademia", "MAC05", "#86867d"),
      c("Meadow Mist", "MEA06", "#a09e94"),
      c("Mink", "MIN07", "#8c8886"),
      c("Mossy", "MOS08", "#75766b"),
      c("Pearl", "PEA09", "#9da2a1"),
      c("Pecan", "PEC10", "#74706e"),
      c("Porpoise", "POR11", "#595e63"),
      c("Seaweed", "SEA12", "#66675c"),
      c("Soft Pencil", "SOF13", "#8f939b"),
      c("Travertine", "TRA14", "#9b9786"),
      c("Wolf", "WOL15", "#4e4d4c"),
    ],
  },
  {
    id: "westex-fine-westex-twist", type: "carpets", brand: "Westex",
    name: "Fine Westex Twist", code: "W-FWT", real: true,
    photo: IMG.velvet, alt: "Fine Westex Twist carpet",
    blurb: "38 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Bayton Birch", "BAY01", "#91908a"),
      c("Belbroughton Blue", "BEL02", "#071c37"),
      c("Blakebrook Bamboo", "BLA03", "#999789"),
      c("Bransford Biscuit", "BRA04", "#a28d74"),
      c("Charford Clay", "CHA05", "#847a70"),
      c("Charlton Catkin", "CHA06", "#7b8677"),
      c("Churchill Champagne", "CHU07", "#aba7a7"),
      c("Clifton Celadon", "CLI08", "#3c5e5a"),
      c("Comberton Cream", "COM09", "#bdae9c"),
      c("Cooksey Calico", "COO10", "#b2a88a"),
      c("Cowleigh Cane", "COW11", "#988a6d"),
      c("Crofton Cloud", "CRO12", "#adaba5"),
      c("Cropthorne Cypress", "CRO13", "#072a1f"),
      c("Draycott Dawn", "DRA14", "#a49c99"),
      c("Elmbridge Ecru", "ELM15", "#a39d92"),
      c("Fernhill Fleece", "FER16", "#9c9382"),
      c("Flyford Flax", "FLY17", "#847967"),
      c("Grafton Gold", "GRA18", "#a08c64"),
      c("Greystone Glitter", "GRE19", "#787783"),
      c("Hopwood Hemp", "HOP20", "#aba37d"),
      c("Inkford Inox", "INK21", "#868a93"),
      c("Larford Linen", "LAR22", "#8e8455"),
      c("Longdon Lace", "LON23", "#9f948a"),
      c("Mayfield Maize", "MAY24", "#827a57"),
      c("Mitton Mouse", "MIT25", "#6c6660"),
      c("Monkwood Moss", "MON26", "#757a5b"),
      c("Moorcroft Marble", "MOO27", "#76736f"),
      c("Netherton Natural", "NET28", "#8e8788"),
      c("Newland Nectar", "NEW29", "#928177"),
      c("Ombersley Olive", "OMB30", "#4e5239"),
      c("Pedmore Pearl", "PED31", "#87848b"),
      c("Pershore Plum", "PER32", "#411721"),
      c("Roseberry Red", "ROS33", "#3e0f19"),
      c("Stoulton", "STO34", "#83766d"),
      c("Tutnal Tin", "TUT35", "#5f5e61"),
      c("Warndon Water", "WAR36", "#5d797c"),
      c("Wilden Wicker", "WIL37", "#a09680"),
      c("Wolverley Willow", "WOL38", "#708175"),
    ],
  },
  {
    id: "westex-fired-earth-derwent", type: "carpets", brand: "Westex",
    name: "Fired Earth Derwent", code: "W-D", real: true,
    photo: IMG.hero, alt: "Fired Earth Derwent carpet",
    blurb: "12 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Baslow", "BAS01", "#999692"),
      c("Chatsworth", "CHA02", "#888b90"),
      c("Cromford", "CRO03", "#989491"),
      c("Curbar", "CUR04", "#aa9e8d"),
      c("Grindleford", "GRI05", "#b1aba4"),
      c("Hathersage", "HAT06", "#8c7e67"),
      c("Matlock", "MAT07", "#8a8a87"),
      c("Northwood", "NOR08", "#8b9496"),
      c("Rowsley", "ROW09", "#616368"),
      c("Snitterton", "SNI10", "#97958f"),
      c("Stanton", "STA11", "#a8a6a7"),
      c("Starkholmes", "STA12", "#878382"),
    ],
  },
  {
    id: "westex-fired-earth-hebble", type: "carpets", brand: "Westex",
    name: "Fired Earth Hebble", code: "W-H", real: true,
    photo: IMG.bedroom, alt: "Fired Earth Hebble carpet",
    blurb: "18 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Canvas", "CAN01", "#a9a89d"),
      c("China Clay", "CHI02", "#9d9c93"),
      c("Dartmouth Green", "DAR03", "#465051"),
      c("Flake White", "FLA04", "#b4b5b5"),
      c("Garden Folly", "GAR05", "#94989b"),
      c("Goldfinch", "GOL06", "#a79268"),
      c("Granite", "GRA07", "#8c9594"),
      c("Malm", "MAL08", "#a2a2a3"),
      c("Manna Ash", "MAN09", "#a19c9e"),
      c("Masilla", "MAS10", "#9e999d"),
      c("Modernist White", "MOD11", "#a4a6a8"),
      c("Oyster", "OYS12", "#bcbaac"),
      c("Pearl Ashes", "PEA13", "#9ba8b2"),
      c("Smoke Blue", "SMO14", "#859aa7"),
      c("Tempest", "TEM15", "#2f3b4d"),
      c("Tundra", "TUN16", "#787b71"),
      c("Ultramarine Ashes", "ULT17", "#7c8c8e"),
      c("White Ochre", "WHI18", "#a6a393"),
    ],
  },
  {
    id: "westex-fired-earth-loxley-loop", type: "carpets", brand: "Westex",
    name: "Fired Earth Loxley Loop", code: "W-LL", real: true,
    photo: IMG.stairs, alt: "Fired Earth Loxley Loop carpet",
    blurb: "18 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Canvas", "CAN01", "#a8a9a1"),
      c("China Clay", "CHI02", "#7f8175"),
      c("Dartmouth Green", "DAR03", "#47514c"),
      c("Flake White", "FLA04", "#a1a296"),
      c("Garden Folly", "GAR05", "#828384"),
      c("Goldfinch", "GOL06", "#998558"),
      c("Granite", "GRA07", "#7d8583"),
      c("Malm", "MAL08", "#949493"),
      c("Manna Ash", "MAN09", "#a29c9f"),
      c("Masilla", "MAS10", "#928e92"),
      c("Modernist White", "MOD11", "#9ca09f"),
      c("Oyster", "OYS12", "#b2b0a3"),
      c("Pearl Ashes", "PEA13", "#a1a4a8"),
      c("Smoke Blue", "SMO14", "#7e8e93"),
      c("Tempest", "TEM15", "#3a424c"),
      c("Tundra", "TUN16", "#777a72"),
      c("Ultramarine Ashes", "ULT17", "#6b7a77"),
      c("White Ochre", "WHI18", "#939385"),
    ],
  },
  {
    id: "westex-fired-earth-wharfe", type: "carpets", brand: "Westex",
    name: "Fired Earth Wharfe", code: "W-W", real: true,
    photo: IMG.pile, alt: "Fired Earth Wharfe carpet",
    blurb: "12 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Castley", "CAS01", "#9c8f77"),
      c("Collingham", "COL02", "#878186"),
      c("Dukeswick", "DUK03", "#99999b"),
      c("Kirkby Wharf", "KIR04", "#91989a"),
      c("Knotford Lagoon", "KNO05", "#a5a19b"),
      c("Leathley", "LEA06", "#8c8a88"),
      c("Netherby", "NET07", "#858489"),
      c("Nun Appleton", "NUN08", "#84878e"),
      c("Otley", "OTL09", "#95856d"),
      c("Ryther", "RYT10", "#959298"),
      c("Ulleskelf", "ULL11", "#63646e"),
      c("Weatherby", "WEA12", "#939392"),
    ],
  },
  {
    id: "westex-fired-earth-wiske-velvet", type: "carpets", brand: "Westex",
    name: "Fired Earth Wiske Velvet", code: "W-WV", real: true,
    photo: IMG.velvet, alt: "Fired Earth Wiske Velvet carpet",
    blurb: "18 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Canvas", "CAN01", "#a9aaa0"),
      c("China Clay", "CHI02", "#8a8c81"),
      c("Dartmouth Green", "DAR03", "#57625d"),
      c("Flake White", "FLA04", "#c2c1bc"),
      c("Garden Folly", "GAR05", "#939798"),
      c("Goldfinch", "GOL06", "#a79260"),
      c("Granite", "GRA07", "#8f9493"),
      c("Malm", "MAL08", "#a09fa2"),
      c("Manna Ash", "MAN09", "#a9a2a5"),
      c("Masilla", "MAS10", "#a9a4a8"),
      c("Modernist White", "MOD11", "#a3a7a6"),
      c("Oyster", "OYS12", "#bab7ae"),
      c("Pearl Ashes", "PEA13", "#a9b0b1"),
      c("Smoke Blue", "SMO14", "#8d9fad"),
      c("Tempest", "TEM15", "#363f4c"),
      c("Tundra", "TUN16", "#818078"),
      c("Ultramarine Ashes", "ULT17", "#81928f"),
      c("White Ochre", "WHI18", "#a6a394"),
    ],
  },
  {
    id: "westex-pure-luxury", type: "carpets", brand: "Westex",
    name: "Pure Luxury", code: "W-PL", real: true,
    photo: IMG.hero, alt: "Pure Luxury carpet",
    blurb: "72 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Bliss Bistre", "BLI01", "#e0daca"),
      c("Bliss Charleston Grey", "BLI02", "#d2cdbd"),
      c("Bliss Cheviot", "BLI03", "#d3d1c6"),
      c("Bliss Deer", "BLI04", "#c2b89b"),
      c("Bliss Floss", "BLI05", "#d5ccb0"),
      c("Bliss Gardenia", "BLI06", "#e9dbc4"),
      c("Bliss Palladium", "BLI07", "#86887f"),
      c("Bliss Pearl", "BLI08", "#c9cbc2"),
      c("Bliss Pine Marten", "BLI09", "#efe1c2"),
      c("Bliss Portabella", "BLI10", "#c4baa4"),
      c("Bliss Stratus", "BLI11", "#d6cfca"),
      c("Bliss Sweetbay", "BLI12", "#e3d4b9"),
      c("Grandeur Buttercup", "GRA13", "#ccc4a6"),
      c("Grandeur Button", "GRA14", "#c9c1aa"),
      c("Grandeur Cirrus", "GRA15", "#c1c1ba"),
      c("Grandeur Dunes", "GRA16", "#dbd7c8"),
      c("Grandeur Merino", "GRA17", "#d4d1c3"),
      c("Grandeur Pinon", "GRA18", "#b0aa94"),
      c("Grandeur Rhodium", "GRA19", "#73766c"),
      c("Grandeur Star", "GRA20", "#d1c4a7"),
      c("Grandeur Sterling", "GRA21", "#b7b9ad"),
      c("Grandeur Stoat", "GRA22", "#d3cdb9"),
      c("Grandeur Tephra Grey", "GRA23", "#bfbca5"),
      c("Grandeur Tusk", "GRA24", "#e2d5be"),
      c("Ivory", "IVO25", "#e8d6b6"),
      c("Magnolia", "MAG26", "#e6d3ae"),
      c("Manor Grey", "MAN27", "#c6c3b3"),
      c("Marshmallow", "MAR28", "#d4c8a5"),
      c("Mushroom", "MUS29", "#d5ceb7"),
      c("Oppulence Cloud", "OPP30", "#bebfb7"),
      c("Oppulence Dormouse", "OPP31", "#a59f88"),
      c("Oppulence Erimine", "OPP32", "#ded5b2"),
      c("Oppulence Ivory", "OPP33", "#e5d7bc"),
      c("Oppulence Magnolia", "OPP34", "#c7bb9c"),
      c("Oppulence Manor Grey", "OPP35", "#c9c6b4"),
      c("Oppulence Marshmallow", "OPP36", "#c6bd99"),
      c("Oppulence Mushroom", "OPP37", "#c2bdab"),
      c("Oppulence Pebble", "OPP38", "#b0b2a5"),
      c("Oppulence Platinum", "OPP39", "#6b6c65"),
      c("Oppulence Sandcastle", "OPP40", "#e3dcc7"),
      c("Oppulence Sheepskin", "OPP41", "#d7d4c6"),
      c("Pebble", "PEB42", "#cccdc3"),
      c("Platinum", "PLA43", "#939387"),
      c("Sandcastle", "SAN44", "#e1dcce"),
      c("Sheepskin", "SHE45", "#dcd8c9"),
      c("Splendour Cumulus", "SPL46", "#c8c6c1"),
      c("Splendour Daisy", "SPL47", "#dfd2ba"),
      c("Splendour Dessert", "SPL48", "#d0c49a"),
      c("Splendour Earl Grey", "SPL49", "#c9c6b6"),
      c("Splendour Gainsboro", "SPL50", "#b7bab0"),
      c("Splendour Maitake", "SPL51", "#d2c4a6"),
      c("Splendour Naples Yellow", "SPL52", "#d3cec2"),
      c("Splendour Osmium", "SPL53", "#8f9089"),
      c("Splendour Polecat", "SPL54", "#e5dbbf"),
      c("Splendour Shrew", "SPL55", "#b8af95"),
      c("Splendour Southdown", "SPL56", "#d4ccba"),
      c("Splendour Yulan", "SPL57", "#d6c8a7"),
      c("Sumptious Cloud", "SUM58", "#d5d3c9"),
      c("Sumptious Dormouse", "SUM59", "#c1baa0"),
      c("Sumptious Ermine", "SUM60", "#eee0bc"),
      c("Troika Cloud", "TRO61", "#c1c2b9"),
      c("Troika Dormouse", "TRO62", "#b6b092"),
      c("Troika Ermine", "TRO63", "#e4d7b4"),
      c("Troika ivory", "TRO64", "#ebdcc1"),
      c("Troika Magnolia", "TRO65", "#d6c7a6"),
      c("Troika Manor Grey", "TRO66", "#c3c0aa"),
      c("Troika Marshmallow", "TRO67", "#c8bc98"),
      c("Troika Mushroom", "TRO68", "#c1bca4"),
      c("Troika Pebble", "TRO69", "#afb0a2"),
      c("Troika Platinum", "TRO70", "#606158"),
      c("Troika Sandcastle", "TRO71", "#e6dcc7"),
      c("Troika Sheepskin", "TRO72", "#cfcdba"),
    ],
  },
  {
    id: "westex-silken", type: "carpets", brand: "Westex",
    name: "Silken", code: "W-S", real: true,
    photo: IMG.bedroom, alt: "Silken carpet",
    blurb: "24 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Alloy", "ALL01", "#979c95"),
      c("Alpaca", "ALP02", "#b8b8b3"),
      c("Ammolite", "AMM03", "#ccc7b5"),
      c("Aniseed", "ANI04", "#7e7459"),
      c("Blonde", "BLO05", "#d7cab1"),
      c("Calcite", "CAL06", "#bbc1b8"),
      c("Camel", "CAM07", "#cab58a"),
      c("Cashmere", "CAS08", "#beb798"),
      c("Charm", "CHA09", "#d1ccba"),
      c("Ecru", "ECR10", "#b4b19f"),
      c("Frost", "FRO11", "#d6d7c8"),
      c("Glacier", "GLA12", "#d0d6d1"),
      c("Graphite", "GRA13", "#424543"),
      c("Hurricane", "HUR14", "#bcc4be"),
      c("Liquorice", "LIQ15", "#0f1113"),
      c("Mica", "MIC16", "#a3a39d"),
      c("Moonstone", "MOO17", "#bbc4bd"),
      c("Pumice", "PUM18", "#daddd4"),
      c("Smoulder", "SMO19", "#acab9b"),
      c("Stormy Sky", "STO20", "#4e6569"),
      c("Tabby Grey", "TAB21", "#808882"),
      c("Turtledove", "TUR22", "#bbb2a1"),
      c("Urban", "URB23", "#c1c8c8"),
      c("Warm", "WAR24", "#a89d8d"),
    ],
  },
  {
    id: "westex-ultima", type: "carpets", brand: "Westex",
    name: "Ultima", code: "W-U", real: true,
    photo: IMG.stairs, alt: "Ultima carpet",
    blurb: "119 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Alabaster", "ALA01", "#bda88c"),
      c("Almond", "ALM02", "#c3a287"),
      c("Aloe", "ALO03", "#8b8579"),
      c("Amazon", "AMA04", "#0a282d"),
      c("Angelica", "ANG05", "#073e30"),
      c("Anthracite", "ANT06", "#4e4d50"),
      c("Antique Gold", "ANT07", "#a36f2a"),
      c("Aquamarine", "AQU08", "#819ea4"),
      c("Ash", "ASH09", "#898781"),
      c("Aston Pink", "AST10", "#b55f6f"),
      c("Aubergine", "AUB11", "#351526"),
      c("Autumn Dawn", "AUT12", "#b1946f"),
      c("Azure", "AZU13", "#24516c"),
      c("Bark", "BAR14", "#a38f89"),
      c("Bayleaf", "BAY15", "#878f71"),
      c("Biscuit", "BIS16", "#b6aba2"),
      c("Black", "BLA17", "#100e0f"),
      c("Bluebird", "BLU18", "#647fa9"),
      c("Bonsai", "BON19", "#468b78"),
      c("Bottle Green", "BOT20", "#35351a"),
      c("Bracken", "BRA21", "#b4987e"),
      c("Brandysnap", "BRA22", "#b79472"),
      c("Broom", "BRO23", "#536550"),
      c("Buff", "BUF24", "#c0976c"),
      c("Burnt Oak", "BUR25", "#796f6d"),
      c("Burnt Orange", "BUR26", "#6f2716"),
      c("Celeria", "CEL27", "#bfb093"),
      c("Chalk", "CHA28", "#d8d1cc"),
      c("Chestnut", "CHE29", "#918b7b"),
      c("Chicory", "CHI30", "#ae9d8e"),
      c("Cinnamon", "CIN31", "#836955"),
      c("Claret", "CLA32", "#381220"),
      c("Classic Red", "CLA33", "#630e15"),
      c("Clover", "CLO34", "#676651"),
      c("Cobalt", "COB35", "#88a8bd"),
      c("Cocoa", "COC36", "#817c76"),
      c("Cookie Mix", "COO37", "#ccbba2"),
      c("Cornsilk", "COR38", "#c09e71"),
      c("Cream", "CRE39", "#ccbd95"),
      c("Croft Green", "CRO40", "#909f85"),
      c("Dark Slate", "DAR41", "#9d9d94"),
      c("Dijon", "DIJ42", "#ccac7a"),
      c("Dogwood", "DOG43", "#833341"),
      c("Dove Grey", "DOV44", "#847e8e"),
      c("Driftwood", "DRI45", "#b6a698"),
      c("Duck Egg", "DUC46", "#b3c0c8"),
      c("Eau De Nil", "EAU47", "#7d9989"),
      c("Ebony", "EBO48", "#707671"),
      c("Eucalyptus", "EUC49", "#927a4d"),
      c("Fennel Blue", "FEN50", "#07214d"),
      c("Fleece", "FLE51", "#ccc3ba"),
      c("Fossil", "FOS52", "#625d52"),
      c("Gentian", "GEN53", "#023f7e"),
      c("Grain", "GRA54", "#dccbb2"),
      c("Granite", "GRA55", "#3e3e3d"),
      c("Gull", "GUL56", "#878984"),
      c("Gypsum", "GYP57", "#cfc3ad"),
      c("Hebe", "HEB58", "#91a484"),
      c("Hessian", "HES59", "#b9a98d"),
      c("Highland Heather", "HIG60", "#a26e56"),
      c("Honey", "HON61", "#c0a280"),
      c("Hopsack", "HOP62", "#b9a588"),
      c("Ink", "INK63", "#175b7a"),
      c("Jasper", "JAS64", "#9a761f"),
      c("Kalahari", "KAL65", "#b8a791"),
      c("Kingfisher", "KIN66", "#156f77"),
      c("Koi", "KOI67", "#a05047"),
      c("Laurel", "LAU68", "#134a4a"),
      c("Limestone", "LIM69", "#d6ccc5"),
      c("Maize", "MAI70", "#d4cbaf"),
      c("Malachite", "MAL71", "#4a6963"),
      c("Malt", "MAL72", "#aba29f"),
      c("Mercury", "MER73", "#bab7ba"),
      c("Metropolitan", "MET74", "#86858a"),
      c("Mistletoe", "MIS75", "#6f7e56"),
      c("Mocha", "MOC76", "#88402e"),
      c("Mortar", "MOR77", "#d2cdc6"),
      c("Nectar", "NEC78", "#d1b173"),
      c("Nightfall", "NIG79", "#10172e"),
      c("Nutmeg", "NUT80", "#cfbdae"),
      c("Oasis Green", "OAS81", "#82897e"),
      c("Oatmeal", "OAT82", "#ded2be"),
      c("Ochre", "OCH83", "#d1a962"),
      c("Olive Green", "OLI84", "#585f2d"),
      c("Opal", "OPA85", "#a5b9b7"),
      c("Pampas", "PAM86", "#bb9e81"),
      c("Paper Rose", "PAP87", "#b9a29e"),
      c("Parchment", "PAR88", "#d1cbbc"),
      c("Pavestone", "PAV89", "#bdb6a5"),
      c("Peacock", "PEA90", "#749589"),
      c("Peat", "PEA91", "#40413b"),
      c("Pink Silk", "PIN92", "#c9b19c"),
      c("Porridge", "POR93", "#c6b4a1"),
      c("Quartz", "QUA94", "#aea79e"),
      c("Sage", "SAG95", "#918c67"),
      c("Sand", "SAN96", "#bcb397"),
      c("Scotchmist", "SCO97", "#9b999d"),
      c("Sea Foam", "SEA98", "#a1b4ba"),
      c("Seaspray", "SEA99", "#3e5c68"),
      c("Sepia", "SEP100", "#a59b8e"),
      c("Shadow", "SHA101", "#8e9486"),
      c("Sherbet", "SHE102", "#d5c2aa"),
      c("Silver Fox", "SIL103", "#b2b3ba"),
      c("Slate Blue", "SLA104", "#95aab7"),
      c("Sorbet", "SOR105", "#dcd0c5"),
      c("Spearmint", "SPE106", "#7da69f"),
      c("Spice", "SPI107", "#99321d"),
      c("Springbok", "SPR108", "#9b7b5f"),
      c("Squirrel", "SQU109", "#9f5c4d"),
      c("Thistle", "THI110", "#5a4250"),
      c("Tofu", "TOF111", "#6f685e"),
      c("Tuscan Harvest", "TUS112", "#b3935b"),
      c("Verglas", "VER113", "#c2b5ab"),
      c("Veronica", "VER114", "#9e878c"),
      c("Walnut", "WAL115", "#68584b"),
      c("White Mint", "WHI116", "#bbc8bd"),
      c("Willow", "WIL117", "#677676"),
      c("Wisp", "WIS118", "#bbb6b0"),
      c("Zin", "ZIN119", "#757b84"),
    ],
  },
  {
    id: "westex-undyed-loop", type: "carpets", brand: "Westex",
    name: "Undyed Loop", code: "W-UL", real: true,
    photo: IMG.pile, alt: "Undyed Loop carpet",
    blurb: "25 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Aluminium", "ALU01", "#9a927d"),
      c("Basmati", "BAS02", "#c0ae8d"),
      c("Bobcat", "BOB03", "#8d7d65"),
      c("Bone", "BON04", "#c0ae8c"),
      c("Caraway", "CAR05", "#9c876a"),
      c("Carom", "CAR06", "#a08f73"),
      c("Chai", "CHA07", "#a7977c"),
      c("Croissant", "CRO08", "#bfae8b"),
      c("Fog", "FOG09", "#958771"),
      c("Gabbro", "GAB10", "#898471"),
      c("Greige", "GRE11", "#776955"),
      c("Griege", "GRI12", "#746856"),
      c("Halite", "HAL13", "#b4a786"),
      c("Impala", "IMP14", "#937f62"),
      c("Iron", "IRO15", "#6c665b"),
      c("Koala", "KOA16", "#7c7060"),
      c("Lava", "LAV17", "#a19984"),
      c("Linen", "LIN18", "#a99d7e"),
      c("Lunar", "LUN19", "#b6a687"),
      c("Nickle", "NIC20", "#8b857b"),
      c("Rye", "RYE21", "#897d6c"),
      c("Shark", "SHA22", "#72685a"),
      c("Smoke", "SMO23", "#878277"),
      c("Taro", "TAR24", "#c2b291"),
      c("Volcano", "VOL25", "#615a52"),
    ],
  },
  {
    id: "westex-westend", type: "carpets", brand: "Westex",
    name: "Westend", code: "W-W", real: true,
    photo: IMG.velvet, alt: "Westend carpet",
    blurb: "80 shades, measured from the Westex swatch photographs.",
    colours: [
      c("Amber", "AMB01", "#a68044"),
      c("Amethyst", "AME02", "#a990b8"),
      c("Asparagus", "ASP03", "#848063"),
      c("Atlantis", "ATL04", "#6180b5"),
      c("Avocado", "AVO05", "#373c1f"),
      c("Bagel", "BAG06", "#cfc2b6"),
      c("Barley", "BAR07", "#cab094"),
      c("Berry", "BER08", "#7c0f18"),
      c("Bisque", "BIS09", "#cfb7a3"),
      c("Black Pearl", "BLA10", "#a7acb2"),
      c("Butternut", "BUT11", "#bd9a74"),
      c("Campion", "CAM12", "#b86a64"),
      c("Champagne", "CHA13", "#bfa081"),
      c("Cider", "CID14", "#cab488"),
      c("Clay", "CLA15", "#ab988a"),
      c("Cloud", "CLO16", "#bcbcbb"),
      c("Damson", "DAM17", "#3b1e27"),
      c("Delft", "DEL18", "#02387f"),
      c("Ermine", "ERM19", "#dcd3c2"),
      c("Espresso", "ESP20", "#3b2217"),
      c("Fern", "FER21", "#87aba9"),
      c("Flint", "FLI22", "#70655a"),
      c("Greenfinch", "GRE23", "#bac067"),
      c("Hazel", "HAZ24", "#9ba29a"),
      c("Ivory", "IVO25", "#c5b8a5"),
      c("Jasmine", "JAS26", "#d1c98e"),
      c("Jet", "JET27", "#130f0f"),
      c("Latte", "LAT28", "#baafa5"),
      c("Maderia", "MAD29", "#d6b686"),
      c("Magnolia", "MAG30", "#c5b49f"),
      c("Mango", "MAN31", "#bfa288"),
      c("Manor Grey", "MAN32", "#c5bcab"),
      c("Maple", "MAP33", "#a49787"),
      c("Marshmallow", "MAR34", "#bbad93"),
      c("Mascarpone", "MAS35", "#dccdb7"),
      c("Mead", "MEA36", "#c29048"),
      c("Merlot", "MER37", "#401420"),
      c("Moccasin", "MOC38", "#9c7856"),
      c("Moss", "MOS39", "#a09171"),
      c("Muscat", "MUS40", "#d6b19e"),
      c("Mushroom", "MUS41", "#c2b7a7"),
      c("Nougat", "NOU42", "#af9082"),
      c("Onyx", "ONY43", "#2f3032"),
      c("Ormolu", "ORM44", "#9f8a7c"),
      c("Panama", "PAN45", "#c3aa87"),
      c("Pebble", "PEB46", "#a1a2a0"),
      c("Pecan", "PEC47", "#a89868"),
      c("Petal", "PET48", "#a8b4a0"),
      c("Pimento", "PIM49", "#a65549"),
      c("Pine", "PIN50", "#083b27"),
      c("Platinum", "PLA51", "#656661"),
      c("Poison", "POI52", "#2f0e1f"),
      c("Powder Blue", "POW53", "#7f9db9"),
      c("Praline", "PRA54", "#948173"),
      c("Pumpkin", "PUM55", "#b77a3a"),
      c("Reseda", "RES56", "#758256"),
      c("Rosa Rosa", "ROS57", "#5c0d22"),
      c("Rosemary", "ROS58", "#99ab7a"),
      c("Ruby", "RUB59", "#62090d"),
      c("Saddle", "SAD60", "#342e23"),
      c("Sandstone", "SAN61", "#bca88d"),
      c("Sapphire", "SAP62", "#08244b"),
      c("Seal", "SEA63", "#aca29f"),
      c("Seashell", "SEA64", "#c7b49b"),
      c("Sheepskin", "SHE65", "#d1cdc3"),
      c("Silver Birch", "SIL66", "#928b88"),
      c("Spring", "SPR67", "#c79e66"),
      c("Spruce", "SPR68", "#525f45"),
      c("Steel", "STE69", "#637c88"),
      c("Storm", "STO70", "#8d8e89"),
      c("Suede", "SUE71", "#6c5a4e"),
      c("Tarragon", "TAR72", "#88a285"),
      c("Terracotta", "TER73", "#792c24"),
      c("Toast", "TOA74", "#b0916a"),
      c("Tornado", "TOR75", "#b3b1ac"),
      c("Truffle", "TRU76", "#4a352f"),
      c("Turmeri", "TUR77", "#d2ad64"),
      c("Vanilla", "VAN78", "#cbb68f"),
      c("White", "WHI79", "#e4decc"),
      c("Zircon", "ZIR80", "#7e8a80"),
    ],
  },

  /* ---------------------------------------------- STILL AWAITING SUPPLIER DATA
     No colour chips arrived for vinyl or rugs, so these two stay invented and
     are the only ranges on the site that are. Everything above is measured. */


  {
    id: "cushioned-vinyl", type: "vinyl", brand: "Hari's Selection",
    name: "Cushioned Vinyl", code: "V-CV", real: false,
    photo: IMG.vinyl, alt: "Cushioned sheet vinyl in a utility room",
    blurb: "PLACEHOLDER — soft, warm sheet vinyl in wood and tile effects.",
    spec: { fibre: "Cushioned sheet vinyl", pile: "Sheet", widths: "2m / 3m / 4m", use: "Domestic" },
    colours: [
      c("Light Oak","V-A","#d7cbb4"), c("Honey","V-B","#b7a98d"), c("Driftwood","V-C","#9a9385"),
      c("Clay Tile","V-D","#8f8168"), c("Slate Tile","V-E","#6f6656"), c("Graphite","V-F","#48413a"),
    ],
  },

  {
    id: "louis-de-poortere", type: "rugs", brand: "Louis de Poortere",
    name: "Woven Rugs", code: "R-LDP", real: false,
    photo: IMG.rug, alt: "Patterned woven luxury rug over wood flooring",
    blurb: "PLACEHOLDER — Belgian-woven statement rugs in rich designs.",
    spec: { fibre: "Woven cotton / wool blend", pile: "Flatweave & pile", widths: "Standard rug sizes", use: "Domestic" },
    colours: [
      c("Sand","R-A","#c7b6a0"), c("Terracotta","R-B","#9c7c66"), c("Chocolate","R-C","#6e5a4a"),
      c("Heather","R-D","#8a6f7d"), c("Plum","R-E","#5a4351"), c("Deep Teal","R-F","#33424a"),
    ],
  },
];

/* Featured ranges on the home page */
/* Featured ranges on the home page. These ids are checked by the smoke test:
   they were left behind when the catalogue was regenerated with brand-prefixed
   ids, and three dead ids meant the home page quietly showed no featured
   ranges at all. Editable from /admin. */
const FEATURED = ["westex-elysian", "westex-pure-luxury", "westex-fine-westex-twist"];
