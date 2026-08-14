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

## Shop details and About us

Two tabs of plain boxes: opening hours, phone, email, address, areas covered,
the line under the logo, and an optional notice across the top of the home
page. About us is separate because it is prose rather than settings — an
opening line, then the body, with a blank line between paragraphs.

The faint grey text in an empty box is what the site is showing right now, so
the form doubles as a view of the current wording. **Clearing a box restores
that original rather than blanking the page** — there is no way to end up with
an empty About page by deleting everything.

Changing the phone number changes the header button, the footer and the
contact page together, and the dial link is rebuilt from whatever was typed:
`020 8570 6502` becomes `tel:+442085706502`.

Everything the shop can change goes through `say()` in app.js. Reading
`CONTACT.hours` directly anywhere is a value the shop cannot change, and is how
this tab came to save happily and alter nothing at all.

## Photographs

The **Photos** tab replaces any picture on the site: the home page banner, the
showroom, the flooring-type tiles, and every collection. Only 11 of 48
collections came with photography from the mill; the rest show a stand-in, and
a picture of that carpet fitted in a real room is worth more than any of them.

Big files are fine. The browser shrinks a photograph before uploading — 1800px
for a site picture, 900px for a swatch — which also re-encodes it, and that
drops the EXIF a phone attaches, including where the picture was taken.

**Every upload gets a new filename and the old file is left alone.** That is
not tidiness, it is the only thing that works: `/assets/` is served with a
year's immutable cache, which is a large part of why the site is quick, so
writing a new picture over an old path would keep showing the old one for a
year — on the shop's screen as well as everyone else's. The site document
records which file each slot points at, so "Use the original" is simply
forgetting the override, and the shipped photograph comes back.

The visualiser rooms are the exception and cannot be swapped here: each needs a
floor mask cut to match it, which is a job for the tools in `tools/`.

## Trying it before any of the Cloudflare setup

    node tools/stub-api.mjs 8890

Then open <http://127.0.0.1:8890/admin/>. That serves the real site and the real
admin page against an in-memory stand-in for the API, already signed in. Every
control works — hide a collection, add one, upload a swatch and watch the colour
be measured — and the changes show on the shop at
<http://127.0.0.1:8890/index.html>. Nothing is saved when you stop the server.

This is the right way to show Hari what he is getting, and to decide whether the
wording suits him, before spending anything on Cloudflare configuration.

To see the other states:

    node tools/stub-api.mjs 8890 anon           # the sign-in gate
    node tools/stub-api.mjs 8890 unconfigured   # before Access is set up
    node tools/stub-api.mjs 8890 down           # the shop with the API broken

## Two ways to sign in, and which one you need

There are two, and they are alternatives rather than a chain. If neither is
configured, nobody gets in — an admin that opens up when its settings are
missing would be worse than one that never opens at all.

**A password** works on any hostname. That is the point of it: Cloudflare Access
can only guard hostnames in your own zones, and `workers.dev` is Cloudflare's,
not yours. While the site lives at `haris-carpetsv5.<account>.workers.dev` —
before the shop's domain is pointed here — a password is the only thing that can
protect the admin at all. Preview URLs are `workers.dev` too, so the same applies
to those.

**Cloudflare Access** is better once the real domain is in front of the Worker:
Hari signs in with a code sent to his email, there is no shared password, and
access can be granted or revoked per person.

Set the password now and add Access at go-live. Both can be on together, and
turning one off later is a config change, not a rebuild.

## Setting the site password

It is a Cloudflare **secret**, never a var and never in the repo:

- Dashboard: **Workers & Pages → haris-carpetsv5 → Settings → Variables and
  Secrets → Add → Secret**, named `ADMIN_PASSWORD`.
- Or from a terminal: `npx wrangler secret put ADMIN_PASSWORD`

Secrets are write-only once saved — nobody can read it back out of the
dashboard, so keep a copy where the shop keeps its other passwords.

**Redeploy after adding it.** A running version carries the bindings it was
deployed with, so one built before the secret existed cannot see it: the
dashboard shows `ADMIN_PASSWORD` sitting there encrypted while
`/api/admin/whoami` still reports `"password": false`. Workers & Pages →
Deployments → redeploy the latest, or push any commit. The sign-in page says
this too, because the two states are indistinguishable from the outside.

