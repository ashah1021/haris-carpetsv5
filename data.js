/* ============================================================================
   HARI'S CARPETS — CATALOGUE + CONTENT DATA
   ----------------------------------------------------------------------------
   Everything on the site renders from this file.

   Real content (from haris-carpets.co.uk): business details, address, phone,
   socials, product categories, services, about copy.

   >>> STILL TO CONFIRM <<<
     - Carpet COLOUR names / codes / hex are invented (real Westex range names).
     - Wood / Laminate / LVT / Vinyl / Rugs product lists are placeholders —
       swap in the real ranges from the brand asset packs.
     - Photography in /assets is AI-generated stand-in imagery. Replace with
       real showroom + supplier roomset shots. See assets/README.md.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   FEATURE SWITCHES
   samples: the "order up to 5 free samples" tray. Switched OFF because it is
   not confirmed that Hari's actually offer a postal sample service — the
   Westex-style sample flow was carried over from their brand site. Flip to
   true once confirmed and the tray, colour-chip picking and the header pill
   all come back exactly as they were.
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
   One place for every image path on the site. Drop a real jpg at the same
   path and it appears — no code changes anywhere else.
   -------------------------------------------------------------------------- */
const IMG = {
  hero:        "assets/hero-living-room.jpg",
  showroom:    "assets/showroom.jpg",
  fitting:     "assets/fitting-hands.jpg",
  samples:     "assets/samples-counter.jpg",
  stairs:      "assets/stairs-wool-twist.jpg",
  bedroom:     "assets/bedroom-wool.jpg",
  velvet:      "assets/velvet-living-room.jpg",
  pile:        "assets/pile-detail.jpg",
  wood:        "assets/wood-herringbone-kitchen.jpg",
  lvt:         "assets/lvt-kitchen.jpg",
  vinyl:       "assets/vinyl-utility.jpg",
  rug:         "assets/rug-living-room.jpg",
};

/* ----------------------------------------------------------------------------
   VISUALISER
   Two steps: pick a flooring type, then a room. A type lists the rooms it makes
   sense in — nobody wants stair carpet costed for a bathroom.

   Each room needs a photo and a greyscale floor mask. Masks come from
   tools/make-floor-mask.py; see assets/README.md for which rooms it can do
   automatically and which need cutting by hand. A room whose photo or mask is
   missing is dropped from the picker at runtime rather than rendering broken,
   so you can add an entry here before its assets exist.
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
       stairs   — photo is in /assets but its mask needs cutting by hand. The
                  carpet matches the wall in colour, and sun-blown treads land
                  in the same brightness band as the white spindles, so no
                  automatic rule separates them. See assets/README.md.
       bathroom — no photograph yet. Add one to /assets, mask it, add it here. */
];

/* Named shade sets. Carpet is not listed here — it reads the real Westex
   ranges out of BRANDS below, so colour has one source of truth. */
const VIS_TONES = {
  lvt: [
    { name: "Pale Oak", code: "LVT-A", hex: "#cbb79a" },
    { name: "Natural Oak", code: "LVT-B", hex: "#b39a74" },
    { name: "Warm Walnut", code: "LVT-C", hex: "#8a6a45" },
    { name: "Smoked Oak", code: "LVT-D", hex: "#6f6152" },
    { name: "Grey Stone", code: "LVT-E", hex: "#a9a49c" },
    { name: "Slate Stone", code: "LVT-F", hex: "#6b6d70" },
    { name: "Charcoal", code: "LVT-G", hex: "#454749" },
    { name: "Chalk", code: "LVT-H", hex: "#d8d3c8" },
  ],
  wood: [
    { name: "Blonde Oak", code: "W-A", hex: "#d3b98f" },
    { name: "Classic Oak", code: "W-B", hex: "#c09a63" },
    { name: "Golden Oak", code: "W-C", hex: "#a97c42" },
    { name: "Antique Oak", code: "W-D", hex: "#8a6743" },
    { name: "Walnut", code: "W-E", hex: "#6d4d33" },
    { name: "Smoked", code: "W-F", hex: "#57493c" },
    { name: "Grey Wash", code: "W-G", hex: "#a49a8c" },
    { name: "Ebony", code: "W-H", hex: "#3f382f" },
  ],
  vinyl: [
    { name: "Light Oak", code: "V-A", hex: "#d7cbb4" },
    { name: "Honey", code: "V-B", hex: "#b7a98d" },
    { name: "Driftwood", code: "V-C", hex: "#9a9385" },
    { name: "Clay Tile", code: "V-D", hex: "#8f8168" },
    { name: "Slate Tile", code: "V-E", hex: "#6f6656" },
    { name: "Graphite", code: "V-F", hex: "#48413a" },
  ],
  rug: [
    { name: "Sand", code: "R-A", hex: "#c7b6a0" },
    { name: "Terracotta", code: "R-B", hex: "#9c7c66" },
    { name: "Chocolate", code: "R-C", hex: "#6e5a4a" },
    { name: "Heather", code: "R-D", hex: "#8a6f7d" },
    { name: "Plum", code: "R-E", hex: "#5a4351" },
    { name: "Deep Teal", code: "R-F", hex: "#33424a" },
  ],
};

