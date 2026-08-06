/* ============================================================================
   HARIS CARPETS — CATALOGUE DATA
   ----------------------------------------------------------------------------
   This file IS the catalogue. Everything on the site renders from here, so
   adding a range or a colour later is just editing this file — no HTML changes.

   >>> PLACEHOLDER CONTENT <<<
   The STRUCTURE is production-ready. The CONTENT is scaffolding:
     - Westex range names are real; codes / hex / colour names are invented.
     - Cormar / Furlong / Hugh Mackay / Victoria ranges are placeholders —
       replace them with the real catalogue data from the brand asset packs.
     - Every `hex` is a stand-in so the swatch looks real without photos.
       When you have the real colour-chip images, swap the swatch <div> for an
       <img>. See README.md ("Dropping in real assets").

   SHAPE
     brand   -> { id, name, tagline, heritage, ranges[] }
     range   -> { id, name, code, fibre, pile, widths, use, blurb,
                  roomset{label,a,b}, colours[] }
     colour  -> { name, code, hex }
   ============================================================================ */

const CONTACT = {
  phone: "020 0000 0000",         // TODO: real number
  email: "hello@haris-carpets.co.uk",
  address: "Showroom address, Hounslow", // TODO: real address
  hours: "Mon–Sat 9:00–17:30 · Sun by appointment",
};

// small helper so colour lists stay short to type
const c = (name, code, hex) => ({ name, code, hex });

