# Work instructions

Step-by-step for the jobs somebody actually does on this website. Written for
whoever is running the shop's site, not for a developer.

If you want to know *why* something works the way it does, that is
[`admin.md`](./admin.md). This is what to click.

---

## Before anything else — three rules

1. **Nothing saves until you press "Save changes".** The button at the top right
   wakes up as soon as you change something. Switching tabs does not lose what
   you have typed; closing the browser does.
2. **The faint grey writing in an empty box is what the website is showing now.**
   So an empty box is not a missing one — it means "leave it as it is". Typing
   replaces it. Deleting what you typed puts the original back.
3. **Blank and hidden are two different things.** Clearing a box restores the
   shipped wording. To show *nothing at all*, untick **"Show this on the
   website"** under the box. What you wrote stays there, so ticking it back on
   brings it straight back.

After saving you will see *"Saved — live on the site within a minute"*. Open the
public page and check. If it looks unchanged, force a refresh
(**Ctrl+Shift+R**, or **Cmd+Shift+R** on a Mac).

---

## 1. Signing in

1. Go to **/admin** on the website.
2. Enter the site password and press **Sign in**.
3. The email you are signed in as shows along the top when you are in.

Stay signed in on a device only you use. Sign out on a shared one.

**If it will not let you in**, the page says why in words — read it before doing
anything else. The two common answers are "the site needs redeploying" and "the
password is not set". Both are in the *When the sign-in page won't let you in*
section of [`admin.md`](./admin.md).

---

## 2. Enquiries — the one to do daily

Enquiries from the contact form land in the **Enquiries** tab. **Nothing emails
you to say one has arrived**, so this needs looking at every working day. The
number on the tab is how many you have not read.

**To answer one:**

1. Open the **Enquiries** tab. Newest is at the top; unread ones are marked
   **New**.
2. Press **Reply**. Your own email program opens, already addressed to the
   customer, with what they wrote quoted underneath.
3. Write the reply and send it as you would any other email. It comes from your
   mailbox, so their reply comes back to you normally.
4. The enquiry is marked read once you have opened it. **Mark unread** puts it
   back if you want to come back to it.

**Delete** removes it permanently — use it once the job is finished or the
enquiry is spam. Anything left is deleted automatically after twelve months.

> **These are somebody's personal details** — a name, an email address, a phone
> number. Do not copy them anywhere else, and do not sign anyone up to anything.
> The website promises, on the Privacy Policy page, that we only use them to
> answer the enquiry.

**To change the form's wording** — the heading, the send button, the thank-you
message — scroll to the bottom of the same tab.

---

## 3. Changing wording on a page

Every word the shop can change is a box, grouped by the page it is on:

| Tab | The page it changes |
|---|---|
| **Shop details** | hours, phone, email, address, areas covered, the line under the logo, the footer, the notice strip, the map |
| **About us** | the About page — opening line and the body |
| **Home page** | everything on the front page |
| **Other pages** | Collections, Visit us, Contact us |
| **Portfolio** | the Portfolio page |
| **Styles** | the style tiles and the heading above them |

**To change something:**

1. Open the tab for the page it is on.
2. Find the box — the labels say where each one appears ("Banner heading",
   "Fitting — button").
3. Type the new wording. **Paragraphs are separated by a blank line.**
4. Press **Save changes**, then open the public page and look.

**Can't find the box?** It is almost always on the tab for the page you are
looking at rather than the one you would guess. Opening hours are on **Shop
details** even though they show on Visit us. The heading over the style tiles is
on **Styles**, not Collections.

---

## 4. Photographs

All pictures are on the **Photos** tab, in three groups:

- **Around the site** — the three banner pictures, the showroom, About us,
  fitting, stairs, and the tiles on the Collections page.
- **Style tiles** — the big pictures on "What sort of carpets are you after?".
- **Collections** — one per collection. Most are stand-ins from the mill.

**To replace one:**

1. **Photos** tab → find the picture → **Replace** → choose the file.
2. Wait for *"Uploaded — press Save changes"*.
3. Fill in the box under it — see *the description box* below.
4. **Save changes**, then look at the page.

