# Go-live: moving haris-carpets.co.uk onto this site

The day the domain stops pointing at Wix and starts pointing here.

Do it on a **weekday morning**, not a Friday afternoon. Nothing below is hard,
but two of the steps take hours to propagate and one of them is the shop's
email — you want to be awake and reachable while it settles.

[`handover.md`](./handover.md) is the wider transfer runbook; this is just the
switch-over.

---

## Three domains, and only one of them moves

All three are registered at 123 Reg. They are **not** interchangeable, and the
difference matters more than anything else on this page:

| Domain | What it is | What happens to it |
|---|---|---|
| **haris-carpets.co.uk** | the website — the one Hari wants | **moves to Cloudflare** |
| **hariscarpets.co.uk** | the **mailbox**: `sales@hariscarpets.co.uk` | **do not touch it** |
| **hariscarpets.uk** | unused, expires 23/10/2026 | decide separately, below |

> **Move only the hyphenated one.** `hariscarpets.co.uk` carries the shop's
> email. Changing its nameservers means recreating its MX records correctly at
> Cloudflare first, and getting that wrong takes the shop's email down — the
> one failure in this whole project that costs real money the same day.
> There is no reason to move it to put the website live. Leave it alone.

The two never meet, and they do not need to: mail arrives at the mailbox domain
exactly as it does today, and the website answers on the hyphenated one.

### The other two, once the website is up and settled

Neither is urgent, and neither should be done on go-live day.

**`hariscarpets.uk` expires 23/10/2026.** Decide whether to renew. It is cheap,
and a lapsed domain that looks like the shop's name can be registered by
anybody once it drops. Renewing is the low-risk answer; letting it go is a
decision, not an oversight.

**People will type `hariscarpets.co.uk` into a browser** and get whatever is
there now. Pointing it at the website is worth doing — but it is the mailbox
domain, so it is a careful job for a quiet week: inventory its MX, SPF and DKIM
records first, move it to Cloudflare with those recreated exactly, confirm mail
still flows, and only then add the redirect. Not on the day the site goes live.

---

## Who holds what

Three different companies, and knowing which does what is most of the job:

| | Does | What changes |
|---|---|---|
| **123 Reg** | **registrar** — owns the registration and decides which nameservers the world is told to ask | **one setting: the nameservers** |
| **Wix** | **DNS host** today — 123 Reg points at Wix's nameservers, so every record lives in the Wix dashboard | stops being consulted the moment the nameservers move |
| **Cloudflare** | becomes the DNS host, and serves the site | everything moves here |

So: **the records are copied out of Wix, and the one change is made at 123 Reg.**
Nothing is typed into Wix at all.

**You do not need to transfer the domain away from 123 Reg.** Registration can
stay there indefinitely; only the nameservers move. Transferring is a separate,
optional decision for another day.

---

## Before the day

**1. Know what the domain does today besides the website.**

This is the step everybody skips and the one that breaks things. In the Wix DNS
panel, write down **every** record, not just the ones you recognise. What
matters most:

- **MX records** — the shop's email. `sales@hariscarpets.co.uk` is a *different
  domain* (no hyphen), but check anyway: anything at `haris-carpets.co.uk` that
  receives mail dies if its MX records do not come across.
- **TXT records** — SPF, DKIM, and any verification strings for Google Business,
  Meta or Microsoft. Deleting one silently un-verifies something weeks later.
- Anything on a subdomain — `mail.`, `ftp.`, `shop.`, `www.`

Take a screenshot of the whole list. You cannot get it back from Wix once the
nameservers have moved.

> **The shop's mailbox is on a different domain**, and that domain is not
> moving — see the table at the top. So mail is lower-risk here than in a usual
> nameserver move. Still check whether *anything* at the **hyphenated** domain
> receives mail before you move it: if `info@haris-carpets.co.uk` or similar
> has ever been used, its MX records have to come across.

**1b. Check whether DNSSEC is on. This one breaks the domain outright.**

In 123 Reg, look for **DNSSEC** on the domain's management page. If it is on,
**turn it off and wait an hour before changing the nameservers.**

DNSSEC signs the answers Wix gives. Move the nameservers with it still on, and
the world is told to expect Wix's signatures from Cloudflare's servers, does
not get them, and stops resolving the domain **completely** — website and email
both, with no partial failure to warn you. It is the single most common way a
nameserver move goes badly wrong, and the fix takes hours to propagate.