const BRANDS = [
  {
    id: "westex",
    name: "Westex",
    tagline: "West Yorkshire wool, dyed in-house.",
    heritage:
      "A master-dyer's mill making wool-rich carpet in West Yorkshire for nearly 40 years. Hundreds of core shades, plus a special-dye service that matches almost any colour.",
    real: true,
    ranges: [
      {
        id: "fine-westex-twist",
        name: "Fine Westex Twist",
        code: "WX-FWT",
        fibre: "100% wool-rich blend",
        pile: "Tightly-twisted pile",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb:
          "A tightly-twisted carpet with refined softness and the strength to last. The everyday hero of the range.",
        roomset: { label: "Living room · Fine Westex Twist", a: "#c9c1b0", b: "#6d6656" },
        colours: [
          c("Oat Field", "101", "#d9cfb8"),
          c("Pale Ash", "104", "#c7c3ba"),
          c("Pebble Grey", "112", "#a9a69d"),
          c("Driftwood", "118", "#9a8f7a"),
          c("Slate", "126", "#6f7278"),
          c("Storm", "131", "#565a5e"),
          c("Peat", "140", "#5b4f3f"),
          c("Charcoal", "148", "#3a3a3c"),
          c("Fern", "155", "#5f6b4f"),
          c("Deep Moss", "160", "#3f4a37"),
        ],
      },
      {
        id: "barrington",
        name: "Barrington",
        code: "WX-BAR",
        fibre: "100% wool, 3-fold yarn",
        pile: "Fine cut pile",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb:
          "A versatile 100% wool carpet in a palette of contemporary natural shades — quiet, warm and hard-wearing.",
        roomset: { label: "Bedroom · Barrington", a: "#d3c8b4", b: "#8a7d64" },
        colours: [
          c("Linen", "201", "#e0d7c4"),
          c("Sandstone", "206", "#cdbfa4"),
          c("Putty", "210", "#b7ad98"),
          c("Taupe", "215", "#9c8f7a"),
          c("Clay", "221", "#8a6f57"),
          c("Umber", "228", "#6d5843"),
          c("Flint", "233", "#77746c"),
          c("Graphite", "240", "#454444"),
        ],
      },
      {
        id: "pure-luxury",
        name: "Pure Luxury",
        code: "WX-PL",
        fibre: "100% pure new wool velvet",
        pile: "Dense velvet pile",
        widths: "4m / 5m",
        use: "Extra-heavy domestic",
        blurb:
          "Sumptuous 100% pure new wool velvet — understated style with stain-resist, anti-dust-mite and mothproof treatments built in.",
        roomset: { label: "Staircase · Pure Luxury", a: "#b8a68c", b: "#4a4236" },
        colours: [
          c("Ivory", "301", "#e8e0d0"),
          c("Champagne", "305", "#d8c9ac"),
          c("Almond", "309", "#c3b191"),
          c("Mushroom", "314", "#a89880"),
          c("Mink", "319", "#8a7963"),
          c("Espresso", "326", "#4a3a2c"),
          c("Steel", "331", "#7b7f84"),
          c("Onyx", "338", "#2f2f31"),
          c("Sage", "344", "#8f9a82"),
          c("Bottle", "350", "#324236"),
          c("Damson", "356", "#5a4351"),
          c("Petrol", "362", "#2f4750"),
        ],
      },
      {
        id: "silken-velvet",
        name: "Silken Velvet",
        code: "WX-SV",
        fibre: "Wool-rich, SilkTex finish",
        pile: "Lustrous velvet pile",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb:
          "A lustrous velvet finish for an unrivalled luxury look. Pairs with the special-dye service for bespoke schemes.",
        roomset: { label: "Lounge · Silken Velvet", a: "#c2b6a0", b: "#5c5346" },
        colours: [
          c("Pearl", "401", "#e3dccd"),
          c("Oyster", "406", "#cfc4b0"),
          c("Fawn", "411", "#b9a888"),
          c("Dove", "417", "#a5a29a"),
          c("Truffle", "423", "#7a6a56"),
          c("Slate Blue", "429", "#5f6b76"),
          c("Forest", "435", "#37472f"),
          c("Jet", "441", "#2b2b2d"),
        ],
      },
      {
        id: "ultima-twist",
        name: "Ultima Twist",
        code: "WX-UT",
        fibre: "Wool-rich blend",
        pile: "Twist pile",
        widths: "4m / 5m",
        use: "Heavy domestic / contract",
        blurb:
          "A superb combination of performance and comfort — equally at home in busy family rooms and light-contract spaces.",
        roomset: { label: "Hallway · Ultima Twist", a: "#bdb4a4", b: "#615a4d" },
        colours: [
          c("Chalk", "501", "#e4ded2"),
          c("Stone", "507", "#c4bcab"),
          c("Cord", "512", "#a89b83"),
          c("Bark", "518", "#7c6a54"),
          c("Pewter", "524", "#7d7c78"),
          c("Ink", "530", "#3d3f45"),
          c("Olive", "536", "#5d5f43"),
          c("Teal", "542", "#33555a"),
        ],
      },
      {
        id: "origins-wood",
        name: "Origins Engineered Wood",
        code: "WX-OW",
        fibre: "Engineered oak, real-wood top layer",
        pile: "Herringbone / chevron / plank",
        widths: "Plank & parquet formats",
        use: "Domestic",
        blurb:
          "Real oak character in herringbone, chevron and plank formats — the wood side of the Westex range.",
        roomset: { label: "Kitchen-diner · Origins Herringbone", a: "#c9a06a", b: "#6e4a2c" },
        colours: [
          c("Natural Oak", "OW1", "#c9a978"),
          c("Honey Oak", "OW2", "#b8894f"),
          c("Smoked Oak", "OW3", "#8a6743"),
          c("Rustic Oak", "OW4", "#7a5636"),
          c("Ash Grey", "OW5", "#a49a8c"),
          c("Charcoal Oak", "OW6", "#4b4038"),
        ],
      },
    ],
  },

  {
    id: "cormar",
    name: "Cormar Carpets",
    tagline: "One of the UK's largest carpet makers.",
    heritage:
      "PLACEHOLDER — add Cormar's real heritage copy. Assets supplied: Colour Chips + Roomset Imagery (Google Drive).",
    real: false,
    ranges: [
      {
        id: "cormar-range-a",
        name: "Range name (placeholder)",
        code: "CM-01",
        fibre: "Wool-rich / synthetic — verify",
        pile: "Twist — verify",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb:
          "PLACEHOLDER range. Replace with real Cormar range name, spec and blurb from the catalogue.",
        roomset: { label: "Roomset · Cormar (placeholder)", a: "#c4bcae", b: "#6b6355" },
        colours: [
          c("Colour 1", "C01", "#ddd3c1"),
          c("Colour 2", "C02", "#bcae95"),
          c("Colour 3", "C03", "#9a8c74"),
          c("Colour 4", "C04", "#6f6858"),
          c("Colour 5", "C05", "#464544"),
          c("Colour 6", "C06", "#57634d"),
        ],
      },
      {
        id: "cormar-range-b",
        name: "Range name (placeholder)",
        code: "CM-02",
        fibre: "Verify",
        pile: "Verify",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb: "PLACEHOLDER range. Replace with real data.",
        roomset: { label: "Roomset · Cormar (placeholder)", a: "#cbbfa8", b: "#5f5748" },
        colours: [
          c("Colour 1", "C11", "#e2d9c6"),
          c("Colour 2", "C12", "#c0b193"),
          c("Colour 3", "C13", "#8f8168"),
          c("Colour 4", "C14", "#565043"),
        ],
      },
    ],
  },

  {
    id: "furlong",
    name: "Furlong Flooring",
    tagline: "Wood, laminate and LVT specialists.",
    heritage:
      "PLACEHOLDER — add Furlong's real heritage copy. Assets supplied via Dropbox transfer (download before the links expire).",
    real: false,
    ranges: [
      {
        id: "furlong-range-a",
        name: "Range name (placeholder)",
        code: "FL-01",
        fibre: "Engineered wood / LVT — verify",
        pile: "Plank",
        widths: "Plank formats",
        use: "Domestic",
        blurb: "PLACEHOLDER range. Replace with real Furlong data from the asset pack.",
        roomset: { label: "Roomset · Furlong (placeholder)", a: "#c6a274", b: "#6a4a2e" },
        colours: [
          c("Décor 1", "F01", "#caa87b"),
          c("Décor 2", "F02", "#a9814f"),
          c("Décor 3", "F03", "#7f5c39"),
          c("Décor 4", "F04", "#9c948a"),
          c("Décor 5", "F05", "#4a4038"),
        ],
      },
    ],
  },

  {
    id: "hugh-mackay",
    name: "Hugh Mackay",
    tagline: "Woven wool carpet, Durham-made.",
    heritage:
      "PLACEHOLDER — add real copy. Assets supplied via WeTransfer: Easicare, Natureborn, Design Floors, Hugh Mackay (download now — WeTransfer links expire).",
    real: false,
    ranges: [
      {
        id: "hm-easicare",
        name: "Easicare (placeholder)",
        code: "HM-EC",
        fibre: "Easy-clean synthetic — verify",
        pile: "Twist",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb: "PLACEHOLDER — one of the four supplied Hugh Mackay/Victoria collections. Replace with real data.",
        roomset: { label: "Roomset · Easicare (placeholder)", a: "#c3bcb0", b: "#615a4f" },
        colours: [
          c("Colour 1", "E01", "#ddd6c8"),
          c("Colour 2", "E02", "#b4a993"),
          c("Colour 3", "E03", "#847863"),
          c("Colour 4", "E04", "#4c463b"),
        ],
      },
      {
        id: "hm-natureborn",
        name: "Natureborn (placeholder)",
        code: "HM-NB",
        fibre: "Natural wool — verify",
        pile: "Loop / twist",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb: "PLACEHOLDER collection. Replace with real data.",
        roomset: { label: "Roomset · Natureborn (placeholder)", a: "#cabfa6", b: "#5a5343" },
        colours: [
          c("Colour 1", "N01", "#e0d7bf"),
          c("Colour 2", "N02", "#b8af8f"),
          c("Colour 3", "N03", "#8d7f64"),
          c("Colour 4", "N04", "#585040"),
        ],
      },
    ],
  },

  {
    id: "victoria",
    name: "Victoria Carpets",
    tagline: "Design Floors & more.",
    heritage:
      "PLACEHOLDER — add real copy. 'Design Floors' collection supplied via WeTransfer (download before expiry).",
    real: false,
    ranges: [
      {
        id: "vic-design-floors",
        name: "Design Floors (placeholder)",
        code: "VC-DF",
        fibre: "Verify",
        pile: "Verify",
        widths: "4m / 5m",
        use: "Heavy domestic",
        blurb: "PLACEHOLDER collection. Replace with real Victoria data.",
        roomset: { label: "Roomset · Design Floors (placeholder)", a: "#c1b8a8", b: "#5f584a" },
        colours: [
          c("Colour 1", "D01", "#ddd4c2"),
          c("Colour 2", "D02", "#b8a98c"),
          c("Colour 3", "D03", "#877a61"),
          c("Colour 4", "D04", "#524b3d"),
          c("Colour 5", "D05", "#3c4a3b"),
        ],
      },
    ],
  },
];

/* Featured on the home page — pick any brand/range ids you like */
const FEATURED = [
  { brand: "westex", range: "pure-luxury" },
  { brand: "westex", range: "fine-westex-twist" },
  { brand: "westex", range: "origins-wood" },
];

const SERVICES = [
  { title: "Free home measure", body: "We visit, measure up and give you an honest, no-obligation quote." },
  { title: "Order up to 5 samples", body: "Pick your shades from any range and we'll get samples to your door." },
  { title: "Expert fitting", body: "Supplied and fitted by our own experienced team — including uplift of old flooring." },
  { title: "Special orders", body: "Bespoke colours and made-to-order ranges via the mills' special-dye services." },
];
