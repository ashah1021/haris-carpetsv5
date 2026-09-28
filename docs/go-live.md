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

## What is actually there, read off Wix on 28/09/2026

Taken from the Wix DNS panels rather than assumed. **Check it again on the day**
— this is a snapshot, not a contract.

### haris-carpets.co.uk — the one that moves

| Type | Host | Value | Do what with it |
|---|---|---|---|
| NS | @ | `ns10.wixdns.net`, `ns11.wixdns.net` | **replaced by Cloudflare's** — this is the change |
| A | @ | `185.230.63.107`, `.186`, `.171` | **drop.** Wix's servers. The Worker's custom domain replaces them |
| CNAME | www | `cdn3.wixdns.net` | **drop**, same reason |
| **MX** | @ | `mx0.123-reg.co.uk` (10), `mx1.123-reg.co.uk` (20) | **copy across exactly** — see below |
| TXT | — | none | nothing to carry |
| SRV | — | none | nothing to carry |

### hariscarpets.co.uk — the mailbox domain, not moving

**The shop's email is Microsoft 365.** That is not a guess: the MX points at
`hariscarpets-co-uk.mail.protection.outlook.com`, SPF includes
`spf.protection.outlook.com`, `autodiscover` points at `autodiscover.outlook.com`,
and there is an `MS=ms37166624` verification record. Plus:

| What | Record |
|---|---|
| Microsoft 365 mail | MX → `hariscarpets-co-uk.mail.protection.outlook.com` (10) |
| M365 verification | TXT `MS=ms37166624` |
| M365 autodiscover | CNAME `autodiscover` → `autodiscover.outlook.com` |
| SPF | TXT `v=spf1 include:spf.protection.outlook.com …` |
| **DMARC** | TXT `_dmarc` → `v=DMARC1; p=reject; …; adkim=s; aspf=s` |
| DKIM | CNAMEs `s1._domainkey`, `s2._domainkey`, `sel1._domainkey`, TXT `default._domainkey` |
| something on SendGrid | CNAME `sg.` → `…sendgrid.net` |
| something on hostmice | CNAME `mail.` → `eu.hostmice.com` |
| Wix | three A records, `www` → `cdn3.wixdns.net` |

**None of it needs touching for go-live** — this domain is not moving. Two
things to take from it anyway:

- **`p=reject` with strict alignment.** That is the strongest DMARC setting
  there is, and it is already live. It applies to mail claiming to be *from*
  this domain, which is why the website must never send as
  `@hariscarpets.co.uk` — it would be rejected outright, not junked.
- **Moving this domain later is a Microsoft 365 migration**, not a DNS copy.
  Every record above has to arrive intact and in the right order or the shop's
  email breaks. Worth its own afternoon, with the M365 admin open, and nowhere
  near go-live day.

In Wix it is set to *"Redirects to primary domain"*, and that redirect is Wix's
doing. **It stops working the day the Wix site is cancelled**, so point this
domain at the new site before cancelling anything.

---

## The website domain has a mailbox on it. This changes things.

I said earlier that mail was lower-risk here because the shop's mailbox is on
the other domain. **The inventory proves that wrong**, which is exactly what an
inventory is for: `haris-carpets.co.uk` has its own MX records, pointing at
123 Reg's mail servers. Something at `@haris-carpets.co.uk` can receive mail.

**So, before anything else, answer this: does anybody actually use an email
address at `@haris-carpets.co.uk`?** Check the 123 Reg mailbox list. Ask Hari.
The answer decides the next step and nothing else does.

### If nobody uses it

Easy. Copy the MX records across anyway — it costs nothing and keeps the door
open — and carry on. Cloudflare can take over that domain's mail later without
anybody noticing.

### Either way: give the sending domain an SPF record

`haris-carpets.co.uk` has **no TXT records at all** today, so nothing vouches
for mail sent from it. The notification goes to a Microsoft 365 mailbox, and
M365 is unsympathetic to unauthenticated mail — it would arrive in Junk, or
not at all.

So when step 5 is switched on, add to the `haris-carpets.co.uk` zone:

```
TXT   @        v=spf1 include:_spf.mx.cloudflare.net ~all
TXT   _dmarc   v=DMARC1; p=none; rua=mailto:sales@hariscarpets.co.uk
```

`p=none` on purpose: it asks for reports without rejecting anything while the
setup is new. Tighten it later if anybody cares to. Enabling Email Routing
offers to add the SPF record itself — take the offer, and check afterwards that
it is the only `v=spf1` record on the domain, because two is the same as none.

**Do not copy the other domain's DMARC record across.** It is `p=reject` and
points its reports at Wix.

### If somebody does use it

Then there is a conflict worth knowing about **before** you hit a button:

> **Turning on Cloudflare Email Routing publishes Cloudflare's own MX records
> for the zone.** That is how it receives mail — and it means mail for that
> domain stops going to 123 Reg. Step 5 of this runbook asks you to enable
> Email Routing, so doing it on a domain with a live 123 Reg mailbox diverts
> that mailbox.

Two honest ways out, and it is a decision for Hari, not a technical one:

- **Keep the 123 Reg mailbox.** Copy the MX records to Cloudflare, do **not**
  enable Email Routing on this zone, and send the enquiry notification through
  Resend instead (`RESEND_KEY`). Costs a third party in the privacy policy.
- **Move that mailbox to Cloudflare forwarding.** Email Routing forwards
  `whatever@haris-carpets.co.uk` straight to `sales@hariscarpets.co.uk`, free,
  and the Cloudflare sending in step 5 then works. The catch: it becomes
  *forwarding*, not a mailbox — nobody can send **from** that address any more.
  Fine if it only ever received; not fine if Hari sends from it.

There is no rush on this. **The website can go live without touching mail at
all**: copy the MX records across unchanged, skip step 5, and enquiries still
land in the admin's Enquiries tab exactly as they do now.

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

> **The inventory above already did this for `haris-carpets.co.uk`.** The one
> thing it found that matters is the pair of MX records pointing at 123 Reg.
> Re-check them on the day in case anything has changed since.

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
things.** Compare what it imported against the table above, record by record,
and fix it **before** you change the nameservers. Specifically:

- **both MX records must be there** — `mx0.123-reg.co.uk` priority 10 and
  `mx1.123-reg.co.uk` priority 20, and set to **DNS only**, not proxied.
  Cloudflare cannot proxy mail and will not try, but check the cloud is grey
- the three `185.230.63.x` A records and the `www` CNAME can stay for now; they
  point at Wix, which is still the live site until you add the custom domain in
  step 3. That step replaces them

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

**Read the mailbox section at the top of this document first.** If anybody
receives mail at `@haris-carpets.co.uk`, enabling Email Routing here diverts it
away from 123 Reg. If that is unresolved, skip this whole step — the website
does not need it, and enquiries land in the admin either way.

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
- [ ] **mail to `@haris-carpets.co.uk` still arrives** — send one to whatever
      address 123 Reg has on that domain and watch for it. This is the one the
      inventory turned up, and the only part of the move that can cost the shop
      something on the day
- [ ] `sales@hariscarpets.co.uk` still works, in and out — it should be
      completely unaffected, since that domain never moved

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
