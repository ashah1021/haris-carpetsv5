# Managing the site

There are two catalogues, and knowing which is which explains everything else.

The **generated catalogue** (`public/data.js`) is built from the suppliers' own
swatch photography by the scripts in `tools/`. Every colour in it was measured
off a photograph rather than typed, which is why it is accurate. It is never
edited by hand and never edited from the admin.

The **overlay** is everything the shop changes: a discontinued range, a shade
that is out of stock, a new collection, opening hours, which range sits under
"Easy clean". It lives as one JSON document in R2 and the site merges it over
the generated catalogue when a page loads.

They never collide. The pipeline can regenerate the whole catalogue without
touching a word the shop has written, and the shop can change the site without
waiting for a deploy.

## Nothing is ever deleted

Hiding a collection or a shade takes it off the site and leaves everything else
alone. That matters because a customer's saved shortlist and any link they have
shared are built from the shade's key — deleting one would quietly empty
somebody's list. Unhide and it comes back exactly as it was.

## Adding a shade

Adding a shade means uploading a photograph of the swatch. The browser measures
the colour from it using the same rule as the pipeline: the median of the middle
of the frame, median rather than average so the label, the edge of the card and
any shine on the pile are ignored.

That is not a nicety. A colour picker would let anyone put a guessed colour into
a catalogue where every other entry was measured, and the difference would not
show until a customer ordered the wrong carpet. `tools/admin-e2e.mjs` checks the
browser's measurement against the pipeline's on the same photograph and fails if
they drift more than 2/255 apart.

Photograph the swatch flat, filling the frame, in daylight. The browser shrinks
the image before uploading, so a phone photo is fine — and re-encoding it also
strips the EXIF, which on a phone includes where the picture was taken.

## Setting up sign-in

Sign-in is Cloudflare Access: Hari enters his email and Cloudflare sends him a
code. There is no password for the shop to keep or for anyone to reset.

Until it is configured the admin API answers 503 and the page says so. It fails
closed on purpose — an unconfigured admin refuses everyone rather than admitting
everyone.

1. In the Cloudflare dashboard, open **Zero Trust**. Choose a team name if you
   have not before; that gives you a team domain like
   `hariscarpets.cloudflareaccess.com`.
2. **Access → Applications → Add an application → Self-hosted.**
   - Path: `haris-carpets.co.uk/admin` — and add a second application for
     `haris-carpets.co.uk/api/admin`, or one covering both.
   - Add a policy: **Allow**, with the rule **Emails** and Hari's address.
     Add anyone else who should get in.
3. Copy the application's **Audience (AUD) tag** from its overview page.
4. Put both values in `wrangler.jsonc` under `vars`:
   - `ACCESS_TEAM_DOMAIN` — `hariscarpets.cloudflareaccess.com` (no `https://`)
   - `ACCESS_AUD` — the AUD tag
5. Deploy.

Neither value is a secret. The team domain is public and the AUD tag only names
the application. What keeps people out is the signature check in
`worker-admin.js`, which verifies every token against Cloudflare's published
keys — so a request that reaches the Worker without passing through Access is
rejected even though it carries the right-looking header.

The dashboard moves things around from time to time; the shape above is what to
look for rather than an exact set of clicks.

## What is protected, and how

| | |
|---|---|
| `GET /api/site` | public. The overlay the shop has saved — the same data the site shows anyone. |
| `GET /api/admin/whoami` | signed in. Used by the page to decide whether to show the forms. |
| `PUT /api/admin/site` | signed in, same-origin. Saves the whole document. |
| `POST /api/admin/photo` | signed in, same-origin. Stores one swatch photograph. |

Writes also require the `Origin` header to match the site. Access authenticates
with a cookie, and a cookie rides along on a cross-site request too, so without
that check another site could make Hari's browser save changes he never made.

Everything posted is rebuilt field by field before it is stored: unknown keys are
dropped, ids must be slugs, colours must be hex, text is truncated, and a file
stem containing a path is discarded. Only a signed-in admin can write, but a
mistake in the admin should not be able to produce a page nobody can undo.

## Tests

    node tools/admin.test.mjs      # the API, including real signature checks
    node tools/stub-api.mjs 8890 signed-in &
    node tools/stub-api.mjs 8891 down &
    node tools/stub-api.mjs 8892 anon &
    node tools/admin-e2e.mjs       # the page, and the shop when the API is down

`admin.test.mjs` generates a real RSA key pair and signs real tokens, so the
verification path runs for real: a forged signature, an expired token, a token
for another application and the `alg:none` trick are all checked to fail.

The one worth keeping green above all others is in `admin-e2e.mjs`: with the
admin API returning 500, the shop still renders its full catalogue with no
errors. The generated catalogue ships with the site, so a broken overlay must
cost a customer nothing.
