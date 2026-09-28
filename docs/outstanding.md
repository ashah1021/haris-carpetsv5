# Outstanding

Parked deliberately, not forgotten. The transfer checklist is separate — see
[`handover.md`](./handover.md).

## Search

- **The pages are hash routes, so Google indexes one page.** `#/collections`,
  `#/about` and the rest are all the same document to a crawler — everything
  after the `#` is not part of the URL as far as indexing goes. Titles,
  descriptions and the sitemap are all correct now, but they cannot change
  that: the site competes in search as a single home page.

  The fix is real paths — `/collections/carpets` instead of
  `#/collections/carpets` — which needs three things: `history.pushState` in
  the router, every internal link rewritten, and the Worker serving
  `index.html` for any path it does not recognise so a refresh or a direct
  visit works. Perhaps half a day including the test suites, and it turns one
  indexable page into nine. Worth doing before spending anything on ads.

- **Opening hours are not in the structured data**, deliberately: the hours in
  `data.js` are still a placeholder, and hours are the one thing Google prints
  as fact. Add `openingHoursSpecification` to the JSON-LD in `index.html` once
  the real hours are confirmed — it is what puts "Open until 5:30" beside the
  shop in a local result.

- **Register the site in Google Search Console** and submit
  `https://haris-carpets.co.uk/sitemap.xml`. It is also where you find out
  whether Google has picked up the favicon and the structured data, rather
  than guessing.

## Before handover
- **Decide about `hariscarpets.uk`**, which expires **23/10/2026**. It is one of
  three domains at 123 Reg and is not used by anything. Renewing is cheap and
  stops a name that looks like the shop's being picked up by somebody else once
  it drops; letting it go should be a decision rather than something that just
  happens. See the table at the top of [`go-live.md`](./go-live.md).
- **Point `hariscarpets.co.uk` at the website**, once it is live and settled.
  People will type it. It is the mailbox domain and the shop's email is
  **Microsoft 365** — MX, SPF, DMARC at `p=reject`, four DKIM records, an M365
  verification string, autodiscover, and a SendGrid delegation. Moving it is an
  M365 DNS migration, not a copy: its own afternoon with the Microsoft admin
  open, nowhere near go-live day. The full inventory is in
  [`go-live.md`](./go-live.md).
- **Check the Enquiries tab.** Nothing is emailed out when somebody sends the
  form: the enquiry lands in the admin, on the first tab, with a count of the
  unread ones on the tab itself. Nothing tells the shop it is there, so it needs
  looking at daily. There is no secret to set and no account to open — see the
  enquiry section of `docs/admin.md`, including how to add an emailed copy later
  if the tab alone turns out not to be enough.
- **Rotate the R2 API key pair.** The credentials were pasted into a chat
  transcript, so treat them as burned. Cloudflare dashboard → R2 → Manage API
  tokens. Then update `~/.config/rclone/rclone.conf` and any local env vars.
- **Hari to confirm the style assignments** in the `STYLES` table at the top of
  `public/data.js`. The customer-facing journey — Easy clean, Wool twist,
  Velvet, Loop, Natural — is only as good as which ranges sit under each. The
  supplier dump carried colour and nothing else: no fibre, no pile
  construction. Entries are marked in the table:
    - `[name]` the range name says it (Bouclé is a loop) — safe
    - `[seen]` read off the swatch photograph — loop, rib and smooth pile are
      unmistakable at tile resolution — safe
    - `[ask]` **assigned from what these ranges usually are and not checked
      against a spec sheet.** There are eight, all Cormar. Fibre is the weak
      spot and it is exactly what "Easy clean" turns on, so a wrong one is a
      claim about stain resistance that the swatch book does not back.
  A range in no style is not lost — it still appears under its collection and
  in every filter — so it is safe to remove an assignment you are unsure of.
- **Stripes & patterns is deliberately empty.** The old site had that square,
  but nothing in the supplier photography is unambiguously striped and
  inventing one would put a claim on the site we cannot support. Add range ids
  to the `pattern` style in `STYLES` and it appears; leave it and it does not.
