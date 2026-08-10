/* ============================================================================
   HARI'S CARPETS — CATALOGUE + CONTENT DATA
   ----------------------------------------------------------------------------
   Everything on the site renders from this file.

   Real content (from haris-carpets.co.uk): business details, address, phone,
   socials, product categories, services, about copy.

   >>> STILL TO CONFIRM <<<
     - Colour names / codes / hex outside the Westex ranges are provisional and
       are there to give the catalogue, filters and visualiser something real to
       work against. Replace them from the supplier packs.
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

/* ----------------------------------------------------------------------------
   VISUALISER ROOMS
   Each needs a photo and a greyscale floor mask. Masks come from
   tools/make-floor-mask.py; see assets/README.md for which rooms it can do
   automatically and which need cutting by hand. A room whose photo or mask is
   missing is dropped from the picker at runtime rather than rendering broken,
   so an entry can be added here before its assets exist.
   -------------------------------------------------------------------------- */
const VIS_ROOMS = [
  { id: "living-room", name: "Living room", photo: IMG.hero, mask: "assets/masks/hero-living-room.png",
    note: "South-facing living room, morning light." },
  { id: "bedroom", name: "Bedroom", photo: IMG.bedroom, mask: "assets/masks/bedroom-wool.png",
    note: "Bedroom with soft daylight through curtains." },
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
const c = (name, code, hex) => ({ name, code, hex });

const CATALOGUE = [
  /* ---------------------------------------------------------------- CARPETS */
  {
    id: "fine-westex-twist", type: "carpets", brand: "Westex",
    name: "Fine Westex Twist", code: "WX-FWT", real: true,
    photo: IMG.hero, alt: "Wool twist carpet in a living room",
    blurb: "A tightly-twisted carpet with refined softness and the strength to last.",
    spec: { fibre: "100% wool-rich blend", pile: "Tightly-twisted pile", widths: "4m / 5m", use: "Heavy domestic" },
    colours: [
      c("Oat Field","101","#d9cfb8"), c("Pale Ash","104","#c7c3ba"), c("Pebble Grey","112","#a9a69d"),
      c("Driftwood","118","#9a8f7a"), c("Slate","126","#6f7278"), c("Storm","131","#565a5e"),
      c("Peat","140","#5b4f3f"), c("Charcoal","148","#3a3a3c"), c("Fern","155","#5f6b4f"), c("Deep Moss","160","#3f4a37"),
    ],
  },
  {
    id: "elysian-velvet", type: "carpets", brand: "Westex",
    name: "Elysian Velvet", code: "WX-EV", real: true,
    photo: IMG.velvet, alt: "Wool velvet carpet in a panelled living room",
    blurb: "A luxurious velvet range with a lustrous finish — one we fit often (ask us about Meadow Mist).",
    spec: { fibre: "Wool-rich, SilkTex finish", pile: "Luxury velvet pile", widths: "4m / 5m", use: "Heavy domestic" },
    colours: [
      c("Meadow Mist","EV1","#b9c0a8"), c("Sea Salt","EV2","#dcd7c9"), c("Oyster","EV3","#cabfa6"),
      c("Dove","EV4","#a7a49b"), c("Truffle","EV5","#7a6a56"), c("Slate Blue","EV6","#5f6b76"),
      c("Forest","EV7","#37472f"), c("Jet","EV8","#2b2b2d"),
    ],
  },
  {
    id: "barrington", type: "carpets", brand: "Westex",
    name: "Barrington", code: "WX-BAR", real: true,
    photo: IMG.bedroom, alt: "Plush wool carpet in a bedroom",
    blurb: "A versatile 100% wool carpet in contemporary natural shades — quiet, warm and hard-wearing.",
    spec: { fibre: "100% wool, 3-fold yarn", pile: "Fine cut pile", widths: "4m / 5m", use: "Heavy domestic" },
    colours: [
      c("Linen","201","#e0d7c4"), c("Sandstone","206","#cdbfa4"), c("Putty","210","#b7ad98"),
      c("Taupe","215","#9c8f7a"), c("Clay","221","#8a6f57"), c("Umber","228","#6d5843"),
      c("Flint","233","#77746c"), c("Graphite","240","#454444"),
    ],
  },
  {
    id: "pure-luxury", type: "carpets", brand: "Westex",
    name: "Pure Luxury", code: "WX-PL", real: true,
    photo: IMG.stairs, alt: "Wool carpet fitted to a staircase",
    blurb: "Sumptuous 100% pure new wool velvet with stain-resist, anti-dust-mite and mothproof treatments built in.",
    spec: { fibre: "100% pure new wool velvet", pile: "Dense velvet pile", widths: "4m / 5m", use: "Extra-heavy domestic" },
    colours: [
      c("Ivory","301","#e8e0d0"), c("Champagne","305","#d8c9ac"), c("Almond","309","#c3b191"),
      c("Mushroom","314","#a89880"), c("Mink","319","#8a7963"), c("Espresso","326","#4a3a2c"),
      c("Steel","331","#7b7f84"), c("Onyx","338","#2f2f31"), c("Sage","344","#8f9a82"), c("Bottle","350","#324236"),
    ],
  },
  {
    id: "ultima-twist", type: "carpets", brand: "Westex",
    name: "Ultima Twist", code: "WX-UT", real: true,
    photo: IMG.pile, alt: "Close detail of carpet pile",
    blurb: "A superb combination of performance and comfort — busy family rooms and light-contract spaces alike.",
    spec: { fibre: "Wool-rich blend", pile: "Twist pile", widths: "4m / 5m", use: "Heavy domestic / contract" },
    colours: [
      c("Chalk","501","#e4ded2"), c("Stone","507","#c4bcab"), c("Cord","512","#a89b83"),
      c("Bark","518","#7c6a54"), c("Pewter","524","#7d7c78"), c("Ink","530","#3d3f45"),
      c("Olive","536","#5d5f43"), c("Teal","542","#33555a"),
    ],
  },
  {
    id: "cormar-sensation", type: "carpets", brand: "Cormar Carpets",
    name: "Sensation", code: "CM-SEN", real: false,
    photo: IMG.showroom, alt: "Carpet showroom interior",
    blurb: "PLACEHOLDER — replace with the real Cormar range name, spec and blurb from the catalogue.",
    spec: { fibre: "Verify", pile: "Verify", widths: "4m / 5m", use: "Heavy domestic" },
    colours: [
      c("Kentish Cream","C01","#ddd3c1"), c("Wheatfield","C02","#bcae95"), c("Hessian","C03","#9a8c74"),
      c("Otter","C04","#6f6858"), c("Anthracite","C05","#464544"), c("Willow","C06","#57634d"),
    ],
  },
  {
    id: "hm-easicare", type: "carpets", brand: "Hugh Mackay",
    name: "Easicare", code: "HM-EC", real: false,
    photo: IMG.pile, alt: "Close detail of carpet pile",
    blurb: "PLACEHOLDER — one of the four supplied Hugh Mackay / Victoria collections.",
    spec: { fibre: "Easy-clean synthetic — verify", pile: "Twist", widths: "4m / 5m", use: "Heavy domestic" },
    colours: [
      c("Chalk White","E01","#ddd6c8"), c("Oatmeal","E02","#b4a993"), c("Driftwood","E03","#847863"),
      c("Peat","E04","#4c463b"), c("Harbour","E05","#5a6b74"),
    ],
  },
  {
    id: "vic-design-floors", type: "carpets", brand: "Victoria Carpets",
    name: "Design Floors", code: "VC-DF", real: false,
    photo: IMG.stairs, alt: "Carpet fitted to a staircase",
    blurb: "PLACEHOLDER collection. Replace with real Victoria data.",
    spec: { fibre: "Verify", pile: "Verify", widths: "4m / 5m", use: "Heavy domestic" },
    colours: [
      c("Bone","D01","#ddd4c2"), c("Barley","D02","#b8a98c"), c("Fossil","D03","#877a61"),
      c("Peat","D04","#524b3d"), c("Juniper","D05","#3c4a3b"),
    ],
  },

  /* ------------------------------------------------------- WOOD & LAMINATE */
  {
    id: "furlong-engineered-oak", type: "wood", brand: "Furlong Flooring",
    name: "Engineered Oak", code: "FL-EO", real: false,
    photo: IMG.wood, alt: "Engineered oak herringbone flooring",
    blurb: "PLACEHOLDER — replace with real Furlong data from the asset pack.",
    spec: { fibre: "Engineered oak", pile: "Plank & herringbone", widths: "Plank formats", use: "Domestic" },
    colours: [
      c("Blonde Oak","W-A","#d3b98f"), c("Classic Oak","W-B","#c09a63"), c("Golden Oak","W-C","#a97c42"),
      c("Antique Oak","W-D","#8a6743"), c("Walnut","W-E","#6d4d33"), c("Smoked","W-F","#57493c"),
      c("Grey Wash","W-G","#a49a8c"), c("Ebony","W-H","#3f382f"),
    ],
  },
  {
    id: "laminate-classic", type: "wood", brand: "Furlong Flooring",
    name: "Laminate Collection", code: "FL-LAM", real: false,
    photo: IMG.wood, alt: "Laminate plank flooring",
    blurb: "PLACEHOLDER — hard-wearing laminate, underfloor-heating compatible.",
    spec: { fibre: "HDF core laminate", pile: "Plank", widths: "Plank formats", use: "Domestic / light contract" },
    colours: [
      c("Nordic White","L-A","#ddd6cc"), c("Natural Oak","L-B","#c6a879"), c("Rustic Oak","L-C","#9d7b4f"),
      c("Grey Plank","L-D","#9b968f"), c("Dark Walnut","L-E","#5d4634"), c("Charcoal Plank","L-F","#474441"),
    ],
  },

  /* -------------------------------------------------------------------- LVT */
  {
    id: "lvt-wood-effect", type: "lvt", brand: "Furlong Flooring",
    name: "LVT Wood Collection", code: "LVT-W", real: false,
    photo: IMG.lvt, alt: "Wood-effect luxury vinyl tile flooring",
    blurb: "PLACEHOLDER — warm wood looks, waterproof and hard-wearing.",
    spec: { fibre: "Luxury vinyl tile", pile: "Plank / herringbone", widths: "Tile & plank", use: "Domestic / commercial" },
    colours: [
      c("Pale Oak","LVT-A","#cbb79a"), c("Natural Oak","LVT-B","#b39a74"), c("Warm Walnut","LVT-C","#8a6a45"),
      c("Smoked Oak","LVT-D","#6f6152"), c("Chalk","LVT-H","#d8d3c8"), c("Charcoal","LVT-G","#454749"),
    ],
  },
  {
    id: "lvt-stone-effect", type: "lvt", brand: "Furlong Flooring",
    name: "LVT Stone Collection", code: "LVT-S", real: false,
    photo: IMG.lvt, alt: "Stone-effect luxury vinyl tile flooring",
    blurb: "PLACEHOLDER — natural stone finishes for kitchens, hallways and bathrooms.",
    spec: { fibre: "Luxury vinyl tile", pile: "Tile", widths: "Tile formats", use: "Domestic / commercial" },
    colours: [
      c("Limestone","LVT-S1","#cfc9be"), c("Grey Stone","LVT-E","#a9a49c"), c("Slate Stone","LVT-F","#6b6d70"),
      c("Basalt","LVT-S2","#55585b"), c("Sandstone","LVT-S3","#c0ab8c"),
    ],
  },

  /* ------------------------------------------------------------------ VINYL */
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

  /* ------------------------------------------------------------------- RUGS */
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
const FEATURED = ["elysian-velvet", "pure-luxury", "fine-westex-twist"];
