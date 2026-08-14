# Outstanding

Parked deliberately, not forgotten.

## Before handover
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
- **Set `FEATURES.visualiser = false`** in `public/data.js` if the visualiser is
  being sold separately rather than included. That hides every entry point; see
  the header of `public/visualiser.js`.

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
- Opening hours are still a `TODO` in `public/data.js`.
- The enquiry form is a demo — wire it to Formspree or Netlify Forms.
- `FEATURES.samples` is off pending confirmation that Hari's offer a postal
  sample service.
- No stairs scene in the visualiser: the supplier packs contain no staircase
  photograph, and the AI stand-in needs a hand-cut mask (see
  `docs/photography.md` for why the automatic route cannot do it).
