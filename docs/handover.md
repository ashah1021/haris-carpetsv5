# Handover and transfer runbook

For moving this website — the Cloudflare account and everything hanging off it —
to Hari's Carpets or to whoever is taking it on.

Read [`architecture.md`](./architecture.md) first if you have not: this document
assumes you know what the pieces are.

---

## 0. Doing it today, in order

Four jobs. The order is not arbitrary — each one is harder or impossible after
the one below it.

### 1. Rotate the two exposed credentials. Before anything is handed to anyone. (20 min)

- **R2 API token** — Cloudflare → R2 → Manage API tokens → revoke the old pair,
  create a new one. Only `tools/sync-r2.py` uses it, from a laptop.
- **Meta App Secret** — developers.facebook.com → the app → Settings → Basic →
  Reset. If `INSTAGRAM_APP_SECRET` is set as a Worker secret, set the new value
  and redeploy.

Both were pasted into chat transcripts. Handing over an account with burned
credentials passes the problem to somebody who does not know it exists.

### 2. Point hariscarpets.co.uk at the site — the Wix way, not the zone move. (15 min)

Wix dashboard → **Domains** → `hariscarpets.co.uk` → set the redirect to
`https://haris-carpets.co.uk`. Check it in a private window.

**Do not do the zone move today.** It moves the shop's email, and doing that on
the same day you give away the account that can fix it is the worst possible
timing. The redirect gets the visible result now.

What it does not do is survive the Wix subscription being cancelled — and
neither does the shop's email, because Wix hosts that domain's DNS. That is the
deadline, and it belongs on the new owner's list with the reason attached. See
[`mailbox-domain-move.md`](./mailbox-domain-move.md).

### 3. GitHub. Before Cloudflare. (20 min, plus one deploy to prove it)

**Transferring the repository breaks the Cloudflare build connection** — it is
bound to the repo at its old address — so this has to be fixed and verified
while you still have the Cloudflare account.

1. Hari creates a free GitHub account, or names one he already has.
2. GitHub → the repo → Settings → General → Danger Zone → **Transfer
   ownership** → his username.
3. Cloudflare → Worker `haris-carpetsv5` → Settings → **Builds** → reconnect to
   the repository at its new owner, re-authorising the Cloudflare GitHub App.
4. **Push a commit and watch it deploy.** A one-line change to a comment is
   enough. Do not skip this: an unverified build connection is a site that
   silently stops updating, and nobody notices until an edit fails to appear.

If Hari cannot make a GitHub account today, add him as an **admin collaborator**
instead and transfer later. The build connection keeps working, and nothing is
lost but tidiness.

### 4. Cloudflare. Last, because it ends your access. (15 min)

**One Cloudflare login can hold several accounts, and this one does.** Under
`aryan2403.shah@gmail.com` there are four: a personal one, `astech`, `AS-Tech`
and `inaartworld`. Hari's Carpets lives in exactly one of them.

> **Do not change the email on the login.** That is the advice for somebody
> with a single account, and following it here would hand over all four —
> including other clients' work. What gets handed over is **membership of one
> account**, not the login.

**Find the right account first.** Open each one and look at the address bar: the
long string after `dash.cloudflare.com/` is the account id. The one you want is

```
7876be11f4e20ce325457563957f468b
```

That is the same id as `CF_ACCOUNT_ID` in `wrangler.jsonc`, which is what the
Visitors tab reads its numbers with. If an account's URL does not match, it is
not this site's account — close it and try the next.

**Then, in that account only:**

1. **Manage Account → Members → Invite.** Hari's email address, role **Super
   Administrator**. He needs a free Cloudflare login to accept; the invitation
   email walks him through creating one.
2. He accepts, and turns on two-factor authentication.
3. **Check he can actually see all of it** before you go: Workers & Pages →
   `haris-carpetsv5`, its Settings → Builds, R2 → the `haris-carpets` bucket,
   and the `haris-carpets.co.uk` zone under Domains.
4. **Then remove yourself from that account** — Members → your row → Remove.
   Or stay on as a member if you are still supporting the site; that is a
   commercial decision, not a technical one. Your other three accounts are
   untouched either way.

**Check the billing before you hand it over.** Whatever is attached to that
account becomes Hari's. The site is built to run on free tiers — Workers,
Cloudflare Web Analytics, Email Routing and the first 10 GB of R2 all cost
nothing — but if the photography has pushed R2 past its free storage, there is
a card on the account that needs to become his.

If member invitations are not available on that account's plan, the fallback is
§§2–4 below: rebuild in a new account. Check before assuming — it is an
afternoon of difference.

### What to hand him, once those are done