**Use the original** appears under any picture you have replaced, and puts the
shipped photograph back.

### What to be aware of when uploading

- **Big files are fine.** Photographs are shrunk in your browser before they are
  uploaded — a full-size phone photo is exactly right. You do not need to resize
  anything first.
- **Landscape, not portrait.** Every frame on the site is wider than it is tall.
  A portrait photo gets cropped top and bottom, which usually loses the floor.
- **Take it from standing height, pointing down the room.** Floors photograph
  badly straight down and badly from a doorway at eye level.
- **Daylight beats the shop lights.** Yellow light makes a beige carpet look
  orange on screen, and the customer will hold you to what they saw.
- **Any common image format is fine** — a phone photo, a PNG screenshot, a
  picture a mill emailed. Your browser converts it before it is uploaded.
- **Each upload is stored under a new name**, so uploading the same file twice
  makes two pictures rather than replacing one. That is deliberate: the old
  photograph may sit in people's browser caches for up to a year, so the way to
  change a picture is to point the slot at a new one, which is what **Replace**
  does.

### If a red box appears after saving

**"These did not save"** means the website took everything except what it lists.
Nothing you typed has gone from the screen — fix what it names and press **Save
changes** again. The two you are most likely to see:

- *"N collection(s) beyond the limit of 1200"* — you have hit the ceiling. Tell
  whoever looks after the site before adding more.
- *"…its name cannot be stored"* — the collection's name and brand together are
  too long. Shorten one and re-create it.

A save with nothing in that box says **"Saved — live on the site within a
minute"**, and that is the only message that means everything went through.

### The description box

The box under each picture is what a blind visitor hears and what Google reads.
Say **what is in the picture**, not "photo":

- ✅ "Wool twist carpet fitted to a staircase and landing"
- ❌ "IMG_4821" or "carpet photo"

It is one short sentence. It is also worth real money — it is a large part of
how Google understands what the pictures show.

---

## 5. The style tiles

The tiles under "What sort of carpets are you after?" are two tabs:

- **Styles** tab — the heading above the tiles, each style's name, and the line
  under the name. The heading can be switched off with its tick.
- **Photos** tab, *Style tiles* — the picture on each one.

Until a style has its own picture it borrows one from the first collection filed
under it, so a style whose collections have no photographs shows an **empty
frame**. Uploading a picture fixes it.

**A style with no collections ticked does not appear on the website at all**, so
the admin does not offer wording boxes for it. Tick a collection under it and
they appear.

**To move a collection into a different style:** Styles tab → tick it under the
style it belongs to, untick it under the one it does not → Save. A collection in
no style still appears everywhere else on the site, so it is safe to untick one
you are unsure of.

---

## 6. Collections and shades

**Collections** tab. Nothing here is ever deleted — hiding takes it off the
website but keeps the link working for anyone who saved it.

| To do this | Do this |
|---|---|
| Take a discontinued range off the site | find it, tick **Hide** |
| Rename it | type over the name |
| Give it its own description | the box under the name |
| Add a shade the mill has just sent | open the collection → **Add a shade** → name it and pick its colour |
| Add a whole new collection | **Add a collection** at the top |
| See how many you have | the line at the top of the tab counts them |
| Hide one shade | open the collection, tick **Hide** on that shade |

A new collection or shade added here has no photograph until you add one on the
**Photos** tab.

**How much can go in.** Twelve hundred collections added here, four hundred shades
in any one of them, and no limit worth worrying about on how many photographs —
each one is its own file in the shop's own storage. The top of the Collections
tab tells you where you are against that. If a save ever refuses something, it
says so in a red box rather than dropping it quietly.

---

## 7. The Portfolio page

Your own finished jobs. This is the page most worth keeping fed — it is the only
part of the site that is unmistakably *this* shop's work.

