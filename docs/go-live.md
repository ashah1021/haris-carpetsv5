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

#### Rechecked 06/10/2026 — it still serves the old site

The shop asked why this address shows the old website. Measured, not guessed:

| | |
|---|---|
| Nameservers | `ns10.wixdns.net`, `ns11.wixdns.net` — **not Cloudflare** |
| A records | `185.230.63.107 / .171 / .186` — Wix's own hosting |
| `www` | CNAME → `cdn3.wixdns.net` |

So it is not a redirect that has broken. The domain resolves to Wix, and Wix
serves the old site from it. Nothing about it passes through Cloudflare or this
Worker, and no change in this repository can reach it.

Mail on it is untouched and working: MX still Microsoft 365, SPF still
`include:spf.protection.outlook.com -all`, `autodiscover` still Outlook,
`_dmarc` still Wix's `p=reject` with strict alignment.

**It costs nothing in search.** A `site:hariscarpets.co.uk` query returns no
pages, so Google has not indexed it: there is no duplicate of the old site
competing with the new one, and no ranking split. This is an experience fix for
whoever types the old address or has it on a card — worth doing, not urgent.

Two ways to do it, and the order matters more than the method:

1. **At Wix, no DNS move.** The redirect setting is already there and pointing
   at the wrong place. Changing where it points is the whole job, and the
   shop's email never comes near it. It dies with the Wix subscription.
2. **Move the zone to Cloudflare** — the full procedure, the record
   inventory, the verification and the rollback are in
   [`mailbox-domain-move.md`](./mailbox-domain-move.md). In short: a
   zone-level Redirect Rule sending
   `hariscarpets.co.uk/*` to `https://haris-carpets.co.uk/$1` as a 301 (a
   redirect-only zone needs one proxied record to answer on — the usual trick
   is an AAAA at the apex pointing to `100::`, proxied). Permanent, free, and
   it outlives Wix. But it is the Microsoft 365 migration described above:
   every record in the table lands in Cloudflare **first**, nameservers change
   **second**. Reverse those two and the shop's email stops.

---

## The mailbox on the website domain — asked, and clear

`haris-carpets.co.uk` has MX records pointing at 123 Reg, so something at
`@haris-carpets.co.uk` *could* be receiving mail. **Checked with Hari on
28/09/2026: nobody uses an address on that domain.** The shop's email is
`sales@hariscarpets.co.uk` — the other domain, on Microsoft 365, not moving.

That settles the only branch in this runbook. Cloudflare may take that domain's
mail over, which is what step 5 does:

> Turning on Cloudflare Email Routing publishes Cloudflare's own MX records for
> the zone — that is how it receives mail, and it means the 123 Reg records
> stop being used. **Here that is fine, because nothing is behind them.** On a
> domain with a live mailbox it would have diverted it.

So let Cloudflare import the 123 Reg MX records and let Email Routing replace
them at step 5. Nothing to preserve, nothing to copy by hand.

**Ask again before you enable it**, though. It is one question, and this note
is older than the day you are reading it. If a mailbox has appeared on that
domain since, stop: both ways out are written up in this file's git history.

### Still do this: give the sending domain an SPF record

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

### And a free one worth taking

With Email Routing on, `info@haris-carpets.co.uk` — or anything else at that
domain — can forward straight into `sales@hariscarpets.co.uk` for nothing. Not
needed, but it is two minutes while you are already in there, and it means the
address on the website's own domain is not a dead end.

Note what it is: **forwarding, not a mailbox.** Mail arrives at `sales@`; you
cannot send *from* the forwarded address.

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

**1b. DNSSEC — checked on 28/09/2026, and it is off.** One glance to confirm
that is still true, then move on.

In 123 Reg, look for **DNSSEC** on the domain's management page. It should say
off, or not configured. **If it has been switched on since, turn it off and
wait an hour before changing the nameservers.** The rest of this is why, and is
worth reading once even though it does not apply today.

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

- **Turn the orange clouds grey on the A records and the `www` CNAME.** The
  import arrives *Proxied*, and those records still point at Wix — so proxied
  means Cloudflare terminating TLS in front of a Wix site that is not expecting
  it, which gives a 525 or 526 and a broken site from the moment the zone goes
  active until the custom domain is added at step 3. Grey ("DNS only") leaves
  Cloudflare out of the path: Wix keeps serving exactly as before and the switch
  happens when you choose it. Cloudflare flags these itself with a warning
  triangle

- **both MX records must be there** — `mx0.123-reg.co.uk` priority 10 and
  `mx1.123-reg.co.uk` priority 20, and set to **DNS only**, not proxied.
  Cloudflare cannot proxy mail and will not try, but check the cloud is grey