- **The visualiser is switched off** (`FEATURES.visualiser` in `public/data.js`).
  The shop did not want it. Its code is untouched and still sellable on its own;
  turning it back on is that one word, and the smoke test re-arms its checks
  automatically when it is.

## Waiting on Hari

- **The Instagram access token.** The home page pulls the live feed when
  `INSTAGRAM_TOKEN` is set; until then it shows whichever posts were chosen by
  hand in /admin, and nothing at all if none were. Getting the token needs the
  account owner: it has to be a Business or Creator account connected to a
  Facebook Page, then a Meta app, then a long-lived token — see the Instagram
  section of `docs/admin.md`. Once it is set with
  `npx wrangler secret put INSTAGRAM_TOKEN` the weekly cron keeps it alive on
  its own.
- **Real Google reviews.** The rating, the count and the quotes are entered in
  /admin and the section does not appear until they are. Copy them from the
  shop's own listing — nothing invented.
- **Two of the three banner pictures are stand-ins.** Banner 1 is the living
  room the site shipped with; banners 2 and 3 are the Carpets and Wood tile
  photographs reused, so the same picture appears twice on the home page until
  they are replaced. Three photographs of Hari's own jobs, landscape, dropped
  into the Photos tab fixes it — no code change.
- **The Portfolio page is empty until Hari adds jobs.** Nothing is shipped for
  it on purpose — a portfolio of stock photography would be a lie — so the page
  currently says the gallery is being put together and points at the showroom.
  Photos, headings and descriptions all go in the Portfolio tab.
- **The rest of the "Supplied and fitted properly" wording.** Hari said the copy
  there is still to be decided. Every part of that section is now a box in the
  admin, so he can write it himself whenever he settles on it.

## Waiting on the supplier
- **61 Cormar shades are missing**, across six ranges: Zenith, Natural Berber
  Twist, Silken Serenity, Trilogy, Inglewood Saxony, Primo Naturals. Their
  files are named by product code only (`ZENIALAB4S_Overhead.jpg`), so there is
  no colour name to read and guessing one is worse than leaving it out. The
  swatch photographs and measured hexes are already extracted — supply a Cormar
  code-to-name list and rerunning `tools/build-catalogue.py` adds all 61.
- **Westex roomsets.** Westex sent swatches only, so their ranges still show
  stand-in photography while Cormar and Hugh Mackay show real supplier shots.
- **Victoria shades are indicative.** No colour chips arrived, so those hexes
  are read off roomset floors. Each range says so in its blurb; a swatch book
  would upgrade them. Spot-checking the 49 recovered shades against their
  photographs, most are close, but a few carry the room's colour cast — Latte
  and Sesame both read green off a green-lit shot, and Wenge is a dark wood
  showing as mid-brown. The catalogue tile crops to the floor in the photograph
  rather than painting the measured hex, so what a customer sees is the real
  floor; the hex only drives which colour filter the shade falls under, and for
  those three it puts them in the wrong one.
- **EasiSisal has no shade names.** Hugh Mackay named every EasiSisal file
  after the shot — `landscape.jpg`, `outdoor.jpg`, `portraits.jpg` — so there
  is no colour in the filenames at all. The range had been listing "Landscape",
  "Outdoor" and "Portraits" as if they were shades; it now shows its
  photography and says the book is in the showroom. Ask Hugh Mackay for the
  shade list.

## Content
- Opening hours are still a `TODO` in `public/data.js` — "Mon–Sat · Sun by
  appointment" is a guess. The shop can correct it on the Shop details tab
  without a deploy, but the shipped default should be right too.
- `FEATURES.samples` is off pending confirmation that Hari's offer a postal
  sample service.
- No stairs scene in the visualiser: the supplier packs contain no staircase
  photograph, and the AI stand-in needs a hand-cut mask (see
  `docs/photography.md` for why the automatic route cannot do it).
