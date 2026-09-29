# Managing the site

Reference for the admin: what everything does and why it works that way. For
step-by-step procedures — how to answer an enquiry, how to replace a photograph
— see [`work-instructions.md`](./work-instructions.md). For the code behind it,
[`architecture.md`](./architecture.md). For moving the whole thing to another
Cloudflare account, [`handover.md`](./handover.md).

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

## What can be changed

Everything written on the site, and every photograph. By tab:

| Tab | What is in it |
|---|---|
| Enquiries | everything sent through the contact form, newest first, with a Reply button — and the form's own wording |
| Shop details | hours, phone, email, address, areas covered, the line under the logo, the footer paragraph, an optional notice across the home page, the Google Maps link, the map embed, and the four social media pages |
| About us | the small label, the opening line and the body, split into paragraphs on blank lines |
| Home page | every word on the front page — the banner heading, paragraph and both buttons, all four claims in the strip, every section heading, small label, paragraph and button, the four service cards, Google reviews and Instagram |
| Other pages | headings, paragraphs and buttons on Collections, Visit us and Contact us, plus the description under each flooring type |
| Portfolio | the wording on that page, and the jobs themselves — a photograph, a heading and a description each |
| Collections | hide, rename, the collection's own description, and its shades |
| Photos | every picture, and a caption for each — the three that make up the home page banner, the About us photograph, and the big picture on each style tile |
| Styles | which collections sit under which style, what each style is called, the line under its name, and the "What sort of carpet are you after?" heading above them |

The faint grey text in an empty box is what the site is showing now, so the
form doubles as a view of the current wording, and clearing a box restores that
rather than blanking the page.

### Leaving something blank, and switching it off

These are two different things and there are two different controls, because
one of them is undoable and the other is what you want most of the time.

**Clearing a box puts the original wording back.** That is what the faint grey
text is promising, and it means no amount of typing can leave a page with a
hole in it.

**To show nothing at all**, untick *Show this on the website* under the box.
The line disappears from the page — the heading goes with it, so there is no
empty gap where it used to be. What you have written stays exactly where it is,
so ticking it back on brings the words straight back.

Not everything has a tick. The phone number, the email address and the address
do not, because they are used in every link in the header and footer, and a
flooring shop with no phone number on its website is not a feature.

**Captions matter more than they look.** The box under each photograph is the
alt text: what a blind visitor hears, and what Google reads. "Wool twist fitted
to a staircase in Isleworth" is worth having; "photo" is not.

**The home page banner is three pictures**, listed in the Photos tab as banner 1,
2 and 3. The page cross-fades between them every six seconds, and the dots at
the bottom right let a visitor step through by hand. The words over the top
never move, so replacing any of the three is just replacing a photograph — each
has its own caption, and none of them affects the headline or the buttons.
Somebody browsing with reduced motion turned on gets the first picture and the
dots, and nothing moves on its own.

`tools/admin-e2e.mjs` types a unique marker into **every text box in the admin**,
saves, then reads all six public pages back and fails naming any field whose
marker never appeared. That is the check that a box does something — it is how
`strapline` was found to be a setting the site never rendered, and removed
rather than left as a control that changes nothing.

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

**Areas covered** shows as its own line on the Visit us page, labelled *We
cover*. It used to be glued onto the end of the paragraph above it, which is why
those words looked like part of the wording and unremovable. The box is on Shop
details and repeated on Other pages, beside the Visit us wording it sits under;
untick "Show this on the website" and the line goes.

Everything the shop can change goes through `say()` in app.js. Reading
`CONTACT.hours` directly anywhere is a value the shop cannot change, and is how
this tab came to save happily and alter nothing at all.

## The style tiles

"What sort of carpet are you after?" and the tiles under it are on the **Styles**
tab: the heading (which can be switched off), and for each style its name and the
line under it. The pictures are on the **Photos** tab, under *Style tiles*.