- the three `185.230.63.x` A records and the `www` CNAME **stay** for now; they
  point at Wix, which is still the live site until step 3. **Step 3 does not
  replace them — it refuses to run until they are gone** (see there), so they
  are deleted then, not now
- **add nothing else yet.** SPF and DMARC come at step 5 with Email Routing,
  whose own setup offers to add an SPF record — and two `v=spf1` records on one
  domain is the same as none

**After activation, nothing visible should change.** The site still loads,
still served by Wix, still identical. That is what success looks like at this
point: DNS moved and nobody noticed. The visible switch is step 3.

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

**First delete the Wix records.** Cloudflare will not add a custom domain over
the top of them — it refuses with *"Hostname already has externally managed DNS
records (A, CNAME, etc). Delete them first"*. So, in **DNS → Records**, delete:

- the three A records for the root, `185.230.63.107`, `.186` and `.171`
- the `www` CNAME → `cdn3.wixdns.net`

**Keep both MX records.** They are the only ones that must survive this step.

Then Worker → **Settings** → **Domains & Routes** → **Add** → Custom domain,
twice:

1. subdomain left **empty**, for the root `haris-carpets.co.uk`
2. subdomain `www`

Cloudflare writes the DNS records and issues the certificate itself. A
certificate warning in the first minute or two is it still being issued, not a
fault. Then open both in a browser. **This is the moment the public sees the
new site.**

> **There is a short gap here, so do the two halves back to back.** The moment
> those A records are deleted the domain resolves to nothing, and it stays that
> way until the custom domain is live — a couple of minutes if you go straight
> through, plus a tail while caches expire. It is the only outage in this whole
> move, and it is worth a couple of minutes rather than engineering around.

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

**Nobody uses a mailbox on `@haris-carpets.co.uk` — asked and confirmed — so
this is clear to do.** Ask once more anyway; if that has changed since, read
the mailbox section at the top before going on. Skipping this whole step is
always safe: the website does not need it, and enquiries land in the admin
either way.

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
- [ ] the test notification arrived from `enquiries@haris-carpets.co.uk` — and
      **look in Junk as well as the inbox**, because the SPF and DMARC records
      above are the only things keeping it out of there
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

---

## Which commit is actually live

Cloudflare builds the site from GitHub, and the **Builds** list is noisier than
it looks. Three states cause most of the confusion, and only one of them is a
problem.

**Queued.** Waiting for the build in front of it. Workers Builds runs one at a
time, so pushing three commits in ten minutes gives you a short traffic jam.
Nothing is wrong; give it a few minutes.

**Cancelled.** Superseded — a newer commit for the same branch arrived while
this one was still waiting, so Cloudflare dropped it in favour of the newer
code. Also nothing wrong: the newer build includes everything the cancelled one
carried.

**Skipped.** Cloudflare decided not to run it at all. Two reasons matter:

- *The branch is not built.* Once **Settings → Builds → Branch control** is set
  to build `main` only, every push to a working branch shows as Skipped.
  That is correct and expected — a working branch is not what gets deployed. Before branch control is set, every push builds **twice**, once per
  branch, which is where the queue comes from.
- *The commit was superseded.* Same as Cancelled, recorded differently.

A skipped build of a **working branch** is fine. A skipped build of **`main`**
is the one to look at, because it means the newest code was never deployed.

### Reading it off, not guessing

The Builds list says what was *attempted*. The **Deployments** list says what is
*serving*. The top row of Deployments is the live code — and the "Version ID"
there is Cloudflare's own identifier, not a git commit, so do not try to match
it against GitHub. Match the **commit hash** shown beside it instead, and
compare that against the newest commit on `main`.

### Never press Retry on an older build

Retry re-runs *that commit* and deploys it. Retrying a build from an hour ago
puts hour-old code over everything merged since — a time machine, not a
refresh. If the newest commit needs building, push a commit; an empty one is
enough:

```
git commit --allow-empty -m "Rebuild" && git push -u origin main
```

### Why it matters here

Most commits only change files under `public/`, and a stale deployment just
means an old page. Two do not:

- the notification email lives in `worker-enquiry.js`. Deploy a commit from
  before that was fixed and enquiries still land in the **Enquiries** tab —
  nothing is lost — but no email is sent, and nothing on screen says so.
- the Visitors tab reads `CF_ACCOUNT_ID` and `CF_SITE_TAG` out of
  `wrangler.jsonc` at deploy time. An old deployment reads old values.

So after any change to a Worker file, check Deployments and confirm the commit
hash, rather than assuming a green build was the last word.