Logins for **Cloudflare**, **GitHub**, **123 Reg** (the domains),
**Meta/Facebook developer**, **Instagram**, and the **Microsoft 365** mailbox —
plus this folder of documents. Start him on
[`work-instructions.md`](./work-instructions.md); it is the only one he needs to
run the shop's website day to day.

---

## 1. What exists

Fill the right-hand column in before you start. Half the pain in a handover is
discovering on the day that nobody knows who holds an account.

| Thing | What it is | Where | Held by |
|---|---|---|---|
| **Cloudflare account** | everything below lives in it | dash.cloudflare.com | |
| Worker `haris-carpetsv5` | the site itself | Workers & Pages | |
| R2 bucket `haris-carpets` | **all photography, all the shop's content, and the enquiries** | R2 | |
| Workers Builds connection | rebuilds and deploys on every push to `main` | Worker → Settings → Builds | |
| Cloudflare Access application | guards `/admin` — **only once the domain is on Cloudflare** | Zero Trust → Access | |
| R2 API token | used by `tools/sync-r2.py` from a laptop | R2 → Manage API tokens | |
| **GitHub repository** | `ashah1021/haris-carpetsv5` — the source of truth | github.com | |
| **Meta app** | the Instagram feed on the home page | developers.facebook.com | |
| Instagram account | `@hariscarpets`, Business or Creator, tied to a Facebook Page | instagram.com | |
| **Domain** `haris-carpets.co.uk` | registered at 123 Reg, DNS on **Cloudflare** since 28/09/2026 | 123 Reg + Cloudflare | |
| **Domain** `hariscarpets.co.uk` | the mailbox domain — DNS still **hosted by Wix** | Wix | |
| Mailbox `sales@hariscarpets.co.uk` | where replies to enquiries come from | | |
| Google Business listing | the reviews are copied from it by hand | | |

Two domains that look alike and are not: the mailbox is **hariscarpets.co.uk**
(no hyphen), the website is **haris-carpets.co.uk** (with one).

### What is not needed

No email provider account, no third-party analytics, no CDN, no npm registry, no CI service
beyond Cloudflare's own build, and no framework or dependency of any kind. The
site has no third-party JavaScript. That is a deliberately small surface to hand
over, and it is worth keeping small.

---

## 2. Decide which kind of transfer you are doing

**Route A — move the existing Cloudflare account.** The new owner is added to
the account and the old one steps down, or Cloudflare support is asked to
re-point the account's ownership. Nothing is rebuilt, nothing is copied, no
downtime. Whether it is available depends on the plan and on Cloudflare's
current rules for account members, so **confirm it in the Cloudflare dashboard
or with their support before planning around it.**

**Route B — rebuild in a new Cloudflare account.** Always works. Costs an hour
or two and a short window where the old site is still live and the new one is
not yet the one people reach. Everything below is written for Route B; if Route
A works, skip to §6 and use it as a verification list.

Whichever you choose, do **§3 first**: it is the part that loses data if it is
skipped.

---

## 3. Before touching anything: take a copy of the bucket

The R2 bucket is the only thing here that cannot be rebuilt from the repository.
It holds every photograph, everything the shop has ever typed into `/admin`, and
every enquiry.

You need R2 credentials for the **old** account (R2 → Manage API tokens →
create one with Object Read permission if there is not one to hand).

```sh
# Credentials come from the environment. Never paste them into a file, a
# message or a chat window — treat any credential that has been pasted
# somewhere as burned and rotate it.
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export R2_ACCOUNT=...          # the Cloudflare account id

rclone copy \
  :s3,provider=Cloudflare,endpoint=https://$R2_ACCOUNT.r2.cloudflarestorage.com:haris-carpets \
  ./r2-backup --progress
```

Check what you have before you go further:

```sh
ls r2-backup/admin/                 # site.json, enquiries/, instagram-*.json
ls r2-backup/assets | wc -l         # the photography
du -sh r2-backup
```

`admin/site.json` is the single most valuable file in the whole project: it is
everything the shop has changed since launch, and it exists nowhere else.

> **`admin/enquiries/` is personal data** — names, email addresses, phone
> numbers and messages belonging to members of the public. Keep the copy
> somewhere private, delete it once the transfer is proven, and do not put it
> anywhere the shop would not put a customer's phone number.

---

## 4. Rebuild in the new account (Route B)

Do these in order. Nothing here changes what the public sees until step 8.

**1. Create the R2 bucket.** R2 → Create bucket → name it **`haris-carpets`**.
The name is in `wrangler.jsonc`; using a different one means editing that file.