Until a style has its own picture it borrows one from the first collection filed
under it — which is why a style whose collections have no photograph showed an
empty frame. Uploading one fixes it for good.

A style with no collections ticked does not appear on the site at all, so the
admin does not offer boxes for its wording either. Tick a collection and they
appear.

## How much fits

| | Limit | What happens at it |
|---|---|---|
| Collections added in /admin | **1,200** |
| Photographs on the Portfolio page | **200** | the save reports what it would not take |
| Shades in one collection | **400** | same |
| The whole overlay document | **6 MB** | the save is refused with "too big" |
| One photograph | 3 MB after the browser shrinks it | the upload is refused |
| Photographs in total | no practical limit | each is its own object in R2 |

These numbers are `MAX_RANGES`, `MAX_DOC` and `MAX_PHOTO` in `worker-admin.js`,
and `MAX_RANGES` is repeated in `admin.js` for the count shown on the
Collections tab. Change one and change the other.

**The collections cap was 200 and it was reached.** Everything past the two
hundredth was dropped in `clean()` — silently, while the admin reported "Saved —
live on the site within a minute" — so the shop added collections for weeks into
a save that was throwing them away. `clean()` takes a second argument now, an
array it describes each casualty into; `handlePutSite` returns that list as
`dropped`, and the admin puts it on the screen instead of claiming success.
**Validation here may refuse something. It may not refuse it quietly.**

## Google reviews

On the **Home page** tab: the rating, how many, a link to the listing, and up to
three reviews with a name, a star count and a date. It renders nothing until
there is something in it — an empty strip is worse than no strip.

Not pulled live. Google's reviews come from the Places API, which needs a
billing-enabled key and returns five reviews that Google chooses; for a shop
with a few hundred, copying the best three across is less work than the key and
they are the three you would have picked anyway. Say the word and I will wire
it; the section reads the same shape either way.

**Only paste in reviews people have actually left.** Invented testimonials on a
real shop's website are a lie to customers and very hard to walk back.

## The enquiry form

Everything sent through the form lands in the **Enquiries** tab, newest first,
with an unread count on the tab itself. **Reply** opens the shop's own email
already addressed to the customer, with what they wrote quoted underneath.

Nothing is emailed out automatically, so the tab is worth a look each day.
There is no notification and no third party: the enquiry goes straight into the
shop's own R2 bucket and no one else's system ever sees the customer's details.

**No secret to set and nothing to configure.** Writing the enquiry to the bucket
*is* the delivery. If that write fails the visitor is told plainly that it did
not send and is offered a `mailto:` and the phone number — it never pretends to
have sent anything.

The wording of the form — its heading, the send button and the thank-you — is
edited on the same tab, under the enquiries.

### Why there is no email provider

Cloudflare's own email sending — both the `send_email` binding and the Email
Service — requires the sending domain to be a zone in the Cloudflare account.
`haris-carpets.co.uk` is at Wix, so it is not available. This is the third time
this project has hit that same wall: Cloudflare Access could not guard `/admin`
for the same reason, and WAF rate-limiting rules are zone-scoped too. All three
become available on the day the domain moves.

Every third-party alternative means a monthly account, a domain to verify, and a
customer's name, email and phone number passing through somebody else's system.
For a shop taking a handful of enquiries a week, a tab that carries a count is a
smaller thing to own and a smaller thing to explain in the privacy notice.

**If a copy by email is wanted later**, set `RESEND_KEY` (and `ENQUIRY_TO` /
`ENQUIRY_FROM` in `wrangler.jsonc`) and redeploy — a Worker cannot see a secret
added since its last deploy. The Worker will then send a copy of each enquiry as
well as storing it. A failed send changes nothing the visitor sees, because the
enquiry is already where the shop reads it. Leave the key unset and no mail is
attempted at all.

### How long they are kept

Enquiries are deleted twelve months after they arrive, by a cron in the Worker.
They are names, emails, phone numbers and messages belonging to members of the
public, and twelve months is what `public/privacy.html` promises — **if that
number moves here, it has to move there too, or the privacy notice stops being
true.** Deleting one from the tab deletes it immediately and for good.