/* Step one of the visualiser. rooms[] are ids from VIS_ROOMS above. */
const VIS_TYPES = [
  { id: "carpets", name: "Carpets",         palette: "carpet", rooms: ["living-room", "bedroom"] },
  { id: "wood",    name: "Wood & Laminate", palette: "wood",   rooms: ["kitchen", "utility"] },
  { id: "lvt",     name: "LVT",             palette: "lvt",    rooms: ["kitchen", "utility"] },
  { id: "vinyl",   name: "Vinyl",           palette: "vinyl",  rooms: ["utility", "kitchen"] },
  { id: "rugs",    name: "Luxury Rugs",     palette: "rug",    rooms: ["living-room"] },
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

/* The four things the business does for you — straight from the current site */
const SERVICES = [
  { title: "We arrange installation", body: "Our own skilled fitters handle the whole job, start to finish." },
  { title: "Free measuring & planning", body: "We measure up and plan the job at your home, at no cost and no obligation." },
  { title: "Uplift & removal service", body: "We lift and take away your old flooring so you don't have to." },
  { title: "Wear guarantee", body: "Every floor we supply and fit comes with a wear guarantee." },
];

/* ============================================================================
   PRODUCT CATEGORIES — the top level of the site (mirrors the real shop)
   'Carpets' routes into the brand catalogue below (Westex-style depth).
   The others are category pages with placeholder product ranges for now.
   ============================================================================ */
const c = (name, code, hex) => ({ name, code, hex });

const CATEGORIES = [
  {
    id: "carpets",
    name: "Carpets",
    route: "#/brands",
    photo: IMG.velvet,
    alt: "Wool velvet carpet in a panelled living room",
    blurb: "Wool-rich and synthetic carpets from Britain's leading mills. Browse by brand, range and colour.",
    swatches: ["#d9cfb8", "#a9a69d", "#6f7278", "#5b4f3f", "#5f6b4f", "#3a3a3c"],
  },
  {
    id: "wood-laminate",
    name: "Wood & Laminate",
    route: "#/category/wood-laminate",
    photo: IMG.wood,
    alt: "Engineered oak herringbone flooring in a kitchen-diner",
    blurb: "Engineered and solid wood, plus hard-wearing laminate — herringbone, chevron and plank formats.",
    swatches: ["#c9a978", "#b8894f", "#8a6743", "#7a5636", "#a49a8c", "#4b4038"],
    products: [
      { name: "Engineered Oak — Herringbone (placeholder)", code: "W-01", blurb: "Real-oak top layer in a classic herringbone lay." },
      { name: "Engineered Oak — Plank (placeholder)", code: "W-02", blurb: "Wide plank engineered board for living spaces." },
      { name: "Laminate — Herringbone (placeholder)", code: "L-01", blurb: "Hard-wearing laminate, underfloor-heating compatible." },
      { name: "Laminate — Grey Plank (placeholder)", code: "L-02", blurb: "On-trend grey tones for kitchen-diners." },
    ],
  },
  {
    id: "lvt",
    name: "LVT",
    route: "#/category/lvt",
    photo: IMG.lvt,
    alt: "Stone-effect luxury vinyl tile flooring in a modern kitchen",
    blurb: "Luxury vinyl tile — the look of wood or stone with the durability for kitchens, bathrooms and busy family spaces.",
    swatches: ["#cbb79a", "#9c8058", "#7a6a56", "#b6ada0", "#6a6156", "#40382f"],
    products: [
      { name: "LVT — Wood-effect (placeholder)", code: "LVT-01", blurb: "Warm wood looks, waterproof and hard-wearing." },
      { name: "LVT — Stone-effect (placeholder)", code: "LVT-02", blurb: "Natural stone finish for kitchens and hallways." },
      { name: "LVT — Herringbone (placeholder)", code: "LVT-03", blurb: "Herringbone lay in a low-maintenance tile." },
    ],
  },
  {
    id: "vinyl",
    name: "Vinyl",
    route: "#/category/vinyl",
    photo: IMG.vinyl,
    alt: "Cushioned wood-effect sheet vinyl in a utility room",
    blurb: "Cushioned sheet vinyl — practical, comfortable underfoot and easy to keep clean.",
    swatches: ["#d7cbb4", "#b7a98d", "#8f8168", "#9a9385", "#6f6656", "#48413a"],
    products: [
      { name: "Cushioned Vinyl — Wood (placeholder)", code: "V-01", blurb: "Soft, warm sheet vinyl with a wood look." },
      { name: "Cushioned Vinyl — Tile (placeholder)", code: "V-02", blurb: "Tile-effect vinyl for bathrooms and utility rooms." },
    ],
  },
  {
    id: "rugs",
    name: "Luxury Rugs",
    route: "#/category/rugs",
    photo: IMG.rug,
    alt: "Patterned woven luxury rug layered over wood flooring",
    blurb: "Luxury rugs, including Louis de Poortere, to finish and pull a room together.",
    swatches: ["#c7b6a0", "#9c7c66", "#6e5a4a", "#8a6f7d", "#5a4351", "#33424a"],
    products: [
      { name: "Louis de Poortere (placeholder)", code: "R-01", blurb: "Belgian-woven statement rugs in rich designs." },
      { name: "Wool rug — Natural (placeholder)", code: "R-02", blurb: "Undyed wool rug in warm neutral tones." },
      { name: "Flatweave rug (placeholder)", code: "R-03", blurb: "Low-profile flatweave for high-traffic rooms." },
    ],
  },
];

/* ============================================================================
   CARPET BRAND CATALOGUE — the Westex-style depth under 'Carpets'
   brand -> ranges -> colour chips
   ============================================================================ */
const BRANDS = [
  {
    id: "westex",
    name: "Westex",
    tagline: "West Yorkshire wool, dyed in-house.",
    heritage:
      "A master-dyer's mill making wool-rich carpet in West Yorkshire for nearly 40 years. Hundreds of core shades, plus a special-dye service that matches almost any colour. (We fit a lot of Westex — including their Elysian Velvet.)",
    real: true,
    photo: IMG.velvet,
    ranges: [
      {
        id: "fine-westex-twist", name: "Fine Westex Twist", code: "WX-FWT",
        fibre: "100% wool-rich blend", pile: "Tightly-twisted pile", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "A tightly-twisted carpet with refined softness and the strength to last.",
        photo: IMG.hero, alt: "Wool twist carpet in a living room",
        colours: [
          c("Oat Field","101","#d9cfb8"), c("Pale Ash","104","#c7c3ba"), c("Pebble Grey","112","#a9a69d"),
          c("Driftwood","118","#9a8f7a"), c("Slate","126","#6f7278"), c("Storm","131","#565a5e"),
          c("Peat","140","#5b4f3f"), c("Charcoal","148","#3a3a3c"), c("Fern","155","#5f6b4f"), c("Deep Moss","160","#3f4a37"),
        ],
      },
      {
        id: "elysian-velvet", name: "Elysian Velvet", code: "WX-EV",
        fibre: "Wool-rich, SilkTex finish", pile: "Luxury velvet pile", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "A luxurious velvet range with a lustrous finish — one we fit often (ask us about Meadow Mist).",
        photo: IMG.velvet, alt: "Wool velvet carpet in a panelled living room",
        colours: [
          c("Meadow Mist","EV1","#b9c0a8"), c("Sea Salt","EV2","#dcd7c9"), c("Oyster","EV3","#cabfa6"),
          c("Dove","EV4","#a7a49b"), c("Truffle","EV5","#7a6a56"), c("Slate Blue","EV6","#5f6b76"),
          c("Forest","EV7","#37472f"), c("Jet","EV8","#2b2b2d"),
        ],
      },
      {
        id: "barrington", name: "Barrington", code: "WX-BAR",
        fibre: "100% wool, 3-fold yarn", pile: "Fine cut pile", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "A versatile 100% wool carpet in contemporary natural shades — quiet, warm and hard-wearing.",
        photo: IMG.bedroom, alt: "Plush wool carpet in a bedroom",
        colours: [
          c("Linen","201","#e0d7c4"), c("Sandstone","206","#cdbfa4"), c("Putty","210","#b7ad98"),
          c("Taupe","215","#9c8f7a"), c("Clay","221","#8a6f57"), c("Umber","228","#6d5843"),
          c("Flint","233","#77746c"), c("Graphite","240","#454444"),
        ],
      },
      {
        id: "pure-luxury", name: "Pure Luxury", code: "WX-PL",
        fibre: "100% pure new wool velvet", pile: "Dense velvet pile", widths: "4m / 5m", use: "Extra-heavy domestic",
        blurb: "Sumptuous 100% pure new wool velvet with stain-resist, anti-dust-mite and mothproof treatments built in.",
        photo: IMG.stairs, alt: "Wool carpet fitted to a staircase",
        colours: [
          c("Ivory","301","#e8e0d0"), c("Champagne","305","#d8c9ac"), c("Almond","309","#c3b191"),
          c("Mushroom","314","#a89880"), c("Mink","319","#8a7963"), c("Espresso","326","#4a3a2c"),
          c("Steel","331","#7b7f84"), c("Onyx","338","#2f2f31"), c("Sage","344","#8f9a82"), c("Bottle","350","#324236"),
        ],
      },
      {
        id: "ultima-twist", name: "Ultima Twist", code: "WX-UT",
        fibre: "Wool-rich blend", pile: "Twist pile", widths: "4m / 5m", use: "Heavy domestic / contract",
        blurb: "A superb combination of performance and comfort — busy family rooms and light-contract spaces alike.",
        photo: IMG.pile, alt: "Close detail of carpet pile",
        colours: [
          c("Chalk","501","#e4ded2"), c("Stone","507","#c4bcab"), c("Cord","512","#a89b83"),
          c("Bark","518","#7c6a54"), c("Pewter","524","#7d7c78"), c("Ink","530","#3d3f45"),
          c("Olive","536","#5d5f43"), c("Teal","542","#33555a"),
        ],
      },
    ],
  },

  {
    id: "cormar", name: "Cormar Carpets", tagline: "One of the UK's largest carpet makers.",
    heritage: "PLACEHOLDER — add Cormar's real heritage copy. Assets supplied: Colour Chips + Roomset Imagery (Google Drive).",
    real: false, photo: IMG.showroom,
    ranges: [
      {
        id: "cormar-range-a", name: "Range name (placeholder)", code: "CM-01",
        fibre: "Wool-rich / synthetic — verify", pile: "Twist — verify", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "PLACEHOLDER range. Replace with real Cormar range name, spec and blurb from the catalogue.",
        photo: IMG.showroom, alt: "Carpet showroom interior",
        colours: [ c("Colour 1","C01","#ddd3c1"), c("Colour 2","C02","#bcae95"), c("Colour 3","C03","#9a8c74"), c("Colour 4","C04","#6f6858"), c("Colour 5","C05","#464544"), c("Colour 6","C06","#57634d") ],
      },
      {
        id: "cormar-range-b", name: "Range name (placeholder)", code: "CM-02",
        fibre: "Verify", pile: "Verify", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "PLACEHOLDER range. Replace with real data.",
        photo: IMG.showroom, alt: "Carpet showroom interior",
        colours: [ c("Colour 1","C11","#e2d9c6"), c("Colour 2","C12","#c0b193"), c("Colour 3","C13","#8f8168"), c("Colour 4","C14","#565043") ],
      },
    ],
  },

  {
    id: "furlong", name: "Furlong Flooring", tagline: "Wood, laminate and LVT specialists.",
    heritage: "PLACEHOLDER — add Furlong's real heritage copy. Assets supplied via Dropbox transfer (download before the links expire).",
    real: false, photo: IMG.wood,
    ranges: [
      {
        id: "furlong-range-a", name: "Range name (placeholder)", code: "FL-01",
        fibre: "Engineered wood / LVT — verify", pile: "Plank", widths: "Plank formats", use: "Domestic",
        blurb: "PLACEHOLDER range. Replace with real Furlong data from the asset pack.",
        photo: IMG.wood, alt: "Engineered oak herringbone flooring",
        colours: [ c("Décor 1","F01","#caa87b"), c("Décor 2","F02","#a9814f"), c("Décor 3","F03","#7f5c39"), c("Décor 4","F04","#9c948a"), c("Décor 5","F05","#4a4038") ],
      },
    ],
  },

  {
    id: "hugh-mackay", name: "Hugh Mackay", tagline: "Woven wool carpet, Durham-made.",
    heritage: "PLACEHOLDER — add real copy. Assets supplied via WeTransfer: Easicare, Natureborn, Design Floors, Hugh Mackay (download now — WeTransfer links expire).",
    real: false, photo: IMG.pile,
    ranges: [
      {
        id: "hm-easicare", name: "Easicare (placeholder)", code: "HM-EC",
        fibre: "Easy-clean synthetic — verify", pile: "Twist", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "PLACEHOLDER — one of the four supplied Hugh Mackay/Victoria collections. Replace with real data.",
        photo: IMG.pile, alt: "Close detail of carpet pile",
        colours: [ c("Colour 1","E01","#ddd6c8"), c("Colour 2","E02","#b4a993"), c("Colour 3","E03","#847863"), c("Colour 4","E04","#4c463b") ],
      },
      {
        id: "hm-natureborn", name: "Natureborn (placeholder)", code: "HM-NB",
        fibre: "Natural wool — verify", pile: "Loop / twist", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "PLACEHOLDER collection. Replace with real data.",
        photo: IMG.bedroom, alt: "Wool carpet in a bedroom",
        colours: [ c("Colour 1","N01","#e0d7bf"), c("Colour 2","N02","#b8af8f"), c("Colour 3","N03","#8d7f64"), c("Colour 4","N04","#585040") ],
      },
    ],
  },

  {
    id: "victoria", name: "Victoria Carpets", tagline: "Design Floors & more.",
    heritage: "PLACEHOLDER — add real copy. 'Design Floors' collection supplied via WeTransfer (download before expiry).",
    real: false, photo: IMG.stairs,
    ranges: [
      {
        id: "vic-design-floors", name: "Design Floors (placeholder)", code: "VC-DF",
        fibre: "Verify", pile: "Verify", widths: "4m / 5m", use: "Heavy domestic",
        blurb: "PLACEHOLDER collection. Replace with real Victoria data.",
        photo: IMG.stairs, alt: "Carpet fitted to a staircase",
        colours: [ c("Colour 1","D01","#ddd4c2"), c("Colour 2","D02","#b8a98c"), c("Colour 3","D03","#877a61"), c("Colour 4","D04","#524b3d"), c("Colour 5","D05","#3c4a3b") ],
      },
    ],
  },
];

/* Featured carpet ranges on the home page */
const FEATURED = [
  { brand: "westex", range: "elysian-velvet" },
  { brand: "westex", range: "pure-luxury" },
  { brand: "westex", range: "fine-westex-twist" },
];