**2. Copy the data in.** Same `rclone` command as above with the *new* account's
credentials and the direction reversed (`rclone copy ./r2-backup new:haris-carpets`).
Verify the object count matches.

**3. Connect the GitHub repository.** Workers & Pages → Create → Workers →
Connect to Git → pick `ashah1021/haris-carpetsv5`, branch `main`. Leave the
build command empty — **there is nothing to build, and adding a build step is a
known way to break this deploy.**

**4. Check the Worker's name.** It must be **`haris-carpetsv5`**, matching
`"name"` in `wrangler.jsonc`. A mismatch means the CI overrides it on every
build and a local `wrangler deploy` goes to a different Worker entirely.

**5. Set the secrets.** Worker → Settings → Variables and Secrets. They must be
**secrets, not variables** — a variable is readable in the dashboard by anyone
with access to it.

| Secret | Needed? | What it is |
|---|---|---|
| `ADMIN_PASSWORD` | **yes**, until the domain is on Cloudflare | at least 12 characters, generated not chosen. Without it, and without Access, nobody can sign in to `/admin` |
| `INSTAGRAM_TOKEN` | for the live feed | a long-lived Instagram Graph API token |
| `INSTAGRAM_APP_SECRET` | optional | only if "Require app secret" is on in the Meta app |
| `RESEND_KEY` | optional | only if you want enquiries emailed as well as stored |
| `CF_ANALYTICS_TOKEN` | optional | only for the Visitors tab — an API token with Account Analytics: Read. `CF_ACCOUNT_ID` and `CF_SITE_TAG` go with it, and those two are vars in `wrangler.jsonc`, not secrets |

> **A Worker cannot see a secret added since its last deploy.** Add them all,
> then redeploy. This has cost real hours here more than once — twice with
> `ADMIN_PASSWORD`, once with `INSTAGRAM_TOKEN`.

**6. Deploy.** Push an empty commit, or use the **Retry deployment** button.
Confirm in the deployment log that it read close to 900 files from the assets
directory and that all the bindings are listed (`PHOTOS`, `ASSETS`, `ENQUIRY_LIMIT`, `ENQUIRY_BUDGET` and
the four variables). The crons and rate-limit bindings come from
`wrangler.jsonc`; you do not create them by hand.

**7. Test it on its `workers.dev` address**, before anyone is pointed at it —
the checklist in §6.

**8. Point the domain at it.** See §5. This is the only step the public notices.

**9. Turn the old one off** once the new one has served real traffic for a few
days. Not before: the old bucket is your rollback.

---

## 5. Moving the domain to Cloudflare

`haris-carpets.co.uk` is at Wix today, which is why the site lives on a
`workers.dev` address. **Three things this project has had to work around become
possible the day it moves**, so it is the highest-value item on the list:

| Today | Once the domain is on Cloudflare |
|---|---|
| `ADMIN_PASSWORD`, because Access cannot guard `workers.dev` | Cloudflare Access — a code to Hari's email, no password to keep |
| rate-limit bindings, because WAF rules are zone-scoped | proper WAF rules |
| enquiries read in the admin, because Cloudflare cannot send mail for a domain it does not host | Cloudflare can send the notification email itself, with no third party |

**[`go-live.md`](./go-live.md) is the step-by-step for this**, including what
to write down before you start and what to check afterwards. In outline:

1. Add the site in Cloudflare → it reads the existing DNS.
2. **Compare the imported records against what Wix actually has**, record by
   record. Anything missed here is a mailbox or a service that stops working.
   The MX records for `hariscarpets.co.uk` are the ones to be most careful with.
3. Change the nameservers at the registrar to the ones Cloudflare gives you.
4. Wait for Cloudflare to confirm the zone is active.
5. Worker → Settings → Domains & Routes → add `haris-carpets.co.uk` and
   `www.haris-carpets.co.uk`.
6. Then, and only then, set up Access (§7 of [`admin.md`](./admin.md)) and put
   `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` into `wrangler.jsonc`. **The AUD tag is
   different in a new account**, so the one in the file today will be wrong.

Do this on a weekday morning, not a Friday afternoon.

---

## 6. Verification checklist

Work through all of it. Each line is something that has actually broken here at
some point.

**The public site**
- [ ] the home page loads, with photographs
- [ ] Collections → Carpets shows shades, and the filters narrow them
- [ ] a shade opens in the lightbox
- [ ] the ♥ saves a shade and **My Favourites** shows it
- [ ] the Visit us map is there and the address is on four lines
- [ ] `/privacy.html` loads, and `/privacy.html#deleting` is the deletion
      section — **Meta's app review checks a data deletion URL**
- [ ] `/data-deletion.html` still loads and redirects there: the old URL is in
      the Meta app and cannot 404