## The enquiry notification

Nothing is emailed by default — the Enquiries tab is the delivery. A copy can be
emailed as well, and there are two ways:

- **Cloudflare's own sending**, once `haris-carpets.co.uk` is a zone in the
  account. Note the two domains: it sends **from** the website domain, which is
  the zone Cloudflare runs, **to** the mailbox domain `hariscarpets.co.uk`,
  which never moves. `ENQUIRY_FROM_ADDRESS` is that sender and is not guessed —
  deriving it from the recipient would build an address on a domain Cloudflare
  has nothing to do with, and the send would be refused. Enable Email Routing, verify `sales@hariscarpets.co.uk` as a
  destination, uncomment the `send_email` block in `wrangler.jsonc`, redeploy.
  No third party, no API key, and nothing new for the privacy policy to name —
  Cloudflare is already the one company on it. **This is the one to use.**
- **Resend**, via `RESEND_KEY`, which works today on `workers.dev`. A third
  party, so the privacy page has to say so.

The Worker prefers the binding when both exist. Either way the enquiry is
stored first and a failed send changes nothing the visitor sees.

Cloudflare will only send to an address that has confirmed itself as a
destination in Email Routing. That restriction is the whole reason this is safe
to switch on: the Worker cannot be made to mail anybody else.

## Counting visitors

Off. `ANALYTICS.token` in `public/data.js` is an empty string, nothing
third-party loads, and `public/privacy.html` says so.

To switch it on there are **four** values, and the admin's Visitors tab names
whichever is still missing rather than showing an empty page:

| Where | What |
|---|---|
| `ANALYTICS.token` in `public/data.js` | the beacon that does the counting |
| `CF_ACCOUNT_ID` var in `wrangler.jsonc` | which account — it is in the dashboard URL |
| `CF_SITE_TAG` var in `wrangler.jsonc` | which site in Web Analytics: the same value as the beacon token |
| `CF_ANALYTICS_TOKEN` **secret** | an API token with **Account Analytics: Read** |

Only the last is a credential. Set it with `npx wrangler secret put
CF_ANALYTICS_TOKEN` **and redeploy** — a Worker cannot see a secret added since
its last deploy.

#### If the tab still says `CF_ANALYTICS_TOKEN`

It names each missing value separately, so a message listing **only** the token
means the other two arrived — the deployment is current and the fault is the
secret alone. Four things it is, in the order worth checking:

1. **The wrong Worker.** It must be on `haris-carpetsv5`, the name in
   `wrangler.jsonc`. An older Worker of a similar name will take the secret
   quite happily and never serve the site.
2. **Added as Text rather than Secret.** This is the one that looks like it
   worked. In **Settings → Variables and Secrets** the type matters: a
   plaintext variable is *erased by the next deploy*, because `wrangler deploy`
   replaces the whole `vars` block with whatever is in `wrangler.jsonc`, and
   the token is deliberately not in there. Secrets are left alone. So a token
   added as Text works until the next push and then quietly disappears.
3. **The name.** Exactly `CF_ANALYTICS_TOKEN` — no prefix, no trailing space.
4. **Not deployed.** The dashboard needs the **Deploy** button after adding;
   `wrangler secret put` does it for you.

What this message is *not* is a wrong or under-permissioned token. If the token
is present but lacks **Account Analytics: Read**, Cloudflare's own error comes
through to the screen instead — see `QUERY` below.

Put the beacon token in **and add Cloudflare Web Analytics to the privacy page
in the same commit**. `tools/smoke-test.mjs` fails if those two disagree in
either direction — a token with no mention on the policy page, or a mention
with no token.

### The Visitors tab

`/admin` → **Visitors**: visits, page views, a bar per day, the busiest pages,
countries, where people came from and what they were on, over 7, 30 or 90 days.
It exists so the shop does not need a second login to read its own numbers.