Use a long one. Four or five unrelated words is ideal: easy to read down the
phone to a fitter, and hopeless to guess. **Under 12 characters the Worker
refuses to enable password sign-in at all** and says so, rather than pretending
a short password is a door.

There is no shared counter to rate-limit on across Cloudflare's edge, so every
attempt — right, wrong or empty — costs the same deliberate half second. At two
guesses a second a five-word password is not being brute-forced.

Signing in exchanges the password for a cookie signed by the Worker and good for
12 hours. The password is never stored in the browser, and changing it signs
everybody out, because the signing key is derived from it.

## Setting up Access (once the domain points here)

Sign-in is Cloudflare Access: Hari enters his email and Cloudflare sends him a
code. There is no password for the shop to keep or for anyone to reset.

Until it is configured the admin API answers 503 and the page says so. It fails
closed on purpose — an unconfigured admin refuses everyone rather than admitting
everyone.

1. In the Cloudflare dashboard, open **Zero Trust**. Choose a team name if you
   have not before; that gives you a team domain like
   `hariscarpets.cloudflareaccess.com`.
2. **Access → Applications → Add an application → Self-hosted.**
   - Path: `haris-carpets.co.uk/admin` — **that path only. Do not put Access in
     front of `/api/admin`.** Access answers an unauthenticated request with a
     redirect to its login page, which is right for somebody opening a page in
     a browser and wrong for a `fetch` from JavaScript: the admin would receive
     an HTML login form where it expected JSON, and report a broken site rather
     than "please sign in". The API is protected by the Worker instead, which
     verifies the same token and can answer 401 properly. Signing in at
     `/admin` sets the cookie for the whole domain, so the API calls carry it.
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
| `POST /api/admin/login` | public by necessity, same-origin. Exchanges the password for a 12-hour signed cookie. |
| `GET /api/admin/whoami` | signed in. Used by the page to decide whether to show the forms. |
| `PUT /api/admin/site` | signed in, same-origin. Saves the whole document. |
| `POST /api/admin/photo` | signed in, same-origin. Stores one swatch photograph. |
| `POST /api/admin/upload` | signed in, same-origin. Stores a photograph under a fresh name in `uploads/`. |

Writes also require the `Origin` header to match the site. Access authenticates
with a cookie, and a cookie rides along on a cross-site request too, so without
that check another site could make Hari's browser save changes he never made.

Everything posted is rebuilt field by field before it is stored: unknown keys are
dropped, ids must be slugs, colours must be hex, text is truncated, and a file
stem containing a path is discarded. Only a signed-in admin can write, but a
mistake in the admin should not be able to produce a page nobody can undo.

## When the sign-in page won't let you in

Open `/api/admin/whoami` on the site directly. The reply says which of the three
it is:

| What you see | What it means |
|---|---|
| no `methods` field at all | the deployed Worker is older than the admin page — the build hasn't caught up |
| `"methods":{"access":true,"password":false}` | `ADMIN_PASSWORD` isn't set — **or is set but the running version predates it, so redeploy** |
| `503` and a message about 12 characters | the password is set but too short |

The page checks the same thing and says so in words, so you should not normally
need this — but it is the quickest way to be certain.

## Tests

    node tools/admin.test.mjs      # the API, including real signature checks
    node tools/stub-api.mjs 8890 signed-in &
    node tools/stub-api.mjs 8891 down &
    node tools/stub-api.mjs 8892 anon &
    node tools/stub-api.mjs 8894 password &
    node tools/stub-api.mjs 8895 stale &
    node tools/stub-api.mjs 8896 anon &
    node tools/admin-e2e.mjs       # the page, and the shop when the API is down

`admin.test.mjs` generates a real RSA key pair and signs real tokens, so the
verification path runs for real: a forged signature, an expired token, a token
for another application and the `alg:none` trick are all checked to fail.

The one worth keeping green above all others is in `admin-e2e.mjs`: with the
admin API returning 500, the shop still renders its full catalogue with no
errors. The generated catalogue ships with the site, so a broken overlay must
cost a customer nothing.
