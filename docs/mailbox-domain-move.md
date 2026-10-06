# Moving hariscarpets.co.uk — and why not to, yet

`hariscarpets.co.uk` (no hyphen) still shows the old Wix site. This is how to
change that, what it risks, and which of the two ways is worth doing.

## The one thing that is not optional

**The shop's DNS for this domain is hosted by Wix** — its nameservers are
`ns10.wixdns.net` and `ns11.wixdns.net`. Cancel the Wix subscription while that
is still true and the zone goes with it: not just the old website, but the MX
record. **`sales@hariscarpets.co.uk` would stop receiving mail**, and the cause
would not be obvious to anyone looking at the mailbox.

So Option 2 below is not a nice-to-have. It is a prerequisite for cancelling
Wix. It is simply not urgent *today* — the deadline is the cancellation, and
that date is the shop's to choose.

---

**Read this first: the small job is almost certainly the right job.** The whole
benefit here is that somebody typing the old address reaches the new site.
Google has not indexed that domain, so there is no ranking to recover and
nothing competing with the new site. Against that, the big job puts the shop's
email — the thing the business actually runs on — in play for an afternoon.

---

## What is actually on that domain

Read off public DNS on 06/10/2026. Everything below is published and visible
from outside, so the inventory needs no logins to produce — only to change.

### The mailbox — Microsoft 365. Four records, and they are the ones that matter.

| Name | Type | Value |
|---|---|---|
| `@` | MX 10 | `hariscarpets-co-uk.mail.protection.outlook.com` |
| `@` | TXT | `v=spf1 include:spf.protection.outlook.com -all` |
| `@` | TXT | `MS=ms37166624` |
| `autodiscover` | CNAME | `autodiscover.outlook.com` |

Lose the MX and mail to `sales@hariscarpets.co.uk` stops arriving — within
minutes, and senders get bounces. Lose the SPF and outgoing mail starts being
junked. Lose `MS=` and Microsoft may eventually consider the domain
unverified. Lose `autodiscover` and Outlook clients stop configuring
themselves, which is an annoyance rather than an outage.

**Microsoft 365 DKIM is not set up.** There are no `selector1`/`selector2`
CNAMEs pointing at `onmicrosoft.com`. The domain's outgoing mail is protected
by SPF alone.

### Wix's own email machinery — and this is the catch

| Name | Type | Value |
|---|---|---|
| `s1._domainkey` | CNAME | `…s005.ascendbywix.com` |
| `s2._domainkey` | CNAME | `…s005.ascendbywix.com` |
| `sel1._domainkey` | CNAME + TXT | `…s005.ascendbywix.com` + a DKIM key |
| `sg` | CNAME, TXT, MX | `…ascendbywix.com`, SPF `include:sendgrid.net`, MX `mx.sendgrid.net` |
| `default._domainkey` | TXT | a DKIM key |
| `_dmarc` | TXT | `v=DMARC1; p=reject; rua=mailto:postmaster@wix.com; adkim=s; aspf=s` |

**These belong to Wix, not to the shop.** `ascendbywix.com` is Wix's email
platform and the `sg` records are its SendGrid relay. The DMARC record reports
to Wix's own postmaster address. They exist so Wix can send marketing mail as
`@hariscarpets.co.uk`.

Two consequences:

- Carrying them into Cloudflare copies across records that point at a service
  the shop may be about to cancel. They would keep working until the Wix
  account goes, then quietly rot.
- The DMARC is `p=reject` with **strict alignment** — the strictest setting
  there is. Any mail claiming to be from this domain that does not align
  exactly is rejected outright, not junked. Whoever owns that record owns
  whether the shop's mail is deliverable, and today that is Wix.

### Leftovers

| Name | Type | Value | What it looks like |
|---|---|---|---|
| `mail` | CNAME / A / TXT | `eu.hostmice.com`, `51.38.118.84`, its own SPF | an older webmail host, probably dead |
| `@` | TXT | `mail.hariscarpets.co.uk CNAME srvr1.hostmice.com` | somebody pasted an instruction into a TXT record |
| `@` | A ×3 | `185.230.63.107 / .171 / .186` | Wix hosting — this is what serves the old site |
| `www` | CNAME | `cdn3.wixdns.net` | Wix CDN |

---

## Option 1 — change it in Wix. Fifteen minutes, no risk to email.

The domain is already set in Wix to *"Redirects to primary domain"*. That
setting is still there and still pointing at the old site. Changing where it
points is the entire job.

1. Wix dashboard → **Domains** → `hariscarpets.co.uk`.
2. Find the redirect/forwarding setting. Point it at
   `https://haris-carpets.co.uk`.
