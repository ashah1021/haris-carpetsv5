# Outstanding

Parked deliberately, not forgotten.

## Before handover
- **Rotate the R2 API key pair.** The credentials were pasted into a chat
  transcript, so treat them as burned. Cloudflare dashboard → R2 → Manage API
  tokens. Then update `~/.config/rclone/rclone.conf` and any local env vars.
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
  would upgrade them.

## Content
- Opening hours are still a `TODO` in `public/data.js`.
- The enquiry form is a demo — wire it to Formspree or Netlify Forms.
- `FEATURES.samples` is off pending confirmation that Hari's offer a postal
  sample service.
- No stairs scene in the visualiser: the supplier packs contain no staircase
  photograph, and the AI stand-in needs a hand-cut mask (see
  `docs/photography.md` for why the automatic route cannot do it).