1. **Portfolio** tab → **Choose picture** → pick the photograph.
2. **Heading** — where or what it is ("Victorian semi, Isleworth").
3. **Description** — a line about the job ("Wool twist to the stairs and landing,
   fitted in a day").
4. **Save changes**.

**Remove** takes a job off. With no jobs added the page says so rather than
showing empty frames, so it is never embarrassing — but it is also not doing
anything for you.

---

## 8. A notice across the top of the home page

For a bank holiday, a delivery delay, a sale.

1. **Shop details** → **Notice across the top of the home page**.
2. Type the message. **Save changes**.
3. **Empty it again when it is over** — clear the box and save. An out-of-date
   notice is worse than none.

---

## 9. Google reviews

**Home page** tab, at the bottom: the rating, how many, a link to the listing,
and up to three reviews with a name, a star count and a date. Leave them empty
and the strip does not appear at all.

They are not pulled from Google automatically — copy the best three across by
hand.

> **Only paste in reviews people have actually left.** Invented testimonials on a
> real shop's website are a lie to customers and very hard to walk back.

---

## 10. Instagram

The grid on the home page fills itself from the live Instagram account. On the
**Home page** tab there is a line telling you whether that is actually working —
in green when it is, flagged when it is not, with the reason.

**When it says the feed is not working:**

- *"Instagram refused the token"* — the token has expired or been withdrawn. It
  has to be replaced by whoever looks after the Cloudflare account; see the
  Instagram section of [`admin.md`](./admin.md). The site keeps showing the last
  posts it fetched, so there is no rush of hours, but do not leave it for weeks.
- *anything else* — check the account is still a Business or Creator account and
  still connected to the Facebook Page.

While it is broken the home page shows the last feed it managed to fetch, then
the posts chosen by hand on the Home page tab, then nothing. **It never shows
broken images.**

The token expires every 60 days and renews itself weekly on its own. It only
needs a person when that renewal has failed for over a month.

---

## 11. The WhatsApp button

**Shop details** → **WhatsApp number**. Put the mobile the WhatsApp account is
on — the showroom landline will not work — and a green chat button appears in
the bottom corner of every page. Empty the box and it disappears completely.

Tapping it opens WhatsApp with a new message to you. Nothing about the visitor
reaches WhatsApp before they send it.

---

## 12. Opening hours, phone, address

**Shop details** tab.

- **Opening hours** — free text, exactly as you want it read.
- **Phone** — type it however you like (`020 8570 6502`); the dial link is built
  from it automatically.
- **Address** — **one line per line**. It shows on four lines on the site
  because it is on four lines in the box.
- **Areas you cover** — shows as its own line on Visit us, labelled *We cover*.
  Untick "Show this on the website" to remove it.

Changing the phone number changes the header button, the footer and the contact
page together.

---

## Routine

**Every working day**
- [ ] Open the **Enquiries** tab and answer anything new.

**Every week**
- [ ] Add a job to the **Portfolio** if one has finished.
- [ ] Glance at the Instagram line on the **Home page** tab — green?
- [ ] Clear the notice strip if what it says is over.

**Every month**
- [ ] Hide anything the mills have discontinued.
- [ ] Copy across any new Google review worth showing.
- [ ] Open the site on a phone and walk through it as a customer would.

**Twice a year, when a supplier sends a new book**
- [ ] Tell whoever looks after the site — the catalogue is regenerated from the
      supplier's photography, which is a developer job, not an admin one.

---

## If something looks wrong on the website

1. **Force a refresh first** — Ctrl+Shift+R (Cmd+Shift+R on a Mac). Most
   "it hasn't changed" is a cached page.
2. **Check you pressed Save changes.** The button greys out once saved.
3. **If a photograph is missing**, check the Photos tab: an upload that never
   got a **Save changes** after it is not on the site.
4. **If a whole section has vanished**, check the tick under its heading box —
   "Show this on the website" unticked hides the section's heading and the
   things that hang off it.
5. **If the site is broken rather than wrong** — nothing loads, or every page is
   blank — that is not something the admin can cause. The catalogue and every
   page ship with the site, and the admin can only change words and pictures
   over the top. Contact whoever holds the Cloudflare account; see
   [`handover.md`](./handover.md).