- [ ] the Instagram grid has posts on it (or is absent, not broken images)

**The admin**
- [ ] `/admin` asks for a password and lets you in with it
- [ ] the **Enquiries** tab lists the enquiries copied from the old bucket
- [ ] the **Visitors** tab shows numbers, or says exactly which setting is
      missing — the account id and site tag are per-account and **will be
      different in a new one**
- [ ] change one word, save, and see it on the public page
- [ ] the Instagram line on the Home page tab is green

**The enquiry form**
- [ ] send one through the public form
- [ ] it appears in the Enquiries tab within a minute
- [ ] **Reply** opens your mail program addressed to the right person

**Behind the scenes**
- [ ] deployment log shows every binding
- [ ] Worker → Settings → Trigger Events lists both crons (`0 4 * * 1` and
      `*/30 * * * *`)
- [ ] R2 object count matches the old bucket
- [ ] push a trivial commit to `main` and watch it deploy by itself

**Then, from a laptop with the repository checked out**

```sh
node tools/admin.test.mjs
node tools/enquiry.test.mjs
node tools/instagram.test.mjs
node tools/worker.test.mjs
```

Those four need no server and no network. The two browser suites need Playwright
and a couple of local servers — see the Tests section of
[`admin.md`](./admin.md).

---

## 7. What the new owner needs to know

**The routine.** Enquiries need reading daily; nothing emails to say one has
arrived. [`work-instructions.md`](./work-instructions.md) is the shop's copy of
that.

**The Instagram token expires every 60 days.** It refreshes itself weekly, so a
person is only needed when that has failed for a month. When it fails the front
page shows older posts rather than breaking — but it does need someone who can
get into the Meta app and mint a new token.

**Twelve months.** Enquiries are deleted automatically after twelve months, and
`public/privacy.html` promises exactly that. Change one and you must change the
other, or the privacy notice becomes untrue.

**Deploys come from GitHub.** Push to `main` and Cloudflare rebuilds. There is
no other deployment route, and no manual step. If a change is not appearing, the
first question is always whether the build actually ran — that connection has
silently stopped firing before.

**Two costs to expect:** Cloudflare Workers and R2 (both comfortably inside the
free tiers at this traffic, but not free if the site takes off), and the domain
renewal wherever it ends up being registered.

---

## 8. Outstanding at the time of writing

Carry these across; they are all live.

- [ ] **Rotate the R2 API key pair.** The credentials were pasted into a chat
      transcript, so treat them as burned regardless of anything else. R2 →
      Manage API tokens.
- [ ] **Reset the Meta App Secret.** Same reason. Meta app → Settings → Basic →
      Reset. If `INSTAGRAM_APP_SECRET` is set as a Worker secret, set the new
      value and redeploy.
- [ ] **The Meta app's Terms of Service URL still points at facebook.com.** It
      needs to point somewhere on this site before the app can be published.
- [x] ~~Decide about the enquiry notification email.~~ **Done** — Cloudflare
      emails the shop a copy of every enquiry, and the Privacy Policy says so.
      SPF and DMARC are live on the website domain.
- [ ] **The `[ask]` style assignments** in the `STYLES` table at the top of
      `public/data.js` — **five** collections are still filed by what those
      ranges usually are rather than by what Hari has confirmed. Three were
      settled by the old website, which named its own Easy Clean range.
- [ ] **Striped & Patterned Carpets** exists as a style and is deliberately
      empty, so it does not render. Hari says which collections belong in it,
      or it stays gone.
- [ ] **Two of the three banner pictures** are still stand-ins.
- [ ] **Point `hariscarpets.co.uk` at the site properly**, before the Wix
      subscription is cancelled — Wix hosts that domain's DNS, so cancelling
      takes the shop's email with it. [`mailbox-domain-move.md`](./mailbox-domain-move.md).

---

## 9. If it all goes wrong

The site is recoverable from two things: **this repository** and **a copy of the
R2 bucket**. Nothing else in the stack holds anything that cannot be rebuilt.

- **The Worker is broken** → roll back to the previous deployment in the
  Cloudflare dashboard. It is one click and takes seconds.
- **The bucket is lost, but you have the backup** → recreate the bucket, copy
  the backup in, redeploy. The site is exactly as it was.
- **The bucket is lost and there is no backup** → the site still works. The
  catalogue and every page ship with the code; what is lost is the photography
  uploaded through `/admin`, everything the shop has typed, and the enquiries.
  This is the case worth taking a copy to avoid.
- **Nobody can get into `/admin`** → set a new `ADMIN_PASSWORD` secret and
  redeploy. The public site is unaffected throughout.
