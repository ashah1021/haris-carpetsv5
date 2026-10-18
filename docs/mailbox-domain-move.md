# The mailbox domain: hariscarpets.co.uk

`sales@hariscarpets.co.uk` is Microsoft 365. This is where its DNS lives, what
happened to it on 18/10/2026, and what is still worth doing.

---

## Current state

| | |
|---|---|
| Registrar | **to be confirmed** — see the gap below |
| DNS hosted at | **GoDaddy** (`ns39` / `ns40.domaincontrol.com`) |
| Mail | Microsoft 365, working |
| Wix | **holds nothing this domain depends on** |

Verified with an external lookup, not from a registrar panel: `mx:hariscarpets.co.uk`
at mxtoolbox.com returns `hariscarpets-co-uk.mail.protection.outlook.com` at
Microsoft's addresses, answered by `ns32.domaincontrol.com`.

### The records

| Type | Name | Value |
|---|---|---|
| MX | `@` | `hariscarpets-co-uk.mail.protection.outlook.com` (priority 0) |
| TXT | `@` | `v=spf1 include:spf.protection.outlook.com -all` |
| TXT | `@` | `MS=ms37166624` — Microsoft's domain verification |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:sales@hariscarpets.co.uk` |
| CNAME | `autodiscover` | `autodiscover.outlook.com` |

**Wix can be cancelled.** The deadline that used to hang over this — Wix hosted
the DNS, so cancelling would have stopped the mailbox — no longer applies.

---

## What happened on 18/10/2026

Worth keeping, because three of these cost hours and all three are easy to
repeat.

**The domain's DNS moved to GoDaddy without the mail records.** Setting up a
redirect for this domain moved where it was answered from. The new zone had no
MX, so incoming mail stopped. Outgoing mail kept working throughout, which is
why it looked like a partial failure and was not: **outbound mail never
consults the MX record**, so "sending works" proves nothing about DNS. Only
receiving tests it.

**Nobody got a bounce, and that was good news.** With no MX published, sending
servers fall back to the domain's A record, find a web server that does not
speak SMTP, and queue the message. Gmail retries for roughly 24–48 hours. Mail
sent during the outage was delivered once the MX went back in.

**The records went into the wrong domain first.** The shop owns three similar
names and one of them, `hariscarpets.uk`, is parked at GoDaddy. An hour went
into editing its zone. The giveaway was in the records themselves: that zone
held `CNAME www → hariscarpets.uk`, which is the ordinary "www points at the
apex" record for *that* domain and makes no sense in any other.

**The SPF record was saved without a space** — `v=spf1include:…` instead of
`v=spf1 include:…`. It looks right at a glance and parses as nothing, so
Microsoft's servers were not authorised to send as the domain.

The lesson running through all four: **a registrar panel shows what is
configured, not what is published.** Check with an external lookup
(mxtoolbox.com) against the domain name you actually mean.

---

## Still worth doing

- [ ] **Write down the registrar for each of the three domains.** GoDaddy,
      123 Reg and Wix have all been involved and nobody has recorded which
      holds what. This matters more than it sounds: if Wix is the *registrar*
      for any of them, cancelling the Wix plan risks the domain itself at
      renewal, which is far worse than losing DNS.

      | Domain | Registrar | DNS at |
      |---|---|---|
      | `haris-carpets.co.uk` | ? | Cloudflare |
      | `hariscarpets.co.uk` | ? | GoDaddy |
      | `hariscarpets.uk` | ? | GoDaddy |

- [ ] **Set up DKIM for Microsoft 365.** It has never been configured — the
      DKIM records that used to exist on this domain belonged to Wix's
      marketing platform, not the mailbox. `admin.microsoft.com` → Settings →
      Domains generates two CNAMEs. SPF plus DKIM plus DMARC is the full set,
      and it is what keeps mail out of Junk reliably.

- [ ] **Then tighten DMARC**, and not before. It is deliberately at `p=none`,
      which is monitoring only. Mail-checking tools flag that as a fault and
      recommend `quarantine` or `reject` — **ignore them until DKIM is on**.
      A reject policy with no DKIM is the setting that throws away the shop's
      own mail. Once DKIM is live and the reports show nothing legitimate
      failing, move to `p=quarantine`, then `p=reject`.

- [ ] **Tidy `hariscarpets.uk`.** It still holds a Microsoft MX, an SPF and an
      `MS=` record that were added to it by mistake and belong to a different
      domain. Harmless, but confusing to the next person.

- [ ] **Decide what `hariscarpets.co.uk` should show.** It currently serves a
      parked page or a redirect from GoDaddy's forwarding layer rather than
      from its own records, and `www` points at `hariscarpets.uk`. Neither is
      deliberate.