The route is `/api/admin/visitors`, in `worker-analytics.js`, **below
`identify()`** — how the shop's website is doing is the shop's business, not
something to serve to anyone who guesses the path. Answers are cached for ten
minutes per range.

`QUERY` in that file is the thing most likely to need correcting: Cloudflare
answers **200 with an `errors` array** when a field name is wrong, so a status
check alone would show an empty tab and call it success. Whatever Cloudflare
says comes through to the screen instead.

Why Cloudflare Web Analytics rather than Google: it sets **no cookies**, stores
nothing on the visitor's device and does not follow anyone between sites, so it
needs no consent banner under PECR. It reports page views, which pages,
referrers, device type and **country** — country from the IP address, the way
every web server sees it, not a location in any finer sense.

What it cannot do is name a visitor or tell you a street. If anyone asks for
that, the answer is that this site does not do it and would need a consent
banner and a very different privacy policy before it could.

### The wording to put on the privacy page

Written and agreed in advance so switching it on is one commit rather than a
conversation. In `public/privacy.html`, add this section straight after
*How your information is handled*:

```html
    <h2>Counting visits</h2>
    <p>We use <strong>Cloudflare Web Analytics</strong> to see how many people visit the
      site and which pages they look at. It tells us the number of visits, which pages
      were viewed, which site or search someone arrived from, the kind of device they
      used, and the country they were in.</p>
    <p>It <strong>sets no cookies</strong> and stores nothing on your device, it does not
      follow you to other websites, and it does not tell us who you are. The country
      comes from your IP address, which every website you visit can see. We cannot
      identify you from any of it.</p>
```

and change the first bullet of *Cookies and saved preferences* from
"does not intentionally use advertising or analytics cookies" to:

```html
      <li>The public website uses <strong>no advertising or analytics cookies</strong> —
        the analytics described above work without them. The one cookie this site can set
        is for shop staff signing in to update it, and it only exists after signing in.</li>
```

Both of those go in the same commit as the token, or `smoke-test.mjs` fails —
which is the point of it.

## Instagram

The grid sits high on the home page, under the flooring types. It fills itself
from three places, in this order:

1. **The live feed**, when `INSTAGRAM_TOKEN` is set
2. **Posts chosen by hand** on the Home page tab, when the feed is unavailable
3. **Nothing** — the section does not render

That order is the point. Instagram's Basic Display API was retired at the end of
2024, and the Graph API that replaced it needs a Business or Creator account
tied to a Facebook Page, a Meta app, and a token that **expires after 60 days**.
A lapsed token emptying the front page of a shop's website is the likeliest
failure here, so the fallbacks exist to make that a soft one.

### Turning the live feed on

1. The Instagram account must be **Business or Creator** and connected to a
   Facebook Page.
2. Create an app at developers.facebook.com and add **Instagram**.
3. Generate a **long-lived access token** for the account.
4. Save it as a secret: `npx wrangler secret put INSTAGRAM_TOKEN`, then **redeploy** —
   a Worker cannot see a secret added since its last deploy.
5. If the Meta app has **Require app secret** switched on (Settings → Advanced), add
   the app secret too, as `INSTAGRAM_APP_SECRET`. With that setting on, Meta refuses
   every call that is not signed with it, however good the token is. The Worker signs
   its calls whenever that secret is present, so it is safe to set either way.

After that it looks after itself:

- a weekly cron refreshes the token, so five runs would have to fail in a row
  before it lapsed
- the refreshed token is kept in R2, because a Worker cannot write its own
  secrets — the secret is only the starting point
- the feed is cached for three hours, and the last good copy is served if
  Instagram is unreachable, so an outage shows slightly old posts rather than
  an empty row

The one thing to know: Instagram's image URLs are short-lived, which is why the
feed is refetched every three hours rather than cached for a day.

## Photographs