You can turn it back on from Cloudflare's side afterwards, once the zone is
active, if you want it.

**2. Check the current site still works.** The `workers.dev` address, right
through the checklist in §6 of [`handover.md`](./handover.md). Moving a domain
onto a broken site makes two problems at once.

**3. Have the Wix registrar login to hand**, not just the Wix site login. The
nameserver change happens wherever the domain is *registered*.

---

## On the day

### 1. Add the site to Cloudflare

Cloudflare dashboard → **Add a site** → `haris-carpets.co.uk` → Free plan.

Cloudflare scans the existing DNS and imports what it finds. **It will miss
things.** Compare what it imported against the screenshot from step 1, record
by record, and add anything missing **before** you change the nameservers.

### 2. Change the nameservers — at 123 Reg, not at Wix

Cloudflare gives you two nameservers, something like `ana.ns.cloudflare.com`
and `bob.ns.cloudflare.com`. They are specific to this account — use the ones
on screen, not any you have seen elsewhere.

In **123 Reg**: log in → **Domains** → **`haris-carpets.co.uk`** — the one
with the hyphen, and check it twice, the three names are a keystroke apart →
**Manage** →
**Nameservers** (sometimes under "Advanced" or "DNS & Nameservers") → choose
**use custom nameservers** → replace Wix's with Cloudflare's two → save.

Two things people get wrong here:

- **Not in Wix.** Wix's DNS editor is where the records are read *from*. It is
  not where this change is made, and editing it now changes nothing.
- **Not 123 Reg's own DNS records panel either.** 123 Reg has one, but it only
  applies when the nameservers point at 123 Reg. You are pointing them at
  Cloudflare, so that panel stays irrelevant.

This is the irreversible-feeling step, and the one that takes time: usually
under an hour, occasionally 24. Cloudflare emails you when the zone goes
active. Until then the old site keeps serving — **nothing breaks in the gap**,
because the world is still being told to ask Wix.

### 3. Point the domain at the Worker

Worker → **Settings** → **Domains & Routes** → **Add** → Custom domain:

- `haris-carpets.co.uk`
- `www.haris-carpets.co.uk`

Cloudflare creates the DNS records and the certificate itself. Give it a few
minutes, then open both in a browser. **This is the moment the public sees the
new site.**

### 4. Switch the admin to Access, and retire the password

Now that the domain is a zone, Cloudflare Access can finally guard `/admin` —
it never could on `workers.dev`, which is why there is a password at all.

1. Zero Trust → Access → Applications → Add → Self-hosted
2. Domain `haris-carpets.co.uk`, path `admin`
3. Policy: allow, Emails, Hari's address (and anyone else who needs in)
4. Copy the **Application Audience (AUD) tag**
5. Put it in `wrangler.jsonc` as `ACCESS_AUD`, with `ACCESS_TEAM_DOMAIN`
6. Deploy, then **sign in from a private window to prove it works**

Keep `ADMIN_PASSWORD` set until you have signed in through Access at least
once. They are alternatives, not a chain — deleting the password before Access
works locks everybody out of the admin, including you.

### 5. Turn the notification email on

The shop can now be emailed without a third party.

This crosses the two domains, and that is deliberate — it is the whole reason
the `ENQUIRY_FROM_ADDRESS` setting exists:

- **from** `enquiries@haris-carpets.co.uk` — the website domain, the zone
  Cloudflare now runs. Nothing has to exist at that address; it is a sender
  identity, not a mailbox
- **to** `sales@hariscarpets.co.uk` — the real mailbox, on the domain that
  never moved

1. Zone (`haris-carpets.co.uk`) → **Email** → **Email Routing** → enable
2. **Destination addresses** → add `sales@hariscarpets.co.uk` → the shop clicks
   the link in the confirmation email. Cloudflare will not send to an address
   that has not confirmed it, which is what makes this safe to switch on.
   **Confirming a destination does not change where that domain's mail goes** —
   it only grants permission to be sent to
3. Uncomment the `send_email` block in `wrangler.jsonc`
4. Deploy
5. Send a test enquiry through the contact form. It should arrive within a
   minute, with the customer's address in `Reply-To` so hitting Reply answers
   them

