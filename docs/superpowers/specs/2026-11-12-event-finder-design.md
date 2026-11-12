# Event Finder: Design

**Date:** 2026-11-12
**Owner:** Rayyan Darugar (builder and operator)
**User:** Roohi Darugar, financial advisor (LPL Financial), North County San Diego

Notes on wording: "she" means Roohi. Anything marked **(Claude's call)** was decided by Claude during design, not by Rayyan. Rayyan should check those.

---

## 1. Why this exists

Rayyan is starting an AI services consultancy for small businesses and independent professionals, beginning with financial advisors and realtors. He sells it with a portfolio: real tools built for a real advisor, with before-and-after numbers. His mom, Roohi, is that first client. She's a seasoned advisor who maintains her book more than she builds it, and admin already eats most of her time.

Her best client sources have been **giving talks** (colleges, prisons, women's events) and **referrals through social networks**. The industry conferences she attends (CAIS, LPL events) are peer networking and don't bring in clients.

The Event Finder does two things each week, with almost no effort from her:

1. It finds **upcoming local events** worth her time, ranked so that speaking opportunities rise to the top.
2. It helps her **build relationships with organizations** (women's groups, college career centers, community and faith centers, Rotary clubs, charities) whose members fit her ideal client. Many speaking gigs come from reaching out rather than from a posted event, so she needs help knowing who to contact and when.

It's the second tool in a suite. The first was an admin time log, which is Rayyan's own measurement tool and isn't related to this one. The next is a prospecting tool that will reuse this tool's engine: scheduled search, LLM scoring against a client profile, and a short phone-friendly list.

**The goal is a working proof of concept she actually uses, not a resilient product.**

### What success looks like
- She opens the Monday email, scans it in about two minutes, and acts on at least one thing most weeks.
- Rayyan can report **events attended** and **good conversations or leads that came from them**. Those numbers are the portfolio metric.
- Acceptance criteria:
  - A weekly run finds **at least 15 real, upcoming events** (next ~8 weeks) in her area, with no duplicates.
  - When Rayyan checks 10 events by hand, the scores and reasons hold up, and **speaking opportunities rank high**.
  - She can open the link on her phone, enter the passcode, see the week's list and mark events.
  - Events that need LPL pre-approval are clearly flagged with a deadline.
  - Changing her area, ideal client or priorities changes the results without code edits.

### The two main points (Rayyan)
1. **The weekly email and reminders** are what get her to use it.
2. **A convincing "why go"** is what gets her to act. Every event must explain *specifically* why it fits her ideal client.

### Anti-goals (a failure even if it technically works)
- **Showing fake or stale events.** Showing fewer events is fine. Showing made-up ones breaks her trust. Unverified events are hidden or sunk to the bottom.
- **A feed to manage.** If it takes more than a few minutes a week, she'll stop using it.
- **Generic reasons** ("great networking opportunity"). Reasons must cite the audience, venue, price or organizer.
- Touching client data or LPL systems in any way.

### Non-goals (this build)
- Automated outreach or event registration. She acts through her own channels.
- Outreach *drafting* is a planned next addition. Leave room for a "Draft outreach" button on organizations, but don't build it.
- Prospecting and paperwork tools.
- Multi-client signup, user accounts or a full admin dashboard.
- Calendar sync.
- Visual polish. Rayyan will improve the look later. Clean and calm is enough for now.

---

## 2. Her ideal client and settings (working assumption)

Until Roohi confirms, use this as her profile:

- **Who:** women 50–75, professionals and doctors, pre-retirees and recent retirees, widows, small business owners
- **Assets:** roughly $250k+ investable
- **Area:** within ~30 miles of North County San Diego (pick a home point, e.g., Carlsbad/Encinitas, as **(Claude's call)**; it's editable)
- **Priorities:** speaking > relationship-building with fitting organizations > attending wealthy social events > tabling
- **Exclusions:** advisor-industry conferences (CAIS, LPL and similar). Sponsorships are mostly out. **Anything costing over $1,000 is excluded.**
- **LPL pre-approval lead time:** 7 days for speaking, seminars, booths and sponsorships

All of these live in a single editable **profile record**, not in code (see §6).

---

## 3. What she sees

One responsive web app that works well on both her phone and her computer, behind a single passcode. Mockups from the brainstorm are in `.superpowers/brainstorm/` (`screens-v1.html`, `screens-v2.html`). Rayyan approved the structure and function. Visual polish comes later.

### Tabs
**Events · Organizations · Map · I'm going**

### Events tab
Shows the top **5–10** events for the week, ranked. Each card shows:
- Date and time; title; host; distance from her
- Tags: a speaking tag (see below), other ways to take part, cost (Free / $X)
- **Two speaking labels (Rayyan):**
  - 🎤 **"They're asking for speakers"**: the source page explicitly calls for speakers, panelists, presenters or workshop leads. **Big ranking boost.**
  - 💡 **"You could offer to speak"**: Claude thinks the event or host is a good fit for her to pitch a talk, but the page doesn't say they want speakers. **Smaller boost.** The card and details must never claim the organizers need a speaker. Phrase it as a suggestion.
- **"Why go:"** one or two concrete sentences
- **LPL strip** (amber), when the event needs pre-approval: "Needs LPL approval · submit by Dec 3 (15 days left)". The submit-by date is the event date minus the lead time. If that date has passed, say so plainly.
- "See full details →"
- Buttons: **☆ Save for later · ✓ I'm going · ✕ Hide**
- Tapping **Hide** shows optional one-tap reasons: *Too far · Wrong crowd · Too expensive · Bad timing · Not my kind of event*. These reasons feed back into scoring (§5).

### Event details (tap in)
- When and where (address, distance, "Open in Maps" link)
- **How to take part:** the suggested mode (speak / table / attend / sponsor) and the concrete next step ("Email the program chair before Nov 25")
- Register / contact: the event page link, organizer contact if found
- About it
- **Why this fits your clients:** the specific reason the audience matches her ideal client (age and gender mix, professions, wealth signals like the venue, ticket price or neighborhood, the host's membership). This is required on every event. (Rayyan)
- Compliance: whether LPL pre-approval is needed and the deadline
- "✔ Checked against the event's own page on [date]" (the trust signal)
- The same three buttons

On a computer: the list sits on the left and the selected event's details on the right.

### Organizations tab
- **Following:** organizations she follows, each with:
  - Name, contact (role plus email/phone/link if found), **"Why her"** line
  - **Nudges** (colored strips):
    - "📣 Hosting a gala Dec 12. Good time to reach out." This shows when an upcoming event found by the weekly run is hosted by this organization.
    - "🕰 You haven't contacted them yet" / "...in a while". This shows for top organizations she hasn't contacted (thresholds in §5).
  - Buttons: **🌐 Their website · ✉ I contacted them** (logs the date and quiets the "haven't contacted" nudge)
  - Tap in for contact info, why she fits and past and upcoming events from this organization
- **Suggested for you:** new organization suggestions with **+ Follow · ✕ Not interested**

An "update" means only "this organization is running an event soon." Nothing else gets tracked. If an organization has nothing coming up, its card stays quiet. (Rayyan: drop any of this if it costs more than it's worth.)

### Map tab
Pins for the currently listed events (and optionally followed organizations' locations), using the same filters as the Events tab. Tapping a pin opens the event. Rayyan asked for this but rated it as cuttable: **build it last, and cut it first if time runs short.**

### I'm going tab
Events she marked "I'm going", soonest first, with LPL deadlines. After an event's date passes, its card asks **"Any good conversations?" 0 · 1 · 2 · 3+**, with an optional short note.

### "Tell it what to change" box
A text box at the top of the app (its placement on mobile is the builder's call). She types something like "only show things within 20 miles" or "follow the Del Mar Rotary." Claude turns that into a proposed change **to an allowed set of profile fields only**, shows it back in plain words ("Radius: 30 → 20 miles"), and she taps **Confirm**. Anything outside the allowed set gets a reply like "I can't change that. Text Rayyan." Every change is logged, and Rayyan is emailed a copy **(Claude's call)**.

**Changes take effect right away (Claude's call)**, so she doesn't think it's broken:
- Filters (radius, cost ceiling, exclusions) are re-applied to stored events immediately.
- Changes to the ideal client, priorities or weights trigger a **re-score of the currently stored upcoming events** in the background (dozens of events, pennies). New searching still waits for Monday.

Rayyan's rule: she should only adjust things herself if it's as easy as texting him or asking ChatGPT. Otherwise he does it.

Allowed fields: home location and radius, ideal-client description, priorities and weights, exclusions, cost ceiling, LPL lead time, follow or unfollow an organization, add a trusted calendar URL. Everything else (email recipients, schedule, passcode) is Rayyan-only and edited directly in Supabase.

---

## 4. The weekly email

- **When:** Monday morning, Pacific time, after the weekly run finishes.
- **To:** roohi.darugar@lpl.com and roohigee@yahoo.com (both, for redundancy), **cc rayyandarugar@gmail.com** on every send. Recipients live in the profile record.
- **Contents:**
  1. **Top 3 events**, with LPL deadlines inline
  2. **Good time to reach out:** followed organizations with an upcoming event, plus top organizations she hasn't contacted
  3. **How did it go?** For each "I'm going" event in the past week, a one-tap 0 / 1 / 2 / 3+ that records the answer without logging in. **(Claude's call)** Each tap opens a small confirm page with one button, because LPL's email security scans and "clicks" links, and a plain link would record fake answers.
  4. A button: "See all N →", a signed link that **skips the passcode** (Claude's call; the token is tied to her profile and expires after ~30 days)
- **Rayyan's oversight:** he reads his cc'd copy for the first week or two. There's **no approval step** before sending.

### Sending (Rayyan has no domain yet)
Rayyan will buy a domain soon. Until then:
- **(Claude's call)** Resend's no-domain test sender can only deliver to the Resend account owner's own address, so it can't reach Roohi. **Interim:** send through Gmail SMTP from rayyandarugar@gmail.com using an app password, behind a small `sendEmail()` interface. **Once the domain exists:** switch that interface to Resend with a verified domain, by config only.
- LPL filters incoming mail. After the first send, check that it reached her LPL inbox. If it didn't, she may need to ask to allow the sender. The Yahoo address is the backup.

---

## 5. The weekly engine (what she never sees)

### Schedule
- **Events:** once a week, early Monday Pacific time, before the email.
- **Organization suggestions:** a **one-time starting set** at setup (aim for ~10–20 strong organizations; Rayyan glances over them), then **3–5 new suggestions every two weeks**.

### Finding events
Two sweeps:
1. **Trusted calendars.** A list of known sources stored as data, not code, fetched directly at no cost. Seed list:
   - Chambers of commerce: San Diego Regional, Del Mar, Carlsbad, Encinitas, Solana Beach
   - San Diego County Medical Society; San Diego County Bar Association; San Diego County Dental Society; San Diego chapter of the CA Society of CPAs
   - Rotary clubs in North County
   - Women's business organizations (e.g., NAWBO San Diego, local women's networking groups)
   - Library systems (San Diego County Library, Carlsbad, Encinitas) and community centers
   - Hospital foundations (Rady Children's, Scripps, Sharp, Tri-City, Palomar) and arts and philanthropy groups
   - Rancho Santa Fe and Del Mar community calendars
   - College career centers and continuing-ed (CSU San Marcos, MiraCosta, Palomar, UCSD Extension)
   - Retirement communities that host talks
   - Followed organizations' event pages
2. **Open web search** through the **Tavily** free tier (1,000 credits/month, no card). Queries are generated from the profile (speaking calls, women's groups, financial-literacy programs, charity galas, etc.). **Claude's built-in web search** is the fallback if Tavily coverage is thin. Target **under 1,000 Tavily credits a month** in total.

Eventbrite's public search API no longer exists. Don't plan on it.

### Extracting and verifying
- Claude extracts structured events from fetched pages: title, start/end, venue and address, host, cost, how to register, organizer contact, participation options (calls for speakers, booths), description, source URL.
- **Verification is required** to reach the normal ranking. An event counts as verified only if:
  - **a page listing it** was fetched this run (or within the last week). This can be the organizer's or venue's own page, **or a listing site** (Eventbrite, AllEvents, Patch, local news calendars). **(Rayyan)** Listing-site events get a **lower confidence score** than events from the organizer's own page or a trusted calendar. **Don't spend extra searches or fetches hunting for the organizer's page** to upgrade them. If the organizer's page happens to turn up anyway (e.g., dedupe merges it in), use the higher confidence.
  - it has an explicit **date within the next ~8 weeks** (watch for last year's pages),
  - and it has a **location that geocodes** within the radius (or is clearly in the area).
- Each event gets a **confidence score**. Low-confidence events are **not shown**, or show only at the very bottom if the list would otherwise be too short. The builder sets the exact threshold. The rule is: fewer real events beat more shaky ones.
- **Dedupe:** within a run and across weeks. The same event found from two sources, or in a later week, is one record. Her marks (saved, going, hidden) persist across weeks, and hidden events never come back.

### Scoring
Claude scores each verified event against the profile:
- **Audience fit** with her ideal client
- **Likely wealth** of the audience
- **Participation mode**: can she speak, table or only attend? An explicit call for speakers ("They're asking for speakers") gets a **strong boost**. An inferred fit ("You could offer to speak") gets a **smaller boost**. Keep the two as separate fields.
- **Cost** (over $1,000 is excluded before scoring) and **distance**

Output per event: sub-scores, an overall score, a one- or two-sentence **"why go"**, a **"why this fits your clients"** paragraph, a **suggested mode** (attend / speak / sponsor / table) with a concrete next step, and **needs LPL pre-approval: yes/no** (yes for speaking, seminars, booths, sponsorships).

Weights come from the profile. Exclusions (advisor-industry conferences, cost over $1,000) are filtered out before scoring.

### Learning from her
- Hide reasons and Not-interested organizations from past weeks are summarized into the scoring prompt (for example: "She hid 3 events for 'too far', all over 20 miles; she hid gala-type events for 'wrong crowd'").
- Hard rules aren't changed automatically. If a pattern is strong, the app may *suggest* a settings change in the "tell it what to change" box, and she confirms it **(Claude's call)**.

### Organizations
- Starting set and biweekly suggestions are found by search and scored on how well the members fit her ideal client and whether the group hosts speakers or education events.
- Each organization stores: name, website, location, contact info if public, "why her", follow status, last-contacted date, linked upcoming events.
- **Reminder thresholds (Claude's call):**
  - Top followed organizations with no "I contacted them" get a nudge in the email starting 2 weeks after she follows them.
  - After she taps "I contacted them," the nudge pauses for 60 days.
  - An upcoming hosted event always shows a nudge.

### Distance and map
Geocode venues once and store latitude/longitude, which powers both the distance and the map. The geocoder (e.g., Nominatim with proper rate limits, or a free tier from Mapbox or Google) is the builder's call. Map tiles: OpenStreetMap through Leaflet (no account).

---

## 6. Reusable by design

The same tool should be configurable for the next advisor, and later for a realtor or insurance agent, **without code edits**.

- **One profile record** holds everything client-specific: name, home location, radius, ideal-client description, priorities and weights, exclusions, cost ceiling, compliance rules and lead time, trusted calendars, email recipients, passcode hash, schedule.
- Keep names neutral ("profile," "audience," "compliance rule"), not "advisor" or "LPL" baked into code. "LPL pre-approval" is a configured compliance rule with a label and lead time.
- Keep the engine in separable pieces: **source fetch/search → extract → verify → dedupe → score against profile → rank → deliver (app + email)**. The prospecting tool will reuse search, scoring against a profile and the short list.
- **A new standalone app** in this folder. The admin time log is unrelated and shares nothing. **(Claude's call)** Put the engine in its own folder inside the app (e.g., `lib/engine/`) with no UI dependencies, so the prospecting tool can lift it out later. No monorepo for now.
- Single tenant for now (one profile, one passcode). Don't build signup or multi-tenant admin. Do keep a profile ID on the data so a second client is a new row, not a rewrite.

---

## 7. Measurement

The portfolio numbers Rayyan needs:
- **Events attended**: count of "I'm going" events whose date has passed (optionally confirmed by her "how did it go" answer)
- **Good conversations / leads per event**: from the 0/1/2/3+ answers (email or app)
- **Organizations contacted**: from "I contacted them" taps
- Supporting: weekly events found vs. shown, her mark rates, hide reasons

Rayyan reads these directly in Supabase. A tiny read-only stats page is optional and is the builder's call. Record everything from day one.

---

## 8. Stack and constraints

- **Next.js + TypeScript on Vercel.** Rayyan has an account.
- **Supabase** for the database. Rayyan has an account.
- **Anthropic API** for extraction, scoring and the settings box. Rayyan has an account. The builder picks models; a current Sonnet-class model (`claude-sonnet-5-5`) is the expected default, with a cheaper model for bulk filtering if it helps.
- **Tavily** for web search (new free account). Claude web search as fallback.
- **Email:** Gmail SMTP for now, Resend with a domain later (§4).
- **Access:** one passcode → long-lived cookie (~90 days) **(Claude's call)**. Email links carry a signed token that skips the passcode.
- **Vercel is on the Hobby plan (Rayyan).** Hobby limits cron jobs to once a day with loose timing, and has short function time limits. **Scheduling uses cron-jobs.org (Rayyan's choice; he has used it reliably).** It calls secret-protected API routes on a schedule, and Vercel Cron isn't relied on. A full run (many fetches plus LLM calls) won't fit in one Hobby function call, so:
  - Store a **run record with stages** (sources → search → extract/verify → dedupe → score → email). Each call to the "advance run" endpoint does one small batch and saves progress.
  - cron-jobs.org polls that endpoint frequently (e.g., every few minutes) during the Monday early-morning window until the run is done. Other cron-jobs.org jobs handle the biweekly organization suggestions and the "how did it go" follow-ups.
  - Calls must be **safe to repeat** (no double emails, no duplicate events) and protected by a shared secret header.
  - Note for Rayyan: Vercel Hobby terms are for non-commercial use. Moving to Pro is his call later and doesn't change the design.
- **Budget:** keep running costs to a few dollars a week (mostly Claude tokens). Log tokens and search credits per run so Rayyan can report cost.
- Phone-first, also good on a computer. The user isn't technical: large, clear text and obvious buttons.
- No client data, no LPL systems, no automated outreach.

---

## 9. Left to the builder

- Data model and table design (the entities are clear from §3–§7)
- Exact search queries, prompt wording, scoring scales and the confidence threshold
- How the weekly run is split across function invocations
- Geocoder choice; map details
- Component library and styling (keep it calm and readable; polish comes later)
- Whether to add a minimal stats page

---

## 10. Open items for Rayyan (not blocking the build)

- Roohi to confirm her ideal client, home point, radius and cost ceiling (they're settings, so they're cheap to change)
- Buy a domain, then switch email sending to Resend
- Confirm the first email reaches her LPL inbox
- Seed contacts for organizations she already knows, if any