3. Check it in a private window.

**No DNS record changes. No nameserver change. The mailbox is never touched.**

What it does not do: it dies the day the Wix subscription is cancelled. So it
buys time rather than finishing the job — which is fine, because the deadline
is the Wix cancellation, not today.

---

## Option 2 — move the zone to Cloudflare

Permanent, free to run, outlives Wix. Also the one that can stop the shop's
email. Do it on a weekday morning, never on a Friday, and never the day before
the shop needs its inbox.

### Before you touch anything

- [ ] You can sign in to the **registrar** (where the domain is bought — 123
      Reg for the other two) to change nameservers. Without this, stop: the
      move cannot be completed or undone.
- [ ] You can sign in to **Microsoft 365 admin** (`admin.microsoft.com`), or
      you know who can and they are reachable that day. You do not need it to
      do the move. You need it if mail breaks, and "we will work it out later"
      is not a plan for a business's email.
- [ ] Screenshot the entire Wix DNS panel. Every record, including the ones in
      the tables above. This is the rollback.
- [ ] Write down the current nameservers (`ns10.wixdns.net`,
      `ns11.wixdns.net`). This is the other half of the rollback.
- [ ] Confirm whether the shop uses **Wix email marketing**. If it sends
      newsletters through Wix, the `ascendbywix`/`sg` records have to come
      across or those stop. If it does not, leave them behind.

### The move, in order

The order is the whole risk. Records first, nameservers second. Reversed, the
domain lands in an empty Cloudflare zone and the mail stops the moment DNS
propagates.

1. **Cloudflare → Add a site → `hariscarpets.co.uk`.** Free plan. Cloudflare
   scans the existing zone and imports what it can find.
2. **Check the import against the tables above, record by record.** The scan
   is good, not perfect — it misses records it cannot guess the name of.
   Everything in *The mailbox* must be present and exact. A typo in the MX is
   indistinguishable from deleting it.
3. **Set the website records to DNS-only (grey cloud) for now**, or delete the
   three Wix A records and the `www` CNAME outright — you are not keeping Wix
   hosting. For a redirect-only zone, add `AAAA @ 100::` **proxied (orange)**;
   that is Cloudflare's documented placeholder so the zone has something to
   answer on.
4. **Leave every mail record DNS-only.** MX, SPF, DKIM and `autodiscover` must
   never be proxied. Cloudflare will not proxy an MX, but it will happily
   proxy `autodiscover`, which breaks Outlook setup.
5. **Change the nameservers at the registrar** to the two Cloudflare gives you.
6. **Wait.** Cloudflare emails when the zone is active — usually minutes, up to
   24 hours. Do not change anything else while waiting.
7. **Add the redirect.** Rules → Redirect Rules → Create:
   - When incoming requests match: *Hostname* equals `hariscarpets.co.uk`
     (add a second condition for `www.hariscarpets.co.uk`)
   - Then: Dynamic redirect to
     `concat("https://haris-carpets.co.uk", http.request.uri.path)`
   - Status **301**, preserve query string on.

### Verifying — do all of these, in this order

- [ ] **Send a mail to `sales@hariscarpets.co.uk` from an outside address**
      (a personal Gmail). It must arrive. This is the test that matters.
- [ ] **Send one from `sales@hariscarpets.co.uk` to that outside address.** It
      must arrive, and not in Junk.
- [ ] Open `https://hariscarpets.co.uk/` in a private window → lands on
      `haris-carpets.co.uk`.
- [ ] `https://www.hariscarpets.co.uk/about-us-1` → lands on the new About
      page, in one hop.
- [ ] Outlook on a phone or desktop still connects without being re-set-up.
- [ ] Check again the next morning. DNS problems often show up a cache later.

### If mail stops

Do not debug. **Put the nameservers back** at the registrar to
`ns10.wixdns.net` / `ns11.wixdns.net`. The old zone is still there and still
correct; mail resumes as the change propagates. Then work out what was wrong
with the Cloudflare copy at leisure, with the screenshots.

---

## What it costs to run afterwards

| | |
|---|---|
| Cloudflare DNS + redirect rules | **£0** — the free plan covers all of it |
| Domain registration | unchanged, wherever it is registered now |
| Microsoft 365 mailbox | unchanged — the subscription has nothing to do with DNS |
| Wix | **this is where the saving is**, once the old site can be cancelled |

Nothing in this adds a recurring cost. Option 2 is what makes cancelling Wix
safe, so it pays for itself the month the Wix plan stops.