The **Photos** tab replaces any picture on the site: the home page banner, the
showroom, the flooring-type tiles, and every collection. Only 11 of 48
collections came with photography from the mill; the rest show a stand-in, and
a picture of that carpet fitted in a real room is worth more than any of them.

### Putting a picture on the site, start to finish

1. Sign in at `/admin` and open **Photos** — or **Portfolio**, for a finished
   job you want in the gallery.
2. Find the one you want to change. Every card shows the picture that is on the
   site right now, with a line saying where it appears. There is a search box
   for the collections, because there are 48 of them.
3. **Replace**, and pick the photograph. It uploads straight away and the card
   shows your new one within a second or two.
4. Fill in the box underneath it. That is what a blind visitor hears and what
   Google reads — "wool twist fitted to a staircase in Isleworth", not "photo".
   Leave it and the old description stays, which will now be wrong.
5. **Save changes**. Nothing is live until you do. The site picks it up within
   the minute.
6. If you change your mind, **Use the original** puts the shipped picture back.
   Your upload is not deleted, so it can be put back too.

**What makes a good one.** Landscape, not portrait — every slot on the site is
wider than it is tall, so an upright phone photo gets cropped top and bottom.
Daylight rather than the shop's ceiling lights, which push wool towards yellow.
Get far enough back that the floor is most of the frame. And a real job beats
any stock photograph, every time.

Straight off a phone is fine — the size is dealt with below.

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
| `GET /api/instagram` | public. The cached feed, or the last good copy, or nothing. |

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
    node tools/instagram.test.mjs  # the feed, and the token expiring
    node tools/enquiry.test.mjs    # the enquiry form, and what happens when it fails
    node tools/worker.test.mjs     # routing, and the R2 photo route
    node tools/analytics.test.mjs  # visitor numbers, and every way they can fail
    node tools/stub-api.mjs 8890 signed-in &
    node tools/stub-api.mjs 8891 down &
    node tools/stub-api.mjs 8892 anon &
    node tools/stub-api.mjs 8894 password &
    node tools/stub-api.mjs 8895 stale &
    node tools/stub-api.mjs 8896 anon &
    node tools/stub-api.mjs 8897 both &
    node tools/admin-e2e.mjs       # the page, and the shop when the API is down

    node tools/smoke-test.mjs http://127.0.0.1:8890   # the public pages
    node tools/seo-report.mjs http://127.0.0.1:8890  # the addresses, one by one

`smoke-test.mjs` used to want a *plain* file server, and now cannot have one.
The pages are real addresses — `/collections/lvt` is fetched, not a fragment —
and answering that with the document is a thing `python3 -m http.server`
cannot do. It runs against the stub on 8890, which does it out of the same
`worker-pages.js` the Worker uses. Where the suite needs the far end to fail
— the enquiry that cannot be delivered — it now asks the stub for that
failure (`/_enquiry?mode=fail`) instead of relying on there being no API at
all, which tests the refusal rather than the absence.

`admin.test.mjs` generates a real RSA key pair and signs real tokens, so the
verification path runs for real: a forged signature, an expired token, a token
for another application and the `alg:none` trick are all checked to fail.

The one worth keeping green above all others is in `admin-e2e.mjs`: with the
admin API returning 500, the shop still renders its full catalogue with no
errors. The generated catalogue ships with the site, so a broken overlay must
cost a customer nothing.

The second is the field sweep in the same file. It types a unique marker into
**every** box in the admin, saves, then reads all seven public pages back and
fails naming any field whose marker never appeared. That is the check that a box
does something.

It only became that check recently. `tools/stub-api.mjs` used to echo the posted
document straight back instead of running the Worker's own `clean()`, so the
sweep proved the browser had *sent* each value and nothing more — while the
Worker was silently dropping 28 of the 44 boxes on every save, because it
validated content keys with a lowercase-only slug rule and they are camelCase.
The stub now runs the shipped `clean()`. **If you ever stub the API again,
stub the transport, not the validation.**