If it does not arrive, the Worker's log says why. Two usual causes: the
destination address has not been confirmed yet, or `ENQUIRY_FROM_ADDRESS` is
empty — the Worker refuses to guess a sender rather than inventing one on a
domain Cloudflare has nothing to do with.

> Enquiries land in the admin's **Enquiries** tab either way. The email is a
> copy, and a failed one changes nothing the visitor sees.

### 6. Switch the visitor numbers on

1. Analytics & Logs → **Web Analytics** → **Add a site** → `haris-carpets.co.uk`
2. Copy the site token out of the snippet
3. Put it in `ANALYTICS.token` in `public/data.js`, **and** add the Cloudflare
   Web Analytics wording to `public/privacy.html` — the two go in one commit,
   and `tools/smoke-test.mjs` fails if they disagree
4. Put the same value in `CF_SITE_TAG` and the account id in `CF_ACCOUNT_ID` in
   `wrangler.jsonc`
5. `npx wrangler secret put CF_ANALYTICS_TOKEN` (Account Analytics: Read), then
   **redeploy** — a Worker cannot see a secret added since its last deploy
6. Check the **Visitors** tab. It names whichever of the four is still missing

**The site token is per-hostname.** One created for the `workers.dev` address
does not count visits to the real domain, so do this after step 3, not before.

### 7. Tell the world the address changed

- **Google Business Profile** → website field → the new address
- **Instagram** and **Facebook** → link in bio
- **Meta app** (developers.facebook.com) → Privacy Policy URL
  `https://haris-carpets.co.uk/privacy.html`, Data Deletion URL
  `https://haris-carpets.co.uk/privacy.html#deleting`, and the **Terms of
  Service URL**, which still points at facebook.com and blocks publishing
- Anywhere the shop has printed or sent the `workers.dev` address

### 8. Keep the old address working

Leave the `workers.dev` route on the Worker. It costs nothing and it is what
anybody who bookmarked it during the build still has.

---

## What changes once the domain is here

| Before | After |
|---|---|
| a password on `/admin` | a code to Hari's email, no password to keep |
| rate-limit bindings, because WAF rules are zone-scoped | proper WAF rules available |
| enquiries read in the admin only | emailed to the shop as well, by Cloudflare |
| no visitor numbers | the Visitors tab, counting the real domain |

---

## After: the checklist

Work through all of it, in a browser that has never seen the site.

- [ ] `haris-carpets.co.uk` and `www.` both load, both on HTTPS with no warning
- [ ] the old `workers.dev` address still loads
- [ ] Collections → Carpets shows shades, and the filters narrow them
- [ ] the ♥ saves a shade and **My Favourites** shows it
- [ ] the Instagram grid has posts (or is absent, not broken images)
- [ ] `/privacy.html` and `/privacy.html#deleting` both load
- [ ] `/icon.svg` and `/icon-48.png` both load — Google needs the icon crawlable
- [ ] paste the address into a WhatsApp message to yourself: title, description
      and a photograph should appear
- [ ] `/admin` lets you in, through Access, from a private window
- [ ] send a test enquiry: it appears in the **Enquiries** tab **and** arrives
      by email, and **Reply** opens a message to the address you used
- [ ] the **Visitors** tab shows numbers rather than naming a missing setting
- [ ] the shop's own email still works — send one in and one out

Then, a week later:

- [ ] search Google for "hari's carpets hounslow" and check the icon appears
      beside the result (Google re-crawls on its own schedule; days, not hours)
- [ ] the Visitors tab has a week of numbers in it

---

## If it goes wrong

**The site does not load on the new domain, but the `workers.dev` address
does.** DNS or the custom domain, not the site. Check Domains & Routes, and
give it ten minutes.

**The shop's email stops.** A missing MX record. Put it back from the
screenshot in step 1 — this is why you took it.

**Nobody can get into `/admin`.** Set `ADMIN_PASSWORD` again and redeploy; the
password route works on any hostname and is the way back in.

**Everything is wrong.** Point the nameservers back at Wix, at 123 Reg, using
the values you wrote down before you changed them. The Worker and the bucket
are untouched by any of this — the site itself is never at risk, only which
address reaches it.

**The domain stops resolving at all**, website and email, nothing works. That
is DNSSEC: it was still on when the nameservers moved. Turn it off at 123 Reg
and wait — it can take a few hours to clear.
